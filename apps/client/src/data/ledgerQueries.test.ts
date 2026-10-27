import 'fake-indexeddb/auto'

import {expect, test} from 'bun:test'
import {
  createExpense,
  createGroup,
  createPerson,
  createRepayment,
  deleteExpense,
  deleteRepayment,
  ensureMe,
  type Expense,
  type MutationCtx,
  openIdbStore,
  type Repayment,
} from '@splito/sync'
import {IDBFactory} from 'fake-indexeddb'

import {mergeHistory} from './historyMerge'
import {indexStream, partyStream} from './ledgerQueries'

let n = 0
const ctx: MutationCtx = {deviceId: 'd', actor: 'me', now: () => ++n, newId: () => `id${++n}`}

const draft = (title: string, date: string, over: Partial<Expense> = {}) => ({
  title,
  groupId: null,
  currency: 'INR',
  total: 200n,
  payers: {me: 200n},
  split: {mode: 'equal' as const, participants: ['me']},
  date,
  tz: 'UTC',
  category: 'food',
  notes: '',
  ...over,
})

async function setup() {
  const store = await openIdbStore(`q${++n}`, new IDBFactory())
  await ensureMe(store, ctx, 'Me')
  const bob = await createPerson(store, ctx, {name: 'Bob'})
  const g = await createGroup(store, ctx, {name: 'Trip', kind: 'trip', currency: 'INR', startDate: null, endDate: null, memberIds: [bob.id]})
  const split = {mode: 'equal' as const, participants: ['me', bob.id]}
  const live = await createExpense(store, ctx, draft('Hotel', '2026-10-20', {groupId: g.id, split}))
  const gone = await createExpense(store, ctx, draft('Taxi', '2026-10-22', {groupId: g.id, split}))
  const pay = await createRepayment(store, ctx, {groupId: g.id, currency: 'INR', from: bob.id, to: 'me', amount: 50n, date: '2026-10-21', tz: 'UTC', note: ''})
  await deleteExpense(store, ctx, gone.id)
  await deleteRepayment(store, ctx, pay.id)
  return {store, bob, g, live, gone, pay}
}

test('a group stream skips deleted rows unless asked, and with them they sit in date order', async () => {
  const {store, g, live, gone, pay} = await setup()
  const streams = (all: boolean) => [
    indexStream<Expense>(store, 'expense', {index: 'byGroupDate', eq: [g.id]}, undefined, all),
    indexStream<Repayment>(store, 'repayment', {index: 'byGroup', eq: [g.id]}, undefined, all),
  ]
  expect((await mergeHistory(streams(false), 10)).entries.map(e => e.entity.id)).toEqual([live.id])
  const all = (await mergeHistory(streams(true), 10)).entries
  expect(all.map(e => [e.entity.id, e.entity.deleted])).toEqual([[gone.id, true], [pay.id, true], [live.id, false]])
})

test('a person stream reads deleted expenses through the person index only when asked', async () => {
  const {store, bob, live, gone} = await setup()
  const read = async (all: boolean) =>
    (await mergeHistory([partyStream(store, {index: 'byPersonDate', eq: [bob.id]}, () => true, false, all)], 10)).entries.map(e => e.entity.id)
  expect(await read(false)).toEqual([live.id])
  expect(await read(true)).toEqual([gone.id, live.id])
})
