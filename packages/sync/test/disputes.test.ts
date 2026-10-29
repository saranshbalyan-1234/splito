import 'fake-indexeddb/auto'
import {IDBFactory} from 'fake-indexeddb'

import {beforeEach, describe, expect, test} from 'bun:test'
import {DomainError} from '@splito/domain'

import {
  acceptDispute,
  type Dispute,
  disputeEvents,
  holdRecord,
  listDisputes,
  listOpenDisputes,
  raiseDispute,
  rejectDispute,
  releaseHold,
  reopenDispute,
  updateExpenseResolving,
  withdrawDispute,
} from '../src/disputes'
import {openIdbStore} from '../src/idbStore'
import {
  createExpense,
  createGroup,
  createPerson,
  createRepayment,
  createWriteOffs,
  deleteExpense,
  deleteRepayment,
  ensureMe,
  type Expense,
  type ExpenseDraft,
  restoreExpense,
  updateExpense,
} from '../src/mutations'
import {openSqlStore} from '../src/sqlStore'
import {type Store} from '../src/store'
import {type MutationCtx} from '../src/types'
import {bunExecutor} from './bunExecutor'
import {expectDisputedMatch, expectProjectionsMatchLedger} from './projectionCheck'

let s: Store
let n = 0
let me: MutationCtx
/** Bob is the adder of nothing here; Ann added the group expense and Cy is a member who is not on it. */
let as: (actor: string) => MutationCtx
let ids: {bob: string; ann: string; cy: string; group: string; direct: string; shared: string; items: string; pay: string}

const draft = (over: Partial<ExpenseDraft> = {}): ExpenseDraft => ({
  title: 'Dinner', groupId: null, currency: 'INR', total: 1200n, payers: {me: 1200n}, split: {mode: 'equal', participants: ['me', ids.bob]},
  date: '2026-10-26', tz: 'Asia/Kolkata', category: 'food', notes: '', ...over,
})

async function setup(open: () => Promise<Store>) {
  n = 0
  s = await open()
  me = {deviceId: 'dev1', actor: 'me', now: () => 1000 + n * 10, newId: () => 'id' + ++n}
  as = actor => ({...me, actor})
  await ensureMe(s, me, 'Me')
  const bob = (await createPerson(s, me, {name: 'Bob'})).id
  const ann = (await createPerson(s, me, {name: 'Ann'})).id
  const cy = (await createPerson(s, me, {name: 'Cy'})).id
  const group = (await createGroup(s, me, {name: 'Goa', kind: 'trip', currency: 'INR', memberIds: [bob, ann, cy], startDate: null, endDate: null})).id
  ids = {bob, ann, cy, group, direct: '', shared: '', items: '', pay: ''}
  ids.direct = (await createExpense(s, me, draft())).id
  // Added by Ann, paid by Ann, in the group, shared by me, Bob and Ann.
  ids.shared = (
    await createExpense(s, as(ann), draft({title: 'Hotel', groupId: group, currency: 'EUR', total: 900n, payers: {[ann]: 900n}, split: {mode: 'equal', participants: ['me', bob, ann]}}))
  ).id
  ids.items = (
    await createExpense(s, me, draft({
      title: 'Bill', groupId: group, total: 1000n, payers: {me: 1000n},
      split: {mode: 'items', items: [{id: 'a', name: 'Beer', amount: 600n, participants: [bob, 'me']}, {id: 'b', name: 'Fries', amount: 400n, participants: [ann]}], tax: 0n, tip: 0n, discount: 0n},
    }))
  ).id
  ids.pay = (await createRepayment(s, me, {groupId: null, currency: 'USD', from: bob, to: 'me', amount: 500n, date: '2026-10-27', tz: 'UTC', note: ''})).id
}

const fails = async (p: Promise<unknown>, code: string) => {
  const e = await p.catch(x => x)
  expect(e).toBeInstanceOf(DomainError)
  expect((e as DomainError).code).toBe(code)
}

const engines: Array<[string, () => Promise<Store>]> = [
  ['SQLite', () => openSqlStore(bunExecutor(':memory:'))],
  ['IndexedDB', () => openIdbStore('disputes', new IDBFactory())],
]

describe.each(engines)('disputes on %s', (_name, open) => {
  beforeEach(() => setup(open))

  test('raising writes the dispute, its history and one outbox op, and the record still counts', async () => {
    const balances = await s.balances()
    const outbox = (await s.outbox()).length
    const d = await raiseDispute(s, as(ids.bob), {targetType: 'expense', targetId: ids.direct, reason: 'wrong_amount', note: 'It was 900', proposedFix: {kind: 'amount', amount: 900n}})
    expect(d.data).toMatchObject({status: 'open', kind: 'dispute', raisedBy: ids.bob, recordedBy: ids.bob, itemIndex: null, groupId: null, reason: 'wrong_amount'})
    expect(d.syncStatus).toBe('pending')
    expect(await s.history('dispute', d.id)).toHaveLength(1)
    expect((await s.outbox()).slice(outbox).map(o => o.opType)).toEqual(['dispute.raise'])
    expect(await s.balances()).toEqual(balances)
    expect((await listOpenDisputes(s)).items.map(e => e.id)).toEqual([d.id])
    expect((await listDisputes(s, 'expense', ids.direct)).items.map(e => e.id)).toEqual([d.id])
    await expectProjectionsMatchLedger(s)
  })

  test('the disputed sums follow the record: raise, edit, release, delete', async () => {
    const d = await raiseDispute(s, as(ids.bob), {targetType: 'expense', targetId: ids.direct, reason: 'other', note: 'hm'})
    expect(await s.disputedBalances({personId: 'me'})).toMatchObject([{personId: 'me', groupId: null, currency: 'INR', amount: 600n}])
    expect((await s.disputedPairs('me', ids.bob)).map(p => [p.currency, p.amount])).toEqual([['INR', 600n]])
    // An edit moves the disputed part with it.
    await updateExpense(s, me, ids.direct, draft({total: 800n, payers: {me: 800n}}))
    expect((await s.disputedBalances({personId: 'me'}))[0]!.amount).toBe(400n)
    await expectDisputedMatch(s)
    await withdrawDispute(s, as(ids.bob), d.id)
    expect(await s.disputedBalances()).toEqual([])
    expect(await s.disputedPairs('me')).toEqual([])
    await expectDisputedMatch(s)
  })

  test('a disputed item counts only that item, an item dispute and a whole one add up to the record', async () => {
    const item = await raiseDispute(s, as(ids.bob), {targetType: 'expense', targetId: ids.items, itemIndex: 0, reason: 'not_part', note: ''})
    const net = Object.fromEntries((await s.disputedBalances({groupId: ids.group})).map(b => [b.personId, b.amount]))
    // Beer 600 between Bob and me (300 each), paid by me: I lent 300, Bob borrowed 300.
    expect(net).toEqual({me: 300n, [ids.bob]: -300n})
    await expectDisputedMatch(s)
    await raiseDispute(s, as(ids.ann), {targetType: 'expense', targetId: ids.items, reason: 'wrong_amount', note: ''})
    expect(Object.fromEntries((await s.disputedBalances({groupId: ids.group})).map(b => [b.personId, b.amount]))).toEqual({me: 700n, [ids.bob]: -300n, [ids.ann]: -400n})
    await expectDisputedMatch(s)
    await withdrawDispute(s, as(ids.bob), item.id)
    await expectDisputedMatch(s)
  })

  test('one open dispute per person per record; others may dispute the same record', async () => {
    await raiseDispute(s, as(ids.bob), {targetType: 'expense', targetId: ids.shared, reason: 'other', note: 'x'})
    await fails(raiseDispute(s, as(ids.bob), {targetType: 'expense', targetId: ids.shared, reason: 'wrong_amount', note: ''}), 'ALREADY_OPEN')
    await fails(holdRecord(s, as(ids.bob), {targetType: 'expense', targetId: ids.shared, note: 'wait'}), 'ALREADY_OPEN')
    await raiseDispute(s, me, {targetType: 'expense', targetId: ids.shared, reason: 'other', note: 'me too'})
    expect(await s.count('dispute', {index: 'byTargetStatus', eq: ['expense', ids.shared, 'open']})).toBe(2)
    await expectDisputedMatch(s)
  })

  test('who may raise: participants, and any group member for "I was left out"; reasons are checked', async () => {
    await fails(raiseDispute(s, as(ids.cy), {targetType: 'expense', targetId: ids.shared, reason: 'wrong_amount', note: ''}), 'NOT_A_PARTICIPANT')
    await raiseDispute(s, as(ids.cy), {targetType: 'expense', targetId: ids.shared, reason: 'left_out', note: '', proposedFix: {kind: 'share', personId: ids.cy, amount: 300n}})
    await fails(raiseDispute(s, as(ids.bob), {targetType: 'expense', targetId: ids.shared, reason: 'left_out', note: ''}), 'ALREADY_PARTICIPANT')
    await fails(raiseDispute(s, as(ids.bob), {targetType: 'expense', targetId: ids.direct, reason: 'other', note: '   '}), 'NOTE_REQUIRED')
    await fails(raiseDispute(s, as(ids.bob), {targetType: 'expense', targetId: ids.direct, reason: 'not_received', note: ''}), 'INVALID_REASON')
    await fails(raiseDispute(s, as(ids.bob), {targetType: 'expense', targetId: ids.direct, reason: 'wrong_amount', note: '', proposedFix: {kind: 'payer', personId: 'me'}}), 'INVALID_FIX')
    await fails(raiseDispute(s, as(ids.bob), {targetType: 'expense', targetId: ids.direct, itemIndex: 0, reason: 'not_part', note: ''}), 'INVALID_ITEM')
    await fails(raiseDispute(s, as(ids.bob), {targetType: 'expense', targetId: 'nope', reason: 'not_part', note: ''}), 'NOT_FOUND')
    await fails(raiseDispute(s, as(ids.bob), {targetType: 'expense', targetId: ids.direct, reason: 'other', note: 'x'.repeat(1001)}), 'NOTE_TOO_LONG')
  })

  test('a retried save with the same id records one dispute', async () => {
    const a = await raiseDispute(s, as(ids.bob), {id: 'd-x', targetType: 'expense', targetId: ids.direct, reason: 'other', note: 'x'})
    const b = await raiseDispute(s, as(ids.bob), {id: 'd-x', targetType: 'expense', targetId: ids.direct, reason: 'other', note: 'x'})
    expect(b.version).toBe(a.version)
    expect(await s.count('dispute')).toBe(1)
  })

  test('the raiser cannot answer; the adder, payer or admin accept or reject; a stranger cannot', async () => {
    const d = await raiseDispute(s, as(ids.bob), {targetType: 'expense', targetId: ids.shared, reason: 'other', note: 'x'})
    await fails(acceptDispute(s, as(ids.bob), d.id), 'OWN_DISPUTE')
    await fails(rejectDispute(s, as(ids.bob), d.id, {note: 'no'}), 'OWN_DISPUTE')
    await fails(acceptDispute(s, as(ids.cy), d.id), 'NOT_RESOLVER')
    await fails(rejectDispute(s, as(ids.ann), d.id, {note: ''}), 'NOTE_REQUIRED')
    // The adder and payer is Ann; I am the group's admin.
    const rejected = await rejectDispute(s, as(ids.ann), d.id, {note: 'The receipt says 900'})
    expect(rejected.data).toMatchObject({status: 'rejected', resolvedBy: ids.ann, resolution: 'The receipt says 900'})
    await expectDisputedMatch(s)
    expect(await s.disputedBalances()).toEqual([])
  })

  test('withdraw: only the raiser (or who recorded it for them)', async () => {
    const d = await raiseDispute(s, as(ids.bob), {targetType: 'expense', targetId: ids.direct, reason: 'other', note: 'x'})
    await fails(withdrawDispute(s, as(ids.cy), d.id), 'NOT_RAISER')
    expect((await withdrawDispute(s, as(ids.bob), d.id)).data.status).toBe('withdrawn')
    await fails(withdrawDispute(s, as(ids.bob), d.id), 'NOT_OPEN')
    // Recorded by me for Bob: I may withdraw it for him.
    const e = await raiseDispute(s, me, {targetType: 'expense', targetId: ids.direct, raisedBy: ids.bob, reason: 'other', note: 'x'})
    expect(e.data).toMatchObject({raisedBy: ids.bob, recordedBy: 'me'})
    expect((await withdrawDispute(s, me, e.id)).data.status).toBe('withdrawn')
  })

  test('reopen: once by the raiser, then only an admin; needs the record live', async () => {
    const d = await raiseDispute(s, as(ids.bob), {targetType: 'expense', targetId: ids.shared, reason: 'other', note: 'x'})
    await fails(reopenDispute(s, as(ids.bob), d.id, {note: 'again'}), 'NOT_REJECTED')
    await rejectDispute(s, as(ids.ann), d.id, {note: 'no'})
    await fails(reopenDispute(s, as(ids.bob), d.id, {note: ''}), 'NOTE_REQUIRED')
    await fails(reopenDispute(s, as(ids.cy), d.id, {note: 'y'}), 'NOT_RAISER')
    const reopened = await reopenDispute(s, as(ids.bob), d.id, {note: 'Here is the receipt'})
    expect(reopened.data).toMatchObject({status: 'open', note: 'Here is the receipt', reopenCount: 1, resolvedBy: null})
    expect((await s.disputedBalances()).length).toBeGreaterThan(0)
    await rejectDispute(s, as(ids.ann), d.id, {note: 'still no'})
    await fails(reopenDispute(s, as(ids.bob), d.id, {note: 'third'}), 'ADMIN_ONLY')
    expect((await reopenDispute(s, me, d.id, {note: 'admin looks again'})).data.reopenCount).toBe(2)
    await expectDisputedMatch(s)
  })

  test('accept with the fix applies it as a normal edit with history, in one transaction', async () => {
    const d = await raiseDispute(s, as(ids.bob), {targetType: 'expense', targetId: ids.direct, reason: 'wrong_amount', note: '', proposedFix: {kind: 'amount', amount: 900n}})
    const accepted = await acceptDispute(s, me, d.id, {apply: true})
    expect(accepted.data.status).toBe('accepted')
    const e = await s.get<Expense>('expense', ids.direct)
    expect(e!.data.total).toBe(900n)
    expect(e!.data.payers).toEqual({me: 900n})
    expect(e!.data.shares).toEqual({me: 450n, [ids.bob]: 450n})
    expect(e!.version).toBe(2)
    expect((await s.outbox()).filter(o => o.entityId === ids.direct).map(o => o.opType)).toEqual(['expense.create', 'expense.update'])
    expect(await s.disputedBalances()).toEqual([])
    await expectProjectionsMatchLedger(s)
  })

  test('share, payer and duplicate fixes', async () => {
    const share = await raiseDispute(s, as(ids.bob), {targetType: 'expense', targetId: ids.shared, reason: 'wrong_share', note: '', proposedFix: {kind: 'share', personId: ids.bob, amount: 100n}})
    await acceptDispute(s, as(ids.ann), share.id, {apply: true})
    const e = (await s.get<Expense>('expense', ids.shared))!
    expect(e.data.shares[ids.bob]).toBe(100n)
    expect(Object.values(e.data.shares).reduce((a, b) => a + b, 0n)).toBe(900n)
    expect(e.data.split.mode).toBe('exact')

    const payer = await raiseDispute(s, as(ids.bob), {targetType: 'expense', targetId: ids.direct, reason: 'wrong_payer', note: '', proposedFix: {kind: 'payer', personId: ids.bob}})
    await acceptDispute(s, me, payer.id, {apply: true})
    expect((await s.get<Expense>('expense', ids.direct))!.data.payers).toEqual({[ids.bob]: 1200n})

    const copy = (await createExpense(s, me, draft({title: 'Dinner again'}))).id
    const dup = await raiseDispute(s, as(ids.bob), {targetType: 'expense', targetId: copy, reason: 'duplicate', note: '', proposedFix: {kind: 'duplicate', of: ids.direct}})
    const done = await acceptDispute(s, me, dup.id, {apply: true})
    expect(done.data.status).toBe('accepted')
    expect((await s.get('expense', copy))!.deleted).toBe(true)
    // Accepted first, then deleted: it stays Accepted, not Gone.
    expect((await s.get<Dispute>('dispute', dup.id))!.data.status).toBe('accepted')
    await expectProjectionsMatchLedger(s)
  })

  test('applying a fix without one fails, and a bad fix rolls the whole accept back', async () => {
    const d = await raiseDispute(s, as(ids.bob), {targetType: 'expense', targetId: ids.direct, reason: 'other', note: 'x'})
    await fails(acceptDispute(s, me, d.id, {apply: true}), 'NO_FIX')
    expect((await s.get<Dispute>('dispute', d.id))!.data.status).toBe('open')
    const big = await raiseDispute(s, as(ids.bob), {targetType: 'expense', targetId: ids.shared, reason: 'wrong_share', note: '', proposedFix: {kind: 'share', personId: ids.bob, amount: 99999n}})
    await fails(acceptDispute(s, as(ids.ann), big.id, {apply: true}), 'INVALID_FIX')
    expect((await s.get<Dispute>('dispute', big.id))!.data.status).toBe('open')
  })

  test('a payment "not received" accepted with apply is deleted; a write-off dispute likewise', async () => {
    const d = await raiseDispute(s, as(ids.bob), {targetType: 'repayment', targetId: ids.pay, reason: 'not_received', note: ''})
    expect((await s.disputedBalances({personId: 'me'}))[0]!).toMatchObject({currency: 'USD', amount: -500n})
    await acceptDispute(s, me, d.id, {apply: true})
    expect((await s.get('repayment', ids.pay))!.deleted).toBe(true)
    expect((await s.get<Dispute>('dispute', d.id))!.data.status).toBe('accepted')
    const [w] = await createWriteOffs(s, me, [{groupId: null, currency: 'USD', from: ids.bob, to: 'me', amount: 70n, date: '2026-10-28', tz: 'UTC', note: ''}])
    const wd = await raiseDispute(s, as(ids.bob), {targetType: 'writeoff', targetId: w!.id, reason: 'other', note: 'I did not agree'})
    await acceptDispute(s, me, wd.id, {apply: true})
    expect((await s.get('writeoff', w!.id))!.deleted).toBe(true)
    await expectProjectionsMatchLedger(s)
  })

  test('deleting the record closes its open disputes as Gone, a restore does not reopen them', async () => {
    const a = await raiseDispute(s, as(ids.bob), {targetType: 'expense', targetId: ids.shared, reason: 'other', note: 'x'})
    const b = await holdRecord(s, me, {targetType: 'expense', targetId: ids.shared, note: 'waiting'})
    await deleteExpense(s, as(ids.ann), ids.shared)
    for (const id of [a.id, b.id]) expect((await s.get<Dispute>('dispute', id))!.data).toMatchObject({status: 'gone', resolvedBy: ids.ann})
    expect(await s.disputedBalances()).toEqual([])
    await expectProjectionsMatchLedger(s)
    await restoreExpense(s, me, ids.shared)
    expect((await s.get<Dispute>('dispute', a.id))!.data.status).toBe('gone')
    expect(await s.disputedBalances()).toEqual([])
    await fails(raiseDispute(s, as(ids.bob), {targetType: 'expense', targetId: 'missing', reason: 'other', note: 'x'}), 'NOT_FOUND')
    await deleteRepayment(s, me, ids.pay)
    await fails(raiseDispute(s, as(ids.bob), {targetType: 'repayment', targetId: ids.pay, reason: 'not_received', note: ''}), 'NOT_FOUND')
  })

  test('a hold needs a reason; any participant releases it; it is not answered', async () => {
    await fails(holdRecord(s, as(ids.bob), {targetType: 'expense', targetId: ids.direct, note: ' '}), 'NOTE_REQUIRED')
    const h = await holdRecord(s, as(ids.bob), {targetType: 'expense', targetId: ids.direct, note: 'waiting for the refund'})
    expect(h.data).toMatchObject({kind: 'hold', reason: 'hold', status: 'open'})
    expect((await s.outbox()).at(-1)!.opType).toBe('dispute.hold')
    await fails(acceptDispute(s, me, h.id), 'NOT_OPEN')
    await fails(withdrawDispute(s, as(ids.bob), h.id), 'NOT_OPEN')
    await fails(releaseHold(s, as(ids.cy), h.id), 'NOT_A_PARTICIPANT')
    expect((await s.disputedBalances()).length).toBeGreaterThan(0)
    expect((await releaseHold(s, me, h.id)).data).toMatchObject({status: 'released', resolvedBy: 'me'})
    expect(await s.disputedBalances()).toEqual([])
  })

  test('editing and resolving the dispute in one go ("Does this resolve it?")', async () => {
    const d = await raiseDispute(s, as(ids.bob), {targetType: 'expense', targetId: ids.direct, reason: 'wrong_amount', note: ''})
    const other = await raiseDispute(s, as(ids.cy), {targetType: 'expense', targetId: ids.shared, reason: 'left_out', note: ''})
    await updateExpenseResolving(s, me, ids.direct, draft({total: 1000n, payers: {me: 1000n}}), [d.id])
    expect((await s.get<Dispute>('dispute', d.id))!.data.status).toBe('accepted')
    expect((await s.get<Expense>('expense', ids.direct))!.data.total).toBe(1000n)
    expect((await s.get<Dispute>('dispute', other.id))!.data.status).toBe('open')
    // The raiser cannot resolve by editing: nothing is saved.
    const mine = await raiseDispute(s, me, {targetType: 'expense', targetId: ids.direct, reason: 'other', note: 'x'})
    await fails(updateExpenseResolving(s, me, ids.direct, draft({total: 700n, payers: {me: 700n}}), [mine.id]), 'OWN_DISPUTE')
    expect((await s.get<Expense>('expense', ids.direct))!.data.total).toBe(1000n)
    await expectProjectionsMatchLedger(s)
  })

  test('events: raised, answered, reopened, released, gone, one per history version', async () => {
    const d = await raiseDispute(s, as(ids.bob), {targetType: 'expense', targetId: ids.shared, reason: 'other', note: 'x'})
    await rejectDispute(s, as(ids.ann), d.id, {note: 'no'})
    await reopenDispute(s, as(ids.bob), d.id, {note: 'y'})
    const h = await holdRecord(s, me, {targetType: 'expense', targetId: ids.shared, note: 'wait'})
    await releaseHold(s, me, h.id)
    await deleteExpense(s, me, ids.shared)
    const history = (await Promise.all([d.id, h.id].map(id => s.history('dispute', id)))).flat()
    expect(disputeEvents(history).map(e => e.kind)).toEqual(['raised', 'rejected', 'reopened', 'held', 'released', 'gone'])
  })
})
