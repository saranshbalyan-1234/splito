/* F-114: restore, the bin and idempotent retries keep the ledger honest (audit M4, m11, m15, m17). */
import {beforeEach, expect, test} from 'bun:test'
import {DomainError} from '@splito/domain'

import {
  createExpense,
  createGroup,
  createPerson,
  createRepayment,
  createWriteOffs,
  deleteExpense,
  deletePerson,
  restorePerson,
  deleteRepayment,
  deleteWriteOff,
  ensureMe,
  type ExpenseDraft,
  type RepaymentInput,
  restoreExpense,
  restoreRepayment,
  restoreWriteOff,
} from '../src/mutations'
import {createComment, deleteComment} from '../src/comments'
import {searchStore} from '../src/search'
import {openSqlStore} from '../src/sqlStore'
import {type Store} from '../src/store'
import {type MutationCtx} from '../src/types'
import {bunExecutor} from './bunExecutor'

let s: Store
let ctx: MutationCtx
let n = 0
let clock = 0
beforeEach(async () => {
  clock = 1_000_000
  s = await openSqlStore(bunExecutor(':memory:'))
  ctx = {deviceId: 'dev1', actor: 'me', now: () => ++clock, newId: () => 'id' + ++n}
  await ensureMe(s, ctx, 'Me')
})

const expense = (over: Partial<ExpenseDraft> = {}): ExpenseDraft => ({
  title: 'Dinner',
  groupId: null,
  currency: 'EUR',
  total: 3000n,
  payers: {me: 3000n},
  split: {mode: 'equal', participants: ['me']},
  date: '2026-10-26',
  tz: 'Asia/Kolkata',
  category: 'food',
  notes: '',
  ...over,
})

const pay = (over: Partial<RepaymentInput>): RepaymentInput => ({
  groupId: null,
  currency: 'EUR',
  from: 'me',
  to: 'me',
  amount: 500n,
  date: '2026-10-26',
  tz: 'Asia/Kolkata',
  note: '',
  ...over,
})

const codeOf = async (p: Promise<unknown>) => {
  try {
    await p
  } catch (e) {
    if (e instanceof DomainError) return e.code
    throw e
  }
  return undefined
}

/* ------------------------------ M4: restore --------------------------------- */

test('M4: a friend named only by deleted records can go; the friend stays as a tombstone, not removed from the records', async () => {
  const bob = await createPerson(s, ctx, {name: 'Bob'})
  const e = await createExpense(s, ctx, expense({split: {mode: 'equal', participants: ['me', bob.id]}}))
  const r = await createRepayment(s, ctx, pay({from: bob.id, to: 'me'}))
  await deleteExpense(s, ctx, e.id)
  await deleteRepayment(s, ctx, r.id)
  await deletePerson(s, ctx, bob.id)
  expect((await s.get('person', bob.id))?.deleted).toBe(true)
  expect((await s.get<{name: string}>('person', bob.id))?.data.name).toBe('Bob')
  // The records still name him; restoring one needs him back first.
  expect(await codeOf(restoreRepayment(s, ctx, r.id))).toBe('UNKNOWN_PERSON')
  await restorePerson(s, ctx, bob.id)
  await restoreRepayment(s, ctx, r.id)
  expect((await s.get('repayment', r.id))?.deleted).toBe(false)
})

test('M4: restore refuses a record whose person is gone, with an explanation code', async () => {
  const bob = await createPerson(s, ctx, {name: 'Bob'})
  const e = await createExpense(s, ctx, expense({split: {mode: 'equal', participants: ['me', bob.id]}}))
  const r = await createRepayment(s, ctx, pay({from: bob.id, to: 'me'}))
  const w = (await createWriteOffs(s, ctx, [pay({from: bob.id, to: 'me', amount: 100n})]))[0]!
  await deleteExpense(s, ctx, e.id)
  await deleteRepayment(s, ctx, r.id)
  await deleteWriteOff(s, ctx, w.id)
  // Bob goes by a path that skips deletePerson (legacy data): the restore must still refuse.
  await s.transaction(async tx => {
    const p = (await tx.get<{name: string; isMe: boolean}>('person', bob.id))!
    await tx.put({...p, data: p.data, deleted: true, version: p.version + 1, updatedAt: ++clock})
  })
  expect(await codeOf(restoreRepayment(s, ctx, r.id))).toBe('UNKNOWN_PERSON')
  expect(await codeOf(restoreWriteOff(s, ctx, w.id))).toBe('UNKNOWN_PERSON')
  expect((await s.get('repayment', r.id))?.deleted).toBe(true)
  expect((await s.balances({personId: 'me'})).length).toBe(0)
})

test('M4: restore refuses an expense whose group is deleted', async () => {
  const bob = await createPerson(s, ctx, {name: 'Bob'})
  const g = await createGroup(s, ctx, {name: 'Goa', kind: 'trip', currency: 'EUR', startDate: null, endDate: null, memberIds: [bob.id]})
  const e = await createExpense(s, ctx, expense({groupId: g.id, split: {mode: 'equal', participants: ['me', bob.id]}}))
  await deleteExpense(s, ctx, e.id)
  await s.transaction(async tx => {
    const row = (await tx.get('group', g.id))!
    await tx.put({...row, deleted: true, version: row.version + 1, updatedAt: ++clock})
  })
  expect(await codeOf(restoreExpense(s, ctx, e.id))).toBe('GROUP_DELETED')
})

test('M4: restore still works when everyone is live', async () => {
  const bob = await createPerson(s, ctx, {name: 'Bob'})
  const e = await createExpense(s, ctx, expense({split: {mode: 'equal', participants: ['me', bob.id]}}))
  await deleteExpense(s, ctx, e.id)
  await restoreExpense(s, ctx, e.id)
  expect((await s.get('expense', e.id))?.deleted).toBe(false)
})

/* ------------------------- m11: idempotent retries --------------------------- */

test('m11: a retry with the same id and the same data returns the stored payment', async () => {
  const bob = await createPerson(s, ctx, {name: 'Bob'})
  const a = await createRepayment(s, ctx, pay({id: 'payI', from: bob.id, to: 'me'}))
  const b = await createRepayment(s, ctx, pay({id: 'payI', from: bob.id, to: 'me'}))
  expect(b.version).toBe(a.version)
  expect(await s.history('repayment', 'payI')).toHaveLength(1)
})

test('m11: a retry that hits a tombstone or different data is an IDEMPOTENCY_CONFLICT', async () => {
  const bob = await createPerson(s, ctx, {name: 'Bob'})
  await createRepayment(s, ctx, pay({id: 'payI', from: bob.id, to: 'me', amount: 50n}))
  expect(await codeOf(createRepayment(s, ctx, pay({id: 'payI', from: bob.id, to: 'me', amount: 999n})))).toBe('IDEMPOTENCY_CONFLICT')
  await deleteRepayment(s, ctx, 'payI')
  expect(await codeOf(createRepayment(s, ctx, pay({id: 'payI', from: bob.id, to: 'me', amount: 50n})))).toBe('IDEMPOTENCY_CONFLICT')
  expect((await s.get('repayment', 'payI'))?.deleted).toBe(true)
})

test('m11: the same holds for write-offs, and a conflicting batch writes nothing', async () => {
  const bob = await createPerson(s, ctx, {name: 'Bob'})
  await createWriteOffs(s, ctx, [pay({id: 'w1', from: bob.id, to: 'me', amount: 70n})])
  const batch = [pay({id: 'w2', from: bob.id, to: 'me', amount: 10n}), pay({id: 'w1', from: bob.id, to: 'me', amount: 71n})]
  expect(await codeOf(createWriteOffs(s, ctx, batch))).toBe('IDEMPOTENCY_CONFLICT')
  expect(await s.get('writeoff', 'w2')).toBeUndefined()
})

/* ------------------------- m15: search tie-break ----------------------------- */

test('m15: same-day search results list the later-created expense first, whatever the ids', async () => {
  // Ids sort the opposite way round to creation order.
  // (every write takes an entity id, then an outbox op id)
  const ids = ['zzz', 'op1', 'mmm', 'op2', 'aaa', 'op3']
  let i = 0
  const orderCtx: MutationCtx = {...ctx, newId: () => ids[i++]!}
  const first = await createExpense(s, orderCtx, expense({title: 'Taxi one'}))
  const second = await createExpense(s, orderCtx, expense({title: 'Taxi two'}))
  const third = await createExpense(s, orderCtx, expense({title: 'Taxi three'}))
  expect([first.id, second.id, third.id]).toEqual(['zzz', 'mmm', 'aaa'])
  const search = await searchStore(s, 'taxi', {today: '2026-10-27'})
  expect(search.expenses.map(e => e.id)).toEqual(['aaa', 'mmm', 'zzz'])
})

/* ------------------- m19, m20: who and what was recently active ---------------- */

test('m19: deleting an expense in a group moves the group up, and the people on it', async () => {
  const bob = await createPerson(s, ctx, {name: 'Bob'})
  const flat = await createGroup(s, ctx, {name: 'Flat', kind: 'home', currency: 'EUR', startDate: null, endDate: null, memberIds: [bob.id]})
  const trip = await createGroup(s, ctx, {name: 'Trip', kind: 'trip', currency: 'EUR', startDate: null, endDate: null, memberIds: [bob.id]})
  const e = await createExpense(s, ctx, expense({groupId: flat.id, split: {mode: 'equal', participants: ['me', bob.id]}}))
  expect([...(await s.groupActivity()).keys()][0]).toBe(flat.id)
  await createExpense(s, ctx, expense({groupId: trip.id, split: {mode: 'equal', participants: ['me', bob.id]}}))
  expect([...(await s.groupActivity()).keys()][0]).toBe(trip.id)
  await deleteExpense(s, ctx, e.id)
  expect([...(await s.groupActivity()).keys()][0]).toBe(flat.id)
  expect((await s.lastActivity()).get(bob.id)).toBe((await s.get('expense', e.id))!.updatedAt)
})

test('m20: a record I am not on does not make a friend recently active', async () => {
  const bob = await createPerson(s, ctx, {name: 'Bob'})
  const carol = await createPerson(s, ctx, {name: 'Carol'})
  const g = await createGroup(s, ctx, {name: 'Pair', kind: 'other', currency: 'EUR', startDate: null, endDate: null, memberIds: [bob.id, carol.id]})
  await createExpense(s, ctx, expense({groupId: g.id, payers: {[bob.id]: 3000n}, split: {mode: 'equal', participants: [bob.id, carol.id]}}))
  expect((await s.lastActivity()).has(bob.id)).toBe(false)
  expect((await s.lastActivity()).has(carol.id)).toBe(false)
  const mine = await createExpense(s, ctx, expense({split: {mode: 'equal', participants: ['me', carol.id]}}))
  const last = await s.lastActivity()
  expect(last.get(carol.id)).toBe(mine.updatedAt)
  expect(last.has(bob.id)).toBe(false)
  // The rebuilt projection agrees.
  await s.rebuildProjections()
  expect(await s.lastActivity()).toEqual(last)
})

test('a comment on a record is activity for its group and the friends on it, live and rebuilt (owner 199)', async () => {
  const bob = await createPerson(s, ctx, {name: 'Bob'})
  const carol = await createPerson(s, ctx, {name: 'Carol'})
  const flat = await createGroup(s, ctx, {name: 'Flat', kind: 'home', currency: 'EUR', startDate: null, endDate: null, memberIds: [bob.id, carol.id]})
  const trip = await createGroup(s, ctx, {name: 'Trip', kind: 'trip', currency: 'EUR', startDate: null, endDate: null, memberIds: [bob.id, carol.id]})
  const e = await createExpense(s, ctx, expense({groupId: flat.id, split: {mode: 'equal', participants: ['me', bob.id]}}))
  await createExpense(s, ctx, expense({groupId: trip.id, split: {mode: 'equal', participants: ['me', carol.id]}}))
  expect([...(await s.groupActivity()).keys()][0]).toBe(trip.id)
  const c = await createComment(s, ctx, {targetType: 'expense', targetId: e.id, body: 'ok?'})
  const groups = await s.groupActivity()
  expect([...groups.keys()][0]).toBe(flat.id)
  expect(groups.get(flat.id)).toBe(c.updatedAt)
  const people = await s.lastActivity()
  expect(people.get(bob.id)).toBe(c.updatedAt)
  expect(people.get(carol.id)).toBeLessThan(c.updatedAt)
  // Deleting the comment is a change too.
  await deleteComment(s, ctx, c.id)
  const after = (await s.lastActivity()).get(bob.id)!
  expect(after).toBeGreaterThan(c.updatedAt)
  // The rebuilt projection agrees.
  const live = [(await s.groupActivity()), (await s.lastActivity())]
  await s.rebuildProjections()
  expect([await s.groupActivity(), await s.lastActivity()]).toEqual(live)
})
