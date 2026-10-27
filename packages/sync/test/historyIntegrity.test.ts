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
  deleteRepayment,
  deleteWriteOff,
  ensureMe,
  type ExpenseDraft,
  purgeDeleted,
  type RepaymentInput,
  restoreExpense,
  restoreRepayment,
  restoreWriteOff,
} from '../src/mutations'
import {setPref} from '../src/preferences'
import {searchStore} from '../src/search'
import {openSqlStore} from '../src/sqlStore'
import type {Store} from '../src/store'
import type {MutationCtx} from '../src/types'
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

test('M4: a person named by a deleted expense or payment cannot be deleted', async () => {
  const bob = await createPerson(s, ctx, {name: 'Bob'})
  const e = await createExpense(s, ctx, expense({split: {mode: 'equal', participants: ['me', bob.id]}}))
  const r = await createRepayment(s, ctx, pay({from: bob.id, to: 'me'}))
  await deleteExpense(s, ctx, e.id)
  await deleteRepayment(s, ctx, r.id)
  expect(await codeOf(deletePerson(s, ctx, bob.id))).toBe('PERSON_IN_USE')
  // Delete forever takes them out of the bin, so Bob is free to go.
  await purgeDeleted(s, ctx, 'expense', e.id)
  await purgeDeleted(s, ctx, 'repayment', r.id)
  await deletePerson(s, ctx, bob.id)
  expect((await s.get('person', bob.id))?.deleted).toBe(true)
})

test('M4: a deleted item older than the bin window no longer holds its person', async () => {
  await setPref(s, ctx, 'history.binDays', 7)
  const bob = await createPerson(s, ctx, {name: 'Bob'})
  const e = await createExpense(s, ctx, expense({split: {mode: 'equal', participants: ['me', bob.id]}}))
  await deleteExpense(s, ctx, e.id)
  clock += 8 * 86_400_000
  await deletePerson(s, ctx, bob.id)
})

test('M4: restore refuses a record whose person is gone, with an explanation code', async () => {
  const bob = await createPerson(s, ctx, {name: 'Bob'})
  const e = await createExpense(s, ctx, expense({split: {mode: 'equal', participants: ['me', bob.id]}}))
  const r = await createRepayment(s, ctx, pay({from: bob.id, to: 'me'}))
  const w = (await createWriteOffs(s, ctx, [pay({from: bob.id, to: 'me', amount: 100n})]))[0]!
  await deleteExpense(s, ctx, e.id)
  await deleteRepayment(s, ctx, r.id)
  await deleteWriteOff(s, ctx, w.id)
  // Out of the window the guard in deletePerson no longer holds Bob (legacy data or a purged window): the restore must.
  await purgeDeleted(s, ctx, 'expense', e.id).catch(() => undefined)
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

/* ---------------------------- m17: purge payload ----------------------------- */

test('m17: the outbox op of a purge keeps purgedAt, so other devices cannot restore it', async () => {
  const bob = await createPerson(s, ctx, {name: 'Bob'})
  const e = await createExpense(s, ctx, expense({split: {mode: 'equal', participants: ['me', bob.id]}}))
  await deleteExpense(s, ctx, e.id)
  await purgeDeleted(s, ctx, 'expense', e.id)
  const ops = (await s.outbox()).filter(o => o.entityId === e.id)
  expect(ops.map(o => o.opType)).toEqual(['expense.create', 'expense.delete', 'expense.purge'])
  expect(ops[1]!.payload).toEqual({deleted: true})
  const purge = ops[2]!.payload as {deleted: boolean; purgedAt: number}
  expect(purge.deleted).toBe(true)
  expect(purge.purgedAt).toBe(((await s.get('expense', e.id))!.data as {purgedAt: number}).purgedAt)
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

test('restoring keeps working after the purge and restore helpers are used together', async () => {
  const bob = await createPerson(s, ctx, {name: 'Bob'})
  const e = await createExpense(s, ctx, expense({split: {mode: 'equal', participants: ['me', bob.id]}}))
  await deleteExpense(s, ctx, e.id)
  await purgeDeleted(s, ctx, 'expense', e.id)
  expect(await codeOf(restoreExpense(s, ctx, e.id))).toBe('NOT_FOUND')
})
