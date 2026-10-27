/**
 * F-1203 (owner 103 to 107): a deleted item stays in its list, forever. Lists read it through the same paged
 * indexes as live rows; balances, totals and search totals never count it; "Hide" is personal and only for
 * deleted items.
 */
import {beforeEach, expect, test} from 'bun:test'
import {sumByCurrency} from '@splito/domain'

import {
  createExpense,
  createGroup,
  createPerson,
  createRepayment,
  deleteExpense,
  deletePerson,
  deleteRepayment,
  ensureMe,
  type ExpenseDraft,
  restoreExpense,
  setItemHidden,
} from '../src/mutations'
import {deleteGroup} from '../src/groupLifecycle'
import {getPref, prefFrom} from '../src/preferences'
import {searchStore} from '../src/search'
import {openSqlStore} from '../src/sqlStore'
import {type Store} from '../src/store'
import {type MutationCtx} from '../src/types'
import {bunExecutor} from './bunExecutor'
import {expectDerivedTablesMatch} from './projectionCheck'

let s: Store
let ctx: MutationCtx
let n = 0
beforeEach(async () => {
  n = 0
  s = await openSqlStore(bunExecutor(':memory:'))
  ctx = {deviceId: 'dev1', actor: 'me', now: () => 1_000_000 + n, newId: () => 'id' + ++n}
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

const code = (p: Promise<unknown>) => p.then(() => 'ok', (e: Error) => e.message)

async function trip() {
  const bob = await createPerson(s, ctx, {name: 'Bob'})
  const g = await createGroup(s, ctx, {name: 'Trip', kind: 'trip', currency: 'INR', startDate: null, endDate: null, memberIds: [bob.id]})
  const keep = await createExpense(s, ctx, expense({title: 'Hotel', groupId: g.id, total: 1000n, payers: {me: 1000n}, split: {mode: 'equal', participants: ['me', bob.id]}, date: '2026-10-20'}))
  const gone = await createExpense(s, ctx, expense({title: 'Taxi ride', groupId: g.id, total: 400n, payers: {me: 400n}, split: {mode: 'equal', participants: ['me', bob.id]}, date: '2026-10-22'}))
  await deleteExpense(s, ctx, gone.id)
  return {bob, g, keep, gone}
}

test('the group list reads a deleted expense through byGroupDate, between the live ones by date; the balance drops it', async () => {
  const {bob, g, keep, gone} = await trip()
  const page = await s.page('expense', {index: 'byGroupDate', eq: [g.id], dir: 'prev'})
  expect(page.items.map(e => [e.id, e.deleted])).toEqual([[gone.id, true], [keep.id, false]])
  expect((await s.balances({groupId: g.id})).find(b => b.personId === bob.id)!.amount).toBe(-500n)
})

test('a person history reads a deleted expense through byPersonDate when asked, and never by default', async () => {
  const {bob, keep, gone} = await trip()
  const live = await s.parties({index: 'byPersonDate', eq: [bob.id], dir: 'prev'})
  expect(live.items.map(p => p.expenseId)).toEqual([keep.id])
  const all = await s.parties({index: 'byPersonDate', eq: [bob.id], dir: 'prev', includeDeleted: true})
  expect(all.items.map(p => [p.expenseId, p.deleted])).toEqual([[gone.id, true], [keep.id, false]])
  // A restore puts it back among the live ones, once.
  await restoreExpense(s, ctx, gone.id)
  const back = await s.parties({index: 'byPersonDate', eq: [bob.id], dir: 'prev', includeDeleted: true})
  expect(back.items.map(p => [p.expenseId, p.deleted])).toEqual([[gone.id, false], [keep.id, false]])
  await expectDerivedTablesMatch(s)
})

test('paging live parties skips tombstones without short pages or lost rows', async () => {
  const bob = await createPerson(s, ctx, {name: 'Bob'})
  const ids: string[] = []
  for (let i = 0; i < 6; i++) {
    const e = await createExpense(s, ctx, expense({title: `E${i}`, split: {mode: 'equal', participants: ['me', bob.id]}, date: `2026-10-0${i + 1}`}))
    ids.push(e.id)
  }
  await deleteExpense(s, ctx, ids[1]!)
  await deleteExpense(s, ctx, ids[2]!)
  await deleteExpense(s, ctx, ids[3]!)
  const first = await s.parties({index: 'byPersonDate', eq: [bob.id], dir: 'prev', limit: 2})
  expect(first.items.map(p => p.expenseId)).toEqual([ids[5]!, ids[4]!])
  const second = await s.parties({index: 'byPersonDate', eq: [bob.id], dir: 'prev', limit: 2, after: first.next})
  expect(second.items.map(p => p.expenseId)).toEqual([ids[0]!])
  expect(second.next).toBeNull()
})

test('search lists a deleted expense (narrow and broad) but its totals and count leave it out', async () => {
  const {gone} = await trip()
  const found = await searchStore(s, 'taxi', {today: '2026-10-27'})
  expect(found.expenses.map(e => [e.id, e.deleted])).toEqual([[gone.id, true]])
  expect(found.totals).toEqual({})
  // A live and a deleted match together: the list has both, the total only the live one.
  const live = await createExpense(s, ctx, expense({title: 'Taxi home', total: 100n, payers: {me: 100n}}))
  const both = await searchStore(s, 'taxi', {today: '2026-10-27'})
  expect(both.expenses.map(e => e.id).sort()).toEqual([gone.id, live.id].sort())
  expect(both.totals).toEqual({INR: 100n})
  // Amount search reaches the deleted one too.
  const byAmount = await searchStore(s, '4.00', {today: '2026-10-27'})
  expect(byAmount.expenses.map(e => e.id)).toContain(gone.id)
  expect(sumByCurrency(byAmount.expenses.filter(e => !e.deleted).map(e => ({currency: e.data.currency, amount: e.data.total})))).toEqual(byAmount.totals)
})

test('search lists a deleted group and a deleted friend, struck by the app', async () => {
  const {bob, g} = await trip()
  await deleteGroup(s, ctx, g.id)
  await deletePerson(s, ctx, bob.id)
  const byGroup = await searchStore(s, 'trip', {today: '2026-10-27'})
  expect(byGroup.groups.map(x => [x.id, x.deleted])).toEqual([[g.id, true]])
  const byPerson = await searchStore(s, 'bob', {today: '2026-10-27'})
  expect(byPerson.people.map(x => [x.id, x.deleted])).toEqual([[bob.id, true]])
})

test('a friend named only by a deleted payment can be deleted and stays as a tombstone', async () => {
  const bob = await createPerson(s, ctx, {name: 'Bob'})
  const r = await createRepayment(s, ctx, {groupId: null, currency: 'INR', from: bob.id, to: 'me', amount: 10n, date: '2026-10-26', tz: 'UTC', note: ''})
  await deleteRepayment(s, ctx, r.id)
  await deletePerson(s, ctx, bob.id)
  expect((await s.get('person', bob.id))!.deleted).toBe(true)
  expect((await s.page('person', {index: 'byName'})).items.map(p => p.id)).toContain(bob.id)
})

test('Hide works on a deleted item only; Unhide undoes it; the id set is one preference', async () => {
  const {gone, keep, bob} = await trip()
  expect(await code(setItemHidden(s, ctx, 'expense', keep.id, true))).toBe('NOT_DELETED')
  expect(await code(setItemHidden(s, ctx, 'person', bob.id, true))).toBe('NOT_DELETED')
  await setItemHidden(s, ctx, 'expense', gone.id, true)
  expect(await getPref(s, 'lists.hiddenItems')).toEqual([gone.id])
  // Idempotent, and the expense itself is untouched (nobody else sees a change).
  await setItemHidden(s, ctx, 'expense', gone.id, true)
  expect(await getPref(s, 'lists.hiddenItems')).toEqual([gone.id])
  expect((await s.get('expense', gone.id))!.version).toBe(2)
  expect((await s.outbox()).filter(o => o.entityId === gone.id).map(o => o.opType)).toEqual(['expense.create', 'expense.delete'])
  await setItemHidden(s, ctx, 'expense', gone.id, false)
  expect(await getPref(s, 'lists.hiddenItems')).toEqual([])
})

test('the hidden set defaults to empty and ignores a bad stored value', () => {
  expect(prefFrom([], 'lists.hiddenItems')).toEqual([])
  expect(prefFrom([{id: 'lists.hiddenItems', data: {value: 'x'}, deleted: false}] as never, 'lists.hiddenItems')).toEqual([])
})
