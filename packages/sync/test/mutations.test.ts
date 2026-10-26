import {beforeEach, expect, test} from 'bun:test'
import {pairwiseBalances} from '@splito/domain'

import {
  createExpense,
  createGroup,
  createPerson,
  deleteExpense,
  deletePerson,
  type ExpenseDraft,
  ensureMe,
  restoreExpense,
  updateExpense,
} from '../src/mutations'
import {loadLedger, syncStatus} from '../src/selectors'
import {openSqlStore} from '../src/sqlStore'
import type {Store} from '../src/store'
import type {MutationCtx} from '../src/types'
import {bunExecutor} from './bunExecutor'

let s: Store
let ctx: MutationCtx
let n = 0
beforeEach(async () => {
  s = await openSqlStore(bunExecutor(':memory:'))
  ctx = {deviceId: 'dev1', actor: 'me', now: () => 1000 + n, newId: () => 'id' + ++n}
  await ensureMe(s, ctx, 'Me')
})

const draft = (x: string, over: Partial<ExpenseDraft> = {}): ExpenseDraft => ({
  title: 'Dinner',
  groupId: null,
  currency: 'INR',
  total: 100n,
  payers: {me: 100n},
  split: {mode: 'equal', participants: ['me', x]},
  date: '2026-10-26',
  tz: 'Asia/Kolkata',
  category: 'food',
  notes: '',
  ...over,
})

test('ensureMe is idempotent', async () => {
  await ensureMe(s, ctx, 'Me again')
  expect((await s.getAll('person')).map(p => p.id)).toEqual(['me'])
})

test('createExpense writes entity, history v1 and one outbox op atomically', async () => {
  const x = await createPerson(s, ctx, {name: 'Riya'})
  const e = await createExpense(s, ctx, draft(x.id))
  expect(e.version).toBe(1)
  expect(e.data.shares).toEqual({me: 50n, [x.id]: 50n})
  expect(await s.history('expense', e.id)).toHaveLength(1)
  const ops = (await s.outbox()).filter(o => o.entityId === e.id)
  expect(ops).toMatchObject([{opType: 'expense.create', baseVersion: 0, deviceId: 'dev1', actor: 'me'}])
})

test('invalid split leaves nothing behind', async () => {
  const x = await createPerson(s, ctx, {name: 'Riya'})
  const before = (await s.outbox()).length
  await expect(createExpense(s, ctx, draft(x.id, {split: {mode: 'exact', amounts: {me: 1n}}}))).rejects.toThrow('TOTAL_MISMATCH')
  expect(await s.getAll('expense')).toEqual([])
  expect(await s.outbox()).toHaveLength(before)
})

test('blank person name rejected', async () => expect(createPerson(s, ctx, {name: '  '})).rejects.toThrow('INVALID_NAME'))

test('unknown participant rejected', async () =>
  expect(createExpense(s, ctx, draft('ghost'))).rejects.toThrow('UNKNOWN_PERSON'))

test('update bumps version and keeps history v1 and v2', async () => {
  const x = await createPerson(s, ctx, {name: 'Riya'})
  const e = await createExpense(s, ctx, draft(x.id))
  const u = await updateExpense(s, ctx, e.id, draft(x.id, {total: 300n, payers: {me: 300n}}))
  expect(u.version).toBe(2)
  expect(u.data.shares).toEqual({me: 150n, [x.id]: 150n})
  expect((await s.history('expense', e.id)).map(h => h.version)).toEqual([1, 2])
  expect((await s.outbox()).filter(o => o.entityId === e.id).map(o => [o.opType, o.baseVersion])).toEqual([
    ['expense.create', 0],
    ['expense.update', 1],
  ])
})

test('delete is a tombstone; restore brings it back; balances follow', async () => {
  const x = await createPerson(s, ctx, {name: 'Riya'})
  const e = await createExpense(s, ctx, draft(x.id))
  await deleteExpense(s, ctx, e.id)
  expect((await s.getAll('expense'))[0]!.deleted).toBe(true)
  expect(pairwiseBalances(await loadLedger(s), 'me')).toEqual([])
  await restoreExpense(s, ctx, e.id)
  expect(pairwiseBalances(await loadLedger(s), 'me')).toEqual([{person: x.id, groupId: null, currency: 'INR', amount: 50n}])
  expect((await s.history('expense', e.id)).map(h => h.deleted)).toEqual([false, true, false])
})

test('cannot update a deleted expense', async () => {
  const x = await createPerson(s, ctx, {name: 'Riya'})
  const e = await createExpense(s, ctx, draft(x.id))
  await deleteExpense(s, ctx, e.id)
  await expect(updateExpense(s, ctx, e.id, draft(x.id))).rejects.toThrow('NOT_FOUND')
})

test('deletePersonInUse', async () => {
  const x = await createPerson(s, ctx, {name: 'Riya'})
  await createExpense(s, ctx, draft(x.id))
  await expect(deletePerson(s, ctx, x.id)).rejects.toThrow('PERSON_IN_USE')
})

test('unused person can be deleted', async () => {
  const x = await createPerson(s, ctx, {name: 'Riya'})
  await deletePerson(s, ctx, x.id)
  expect((await s.getAll('person')).find(p => p.id === x.id)!.deleted).toBe(true)
})

test('group always includes me; group expense with non-member payer rejected', async () => {
  const x = await createPerson(s, ctx, {name: 'Riya'})
  const y = await createPerson(s, ctx, {name: 'Sam'})
  const g = await createGroup(s, ctx, {name: 'Goa', kind: 'trip', currency: 'INR', memberIds: [x.id], startDate: null, endDate: null})
  expect(g.data.members.map(m => m.personId).sort()).toEqual(['me', x.id].sort())
  await expect(createExpense(s, ctx, draft(x.id, {groupId: g.id, payers: {[y.id]: 100n}}))).rejects.toThrow('NOT_A_MEMBER')
  const ok = await createExpense(s, ctx, draft(x.id, {groupId: g.id}))
  expect(pairwiseBalances(await loadLedger(s), 'me')).toEqual([{person: x.id, groupId: g.id, currency: 'INR', amount: 50n}])
  expect(ok.data.groupId).toBe(g.id)
})

test('dates outside October 2026 accepted, invalid dates rejected', async () => {
  const x = await createPerson(s, ctx, {name: 'Riya'})
  for (const d of ['2019-03-01', '2031-12-31']) await createExpense(s, ctx, draft(x.id, {date: d}))
  await expect(createExpense(s, ctx, draft(x.id, {date: '2026-02-30'}))).rejects.toThrow('INVALID_DATE')
})

test('syncStatus is Saved on this device after create', async () => {
  const x = await createPerson(s, ctx, {name: 'Riya'})
  const e = await createExpense(s, ctx, draft(x.id))
  expect(await syncStatus(s, e.id)).toBe('Saved on this device')
})
