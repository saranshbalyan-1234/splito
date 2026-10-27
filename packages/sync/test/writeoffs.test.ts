import {beforeEach, expect, test} from 'bun:test'
import {groupNet, pairwiseBalances, selectExpenses} from '@splito/domain'

import {activityFromHistory, loadActivity} from '../src/activity'
import {
  createExpense,
  createGroup,
  createPerson,
  createRepayment,
  createWriteOffs,
  deleteExpense,
  deleteRepayment,
  deleteWriteOff,
  deleteWriteOffs,
  ensureMe,
  type ExpenseDraft,
  restoreExpense,
  restoreRepayment,
  restoreWriteOff,
  type WriteOffInput,
} from '../src/mutations'
import {getPref, setPref} from '../src/preferences'
import {loadLedger} from '../src/selectors'
import {openSqlStore} from '../src/sqlStore'
import {type Store} from '../src/store'
import {type MutationCtx} from '../src/types'
import {bunExecutor} from './bunExecutor'

const DAY = 86_400_000
let s: Store
let ctx: MutationCtx
let n = 0
let clock = 0
beforeEach(async () => {
  n = 0
  clock = 1_000_000
  s = await openSqlStore(bunExecutor(':memory:'))
  ctx = {deviceId: 'dev1', actor: 'me', now: () => clock + n, newId: () => 'id' + ++n}
  await ensureMe(s, ctx, 'Me')
})

const expense = (over: Partial<ExpenseDraft>): ExpenseDraft => ({
  title: 'Dinner',
  groupId: null,
  currency: 'INR',
  total: 200n,
  payers: {me: 200n},
  split: {mode: 'equal', participants: ['me']},
  date: '2026-10-26',
  tz: 'Asia/Kolkata',
  category: 'food',
  notes: '',
  ...over,
})

const off = (over: Partial<WriteOffInput>): WriteOffInput => ({
  groupId: null,
  currency: 'INR',
  from: 'me',
  to: 'me',
  amount: 100n,
  date: '2026-10-26',
  tz: 'Asia/Kolkata',
  note: '',
  ...over,
})

/* F-1113 Call it even */

test('a write-off is its own ledger kind: entity, history and outbox; the pair balance clears per currency only', async () => {
  const x = await createPerson(s, ctx, {name: 'Riya'})
  const y = await createPerson(s, ctx, {name: 'Sam'})
  await createExpense(s, ctx, expense({split: {mode: 'equal', participants: ['me', x.id]}}))
  await createExpense(s, ctx, expense({currency: 'EUR', total: 40n, payers: {me: 40n}, split: {mode: 'equal', participants: ['me', x.id]}}))
  await createExpense(s, ctx, expense({split: {mode: 'equal', participants: ['me', y.id]}}))
  const [w] = await createWriteOffs(s, ctx, [off({from: x.id, to: 'me', amount: 100n, note: '  birthday  '})])
  expect(w!.data).toMatchObject({from: x.id, to: 'me', amount: 100n, note: 'birthday'})
  expect(await s.history('writeoff', w!.id)).toHaveLength(1)
  expect((await s.outbox()).filter(o => o.entityId === w!.id).map(o => o.opType)).toEqual(['writeoff.create'])
  const ledger = await loadLedger(s)
  expect(ledger.find(l => l.id === w!.id)).toMatchObject({kind: 'writeoff', from: x.id, to: 'me', amount: 100n})
  expect(pairwiseBalances(ledger, 'me')).toEqual([
    {person: x.id, groupId: null, currency: 'EUR', amount: 20n},
    {person: y.id, groupId: null, currency: 'INR', amount: 100n},
  ])
  // Never a repayment, never spending.
  expect(await s.getAll('repayment')).toEqual([])
  const f = {currency: 'INR', range: {from: '2026-01-01', to: '2026-12-31'}, includeGroups: true}
  expect(selectExpenses(ledger, f).map(e => e.id)).not.toContain(w!.id)
})

test('write-offs are idempotent by id, atomic, and validated like payments', async () => {
  const x = await createPerson(s, ctx, {name: 'Riya'})
  const y = await createPerson(s, ctx, {name: 'Sam'})
  const g = await createGroup(s, ctx, {name: 'Goa', kind: 'trip', currency: 'INR', memberIds: [x.id], startDate: null, endDate: null})
  await createWriteOffs(s, ctx, [off({id: 'w1', from: x.id, to: 'me'})])
  await createWriteOffs(s, ctx, [off({id: 'w1', from: x.id, to: 'me'})])
  expect(await s.getAll('writeoff')).toHaveLength(1)
  await expect(createWriteOffs(s, ctx, [off({id: 'ok', from: y.id, to: 'me'}), off({id: 'bad', from: y.id, to: 'me', groupId: g.id})])).rejects.toThrow(
    'NOT_A_MEMBER',
  )
  await expect(createWriteOffs(s, ctx, [off({to: 'me'})])).rejects.toThrow('SAME_PERSON')
  await expect(createWriteOffs(s, ctx, [off({to: x.id, amount: 0n})])).rejects.toThrow('INVALID_AMOUNT')
  expect(await s.getAll('writeoff')).toHaveLength(1)
})

test('a group write-off moves the group net, and undo (delete) puts it back; restore re-applies it', async () => {
  const x = await createPerson(s, ctx, {name: 'Riya'})
  const g = await createGroup(s, ctx, {name: 'Goa', kind: 'trip', currency: 'INR', memberIds: [x.id], startDate: null, endDate: null})
  await createExpense(s, ctx, expense({groupId: g.id, split: {mode: 'equal', participants: ['me', x.id]}}))
  const [w] = await createWriteOffs(s, ctx, [off({groupId: g.id, from: x.id, to: 'me', amount: 100n})])
  expect(groupNet(await loadLedger(s), g.id)).toEqual({INR: {me: 0n, [x.id]: 0n}})
  await deleteWriteOff(s, ctx, w!.id)
  expect(groupNet(await loadLedger(s), g.id)).toEqual({INR: {me: 100n, [x.id]: -100n}})
  await restoreWriteOff(s, ctx, w!.id)
  expect(groupNet(await loadLedger(s), g.id)).toEqual({INR: {me: 0n, [x.id]: 0n}})
  expect((await s.history('writeoff', w!.id)).map(h => h.deleted)).toEqual([false, true, false])
})

/* F-113 m16: undoing Call it even is one transaction. */
test('undoing several write-offs is all or none', async () => {
  const x = await createPerson(s, ctx, {name: 'Riya'})
  const g = await createGroup(s, ctx, {name: 'Goa', kind: 'trip', currency: 'INR', memberIds: [x.id], startDate: null, endDate: null})
  const written = await createWriteOffs(s, ctx, [off({id: 'w1', from: x.id, to: 'me'}), off({id: 'w2', groupId: g.id, from: x.id, to: 'me'})])
  // The second id is already gone: nothing may be undone.
  await deleteWriteOff(s, ctx, 'w2')
  await expect(deleteWriteOffs(s, ctx, ['w1', 'w2'])).rejects.toThrow('NOT_FOUND')
  expect((await s.getAll('writeoff')).find(w => w.id === 'w1')?.deleted).toBe(false)
  await restoreWriteOff(s, ctx, 'w2')
  await deleteWriteOffs(s, ctx, written.map(w => w.id))
  expect((await s.getAll('writeoff')).map(w => w.deleted)).toEqual([true, true])
  expect((await s.outbox()).filter(o => o.opType === 'writeoff.delete').map(o => o.entityId)).toEqual(['w2', 'w1', 'w2'])
})

test('write-offs show in Activity as recorded and removed', async () => {
  const x = await createPerson(s, ctx, {name: 'Riya'})
  const [w] = await createWriteOffs(s, ctx, [off({from: x.id, to: 'me'})])
  await deleteWriteOff(s, ctx, w!.id)
  const kinds = (await loadActivity(s)).filter(e => e.entityType === 'writeoff').map(e => e.kind)
  expect(kinds).toEqual(['writeoff.removed', 'writeoff.recorded'])
  expect(activityFromHistory(await s.history('writeoff', w!.id)).map(e => e.kind)).toEqual(['writeoff.removed', 'writeoff.recorded'])
})

/* F-1203 Deleted items stay in place */

test('restore brings the balance back; restoring twice fails', async () => {
  const x = await createPerson(s, ctx, {name: 'Riya'})
  const e = await createExpense(s, ctx, expense({split: {mode: 'equal', participants: ['me', x.id]}}))
  await deleteExpense(s, ctx, e.id)
  expect(pairwiseBalances(await loadLedger(s), 'me')).toEqual([])
  await restoreExpense(s, ctx, e.id)
  expect(pairwiseBalances(await loadLedger(s), 'me')).toEqual([{person: x.id, groupId: null, currency: 'INR', amount: 100n}])
  await expect(restoreExpense(s, ctx, e.id)).rejects.toThrow('NOT_FOUND')
})

