import {beforeEach, expect, test} from 'bun:test'
import {groupNet, pairwiseBalances, personSummary, planSettlement} from '@splito/domain'

import {
  createExpense,
  createGroup,
  createPerson,
  createRepayment,
  createRepayments,
  deletePerson,
  deleteRepayment,
  ensureMe,
  type ExpenseDraft,
  type RepaymentInput,
  restoreRepayment,
  addGroupMembers,
  updateGroupRules,
  updatePerson,
} from '../src/mutations'
import {loadLedger} from '../src/selectors'
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

const pay = (over: Partial<RepaymentInput>): RepaymentInput => ({
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

test('A04: direct 100 + group 50 = 150; without groups = 100', async () => {
  const x = await createPerson(s, ctx, {name: 'Riya'})
  const g = await createGroup(s, ctx, {name: 'Goa', kind: 'trip', currency: 'INR', memberIds: [x.id], startDate: null, endDate: null})
  await createExpense(s, ctx, expense({split: {mode: 'equal', participants: ['me', x.id]}}))
  await createExpense(s, ctx, expense({groupId: g.id, total: 100n, payers: {me: 100n}, split: {mode: 'equal', participants: ['me', x.id]}}))
  const rows = pairwiseBalances(await loadLedger(s), 'me')
  expect(personSummary(rows, {includeGroups: true})[0]!.byCurrency.INR!.total).toBe(150n)
  expect(personSummary(rows, {includeGroups: false})[0]!.byCurrency.INR!.total).toBe(100n)
})

test('a repayment is a ledger record: entity, history and outbox in one write; balances follow', async () => {
  const x = await createPerson(s, ctx, {name: 'Riya'})
  await createExpense(s, ctx, expense({split: {mode: 'equal', participants: ['me', x.id]}}))
  const r = await createRepayment(s, ctx, pay({from: x.id, to: 'me', amount: 40n, note: '  cash  '}))
  expect(r.data).toMatchObject({from: x.id, to: 'me', amount: 40n, note: 'cash'})
  expect(await s.history('repayment', r.id)).toHaveLength(1)
  expect((await s.outbox()).filter(o => o.entityId === r.id).map(o => o.opType)).toEqual(['repayment.create'])
  expect((await loadLedger(s)).find(l => l.id === r.id)).toMatchObject({kind: 'repayment', from: x.id, to: 'me', amount: 40n})
  expect(pairwiseBalances(await loadLedger(s), 'me')).toEqual([{person: x.id, groupId: null, currency: 'INR', amount: 60n}])
})

test('the same repayment id twice records one payment (idempotent)', async () => {
  const x = await createPerson(s, ctx, {name: 'Riya'})
  const a = await createRepayment(s, ctx, pay({id: 'pay-1', from: 'me', to: x.id}))
  const b = await createRepayment(s, ctx, pay({id: 'pay-1', from: 'me', to: x.id}))
  expect(b).toEqual(a)
  expect(await s.getAll('repayment')).toHaveLength(1)
  expect((await s.outbox()).filter(o => o.entityId === 'pay-1')).toHaveLength(1)
})

test('invalid repayments leave nothing behind', async () => {
  const x = await createPerson(s, ctx, {name: 'Riya'})
  const y = await createPerson(s, ctx, {name: 'Sam'})
  const g = await createGroup(s, ctx, {name: 'Goa', kind: 'trip', currency: 'INR', memberIds: [x.id], startDate: null, endDate: null})
  await expect(createRepayment(s, ctx, pay({to: 'me'}))).rejects.toThrow('SAME_PERSON')
  await expect(createRepayment(s, ctx, pay({to: x.id, amount: 0n}))).rejects.toThrow('INVALID_AMOUNT')
  await expect(createRepayment(s, ctx, pay({to: x.id, amount: -5n}))).rejects.toThrow('INVALID_AMOUNT')
  await expect(createRepayment(s, ctx, pay({to: x.id, currency: 'XXX'}))).rejects.toThrow('UNKNOWN_CURRENCY')
  await expect(createRepayment(s, ctx, pay({to: 'ghost'}))).rejects.toThrow('UNKNOWN_PERSON')
  await expect(createRepayment(s, ctx, pay({to: x.id, date: '2026-02-30'}))).rejects.toThrow('INVALID_DATE')
  await expect(createRepayment(s, ctx, pay({to: y.id, groupId: g.id}))).rejects.toThrow('NOT_A_MEMBER')
  expect(await s.getAll('repayment')).toEqual([])
})

test('deleting a repayment is a tombstone; restore brings the balance back', async () => {
  const x = await createPerson(s, ctx, {name: 'Riya'})
  const r = await createRepayment(s, ctx, pay({from: 'me', to: x.id, amount: 70n}))
  await deleteRepayment(s, ctx, r.id)
  expect(pairwiseBalances(await loadLedger(s), 'me')).toEqual([])
  await restoreRepayment(s, ctx, r.id)
  expect(pairwiseBalances(await loadLedger(s), 'me')).toEqual([{person: x.id, groupId: null, currency: 'INR', amount: 70n}])
  expect((await s.history('repayment', r.id)).map(h => h.deleted)).toEqual([false, true, false])
  await expect(restoreRepayment(s, ctx, r.id)).rejects.toThrow('NOT_FOUND')
})

test('a person with repayments is in use', async () => {
  const x = await createPerson(s, ctx, {name: 'Riya'})
  await createRepayment(s, ctx, pay({from: 'me', to: x.id}))
  await expect(deletePerson(s, ctx, x.id)).rejects.toThrow('PERSON_IN_USE')
})

test('group repayments move the group net; a group settles to zero', async () => {
  const x = await createPerson(s, ctx, {name: 'Riya'})
  const g = await createGroup(s, ctx, {name: 'Goa', kind: 'trip', currency: 'INR', memberIds: [x.id], startDate: null, endDate: null})
  await createExpense(s, ctx, expense({groupId: g.id, split: {mode: 'equal', participants: ['me', x.id]}}))
  expect(groupNet(await loadLedger(s), g.id)).toEqual({INR: {me: 100n, [x.id]: -100n}})
  await createRepayment(s, ctx, pay({groupId: g.id, from: x.id, to: 'me', amount: 100n}))
  expect(groupNet(await loadLedger(s), g.id)).toEqual({INR: {me: 0n, [x.id]: 0n}})
})

test("a friend's payment split across direct and group parts clears every view, once", async () => {
  const x = await createPerson(s, ctx, {name: 'Riya'})
  const g = await createGroup(s, ctx, {name: 'Goa', kind: 'trip', currency: 'INR', memberIds: [x.id], startDate: null, endDate: null})
  await createExpense(s, ctx, expense({split: {mode: 'equal', participants: ['me', x.id]}}))
  await createExpense(s, ctx, expense({groupId: g.id, split: {mode: 'equal', participants: ['me', x.id]}}))
  const parts = [pay({id: 'p1', from: x.id, to: 'me'}), pay({id: 'p2', from: x.id, to: 'me', groupId: g.id})]
  await createRepayments(s, ctx, parts)
  await createRepayments(s, ctx, parts)
  expect(pairwiseBalances(await loadLedger(s), 'me')).toEqual([])
  expect(groupNet(await loadLedger(s), g.id)).toEqual({INR: {me: 0n, [x.id]: 0n}})
  expect((await s.getAll('repayment')).length).toBe(2)
})

test('a batch with one bad part records nothing', async () => {
  const x = await createPerson(s, ctx, {name: 'Riya'})
  const y = await createPerson(s, ctx, {name: 'Sam'})
  const g = await createGroup(s, ctx, {name: 'Goa', kind: 'trip', currency: 'INR', memberIds: [x.id], startDate: null, endDate: null})
  await expect(
    createRepayments(s, ctx, [pay({id: 'ok', from: y.id, to: 'me'}), pay({id: 'bad', from: y.id, to: 'me', groupId: g.id})]),
  ).rejects.toThrow('NOT_A_MEMBER')
  expect(await s.getAll('repayment')).toEqual([])
})

test('A07: rules stored per group; A->C excluded is infeasible direct, feasible via B', async () => {
  const b = await createPerson(s, ctx, {name: 'B'})
  const c = await createPerson(s, ctx, {name: 'C'})
  const g = await createGroup(s, ctx, {name: 'Trip', kind: 'trip', currency: 'INR', memberIds: [b.id, c.id], startDate: null, endDate: null})
  // C paid 100 for me (A): A owes C 100.
  await createExpense(s, ctx, expense({groupId: g.id, total: 100n, payers: {[c.id]: 100n}, split: {mode: 'equal', participants: ['me']}}))
  const updated = await updateGroupRules(s, ctx, g.id, {allowListOnly: false, edges: {[`me>${c.id}`]: 'excluded'}})
  expect(updated.data.rules).toEqual({allowListOnly: false, edges: {[`me>${c.id}`]: 'excluded'}})
  expect((await s.outbox()).filter(o => o.entityId === g.id).map(o => o.opType)).toEqual(['group.create', 'group.rules'])

  // B has no records yet, so the plan input lists every member with a zero default.
  const net = {me: 0n, [b.id]: 0n, [c.id]: 0n, ...groupNet(await loadLedger(s), g.id).INR}
  const direct = planSettlement(net, updated.data.rules!, 'direct')
  expect(direct).toMatchObject({status: 'infeasible', stuck: ['me']})
  const transit = planSettlement(net, updated.data.rules!, 'transit', [b.id])
  expect(transit.status).toBe('ok')
  if (transit.status === 'ok')
    expect([...transit.transfers].sort((x, y) => (x.from === 'me' ? -1 : y.from === 'me' ? 1 : 0))).toEqual([
      {from: 'me', to: b.id, amount: 100n},
      {from: b.id, to: c.id, amount: 100n},
    ])
})

test('group rules are validated against the members', async () => {
  const x = await createPerson(s, ctx, {name: 'Riya'})
  const g = await createGroup(s, ctx, {name: 'Goa', kind: 'trip', currency: 'INR', memberIds: [x.id], startDate: null, endDate: null})
  await expect(updateGroupRules(s, ctx, g.id, {allowListOnly: false, edges: {'me>ghost': 'allowed'}})).rejects.toThrow('INVALID_RULES')
  await expect(updateGroupRules(s, ctx, g.id, {allowListOnly: false, edges: {'me>me': 'allowed'}})).rejects.toThrow('INVALID_RULES')
  await expect(updateGroupRules(s, ctx, g.id, {allowListOnly: false, edges: {[`me>${x.id}`]: 'maybe' as never}})).rejects.toThrow('INVALID_RULES')
  await expect(updateGroupRules(s, ctx, 'nope', {allowListOnly: false, edges: {}})).rejects.toThrow('NOT_FOUND')
})

test('updatePerson renames and stores a UPI ID; bad IDs rejected', async () => {
  const x = await createPerson(s, ctx, {name: 'Riya', upiId: 'riya@okaxis'})
  expect(x.data.upiId).toBe('riya@okaxis')
  const u = await updatePerson(s, ctx, x.id, {name: 'Riya S', upiId: ''})
  expect(u.data).toEqual({name: 'Riya S', isMe: false, upiId: null})
  await expect(updatePerson(s, ctx, x.id, {name: 'Riya', upiId: 'not a vpa'})).rejects.toThrow('INVALID_UPI')
  await expect(createPerson(s, ctx, {name: 'Sam', upiId: '@bank'})).rejects.toThrow('INVALID_UPI')
})

test('addGroupMembers adds new people once; their earlier splits are untouched', async () => {
  const x = await createPerson(s, ctx, {name: 'Riya'})
  const y = await createPerson(s, ctx, {name: 'Sam'})
  const g = await createGroup(s, ctx, {name: 'Goa', kind: 'trip', currency: 'INR', memberIds: [x.id], startDate: null, endDate: null})
  await createExpense(s, ctx, expense({groupId: g.id, split: {mode: 'equal', participants: ['me', x.id]}}))
  const before = groupNet(await loadLedger(s), g.id)
  const u = await addGroupMembers(s, ctx, g.id, [y.id, y.id, x.id])
  expect(u.data.members.map(m => m.personId)).toEqual(['me', x.id, y.id])
  expect(groupNet(await loadLedger(s), g.id)).toEqual(before)
  await createExpense(s, ctx, expense({groupId: g.id, payers: {[y.id]: 200n}, split: {mode: 'equal', participants: ['me', y.id]}}))
  await expect(addGroupMembers(s, ctx, g.id, ['ghost'])).rejects.toThrow('UNKNOWN_PERSON')
})
