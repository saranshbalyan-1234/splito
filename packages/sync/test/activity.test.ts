import {beforeEach, expect, test} from 'bun:test'

import {activityFromHistory, activityTracker, loadActivity} from '../src/activity'
import {createExpense, createGroup, createPerson, deleteExpense, deletePerson, type ExpenseDraft, ensureMe, restoreExpense, updateExpense} from '../src/mutations'
import {setPref} from '../src/preferences'
import {openSqlStore} from '../src/sqlStore'
import type {Store, StoreChange} from '../src/store'
import type {HistoryRow, MutationCtx} from '../src/types'
import {bunExecutor} from './bunExecutor'

let s: Store
let ctx: MutationCtx
let n = 0
beforeEach(async () => {
  n = 0
  s = await openSqlStore(bunExecutor(':memory:'))
  ctx = {deviceId: 'dev1', actor: 'me', now: () => 1000 + n * 10, newId: () => 'id' + ++n}
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

test('every kind of change shows up once, newest first, and the me-person and preferences never do', async () => {
  const riya = await createPerson(s, ctx, {name: 'Riya'})
  const g = await createGroup(s, ctx, {name: 'Goa', kind: 'trip', currency: 'INR', startDate: null, endDate: null, memberIds: [riya.id]})
  const e = await createExpense(s, ctx, draft(riya.id, {groupId: g.id}))
  await updateExpense(s, ctx, e.id, draft(riya.id, {groupId: g.id, total: 300n, payers: {me: 300n}}))
  await deleteExpense(s, ctx, e.id)
  await restoreExpense(s, ctx, e.id)
  await setPref(s, ctx, 'theme', 'dark')
  const temp = await createPerson(s, ctx, {name: 'Temp'})
  await deletePerson(s, ctx, temp.id)

  const feed = await loadActivity(s)
  expect(feed.map(x => x.kind)).toEqual([
    'person.removed',
    'person.added',
    'expense.restored',
    'expense.deleted',
    'expense.edited',
    'expense.created',
    'group.created',
    'person.added',
  ])
  expect(feed.every(x => x.actor === 'me')).toBe(true)
  const edited = feed.find(x => x.kind === 'expense.edited')!
  expect(edited.entityType === 'expense' && edited.prev?.total).toBe(100n)
  expect(edited.entityType === 'expense' && edited.data.total).toBe(300n)
  // Ids are stable per history row, so read/hidden state can key on them.
  expect(new Set(feed.map(x => x.id)).size).toBe(feed.length)
  expect(edited.id).toBe(`expense:${e.id}:2`)
})

const row = (over: Partial<HistoryRow> & Pick<HistoryRow, 'entityType' | 'entityId' | 'version'>): HistoryRow => ({
  data: {},
  deleted: false,
  at: over.version * 100,
  actor: 'me',
  ...over,
})

test('repayments are recorded, edited and removed; a restored one counts as recorded again', () => {
  const data = {from: 'riya', to: 'me', amount: 500n, currency: 'INR', groupId: null, date: '2026-10-26'}
  const feed = activityFromHistory([
    row({entityType: 'repayment', entityId: 'r1', version: 1, data, actor: 'riya'}),
    row({entityType: 'repayment', entityId: 'r1', version: 2, data: {...data, amount: 400n}}),
    row({entityType: 'repayment', entityId: 'r1', version: 3, data, deleted: true}),
    row({entityType: 'repayment', entityId: 'r1', version: 4, data}),
  ])
  expect(feed.map(x => x.kind)).toEqual(['repayment.recorded', 'repayment.removed', 'repayment.edited', 'repayment.recorded'])
  expect(feed.at(-1)!.actor).toBe('riya')
})

test('groups: archiving reads as archived, other changes as edited, tombstones as deleted', () => {
  const g = {name: 'Flat', archived: false}
  const feed = activityFromHistory([
    row({entityType: 'group', entityId: 'g1', version: 1, data: g}),
    row({entityType: 'group', entityId: 'g1', version: 2, data: {...g, name: 'Flat 4B'}}),
    row({entityType: 'group', entityId: 'g1', version: 3, data: {...g, archived: true}}),
    row({entityType: 'group', entityId: 'g1', version: 4, data: g, deleted: true}),
  ])
  expect(feed.map(x => x.kind)).toEqual(['group.deleted', 'group.archived', 'group.edited', 'group.created'])
})

test('rows out of order still pair each version with the one before it; ties keep a stable order', () => {
  const feed = activityFromHistory([
    row({entityType: 'expense', entityId: 'b', version: 1, at: 500, data: {title: 'B'}}),
    row({entityType: 'expense', entityId: 'a', version: 2, at: 500, data: {title: 'A2'}}),
    row({entityType: 'expense', entityId: 'a', version: 1, at: 100, data: {title: 'A1'}}),
    row({entityType: 'preference', entityId: 'theme', version: 1, at: 900}),
  ])
  expect(feed.map(x => x.id)).toEqual(['expense:a:2', 'expense:b:1', 'expense:a:1'])
  expect(feed[0]!.prev as unknown).toEqual({title: 'A1'})
})

test('the tracker re-reads only what each change touched and always equals a full load', async () => {
  const track = activityTracker(s)
  const changes: StoreChange[] = []
  s.subscribe(c => changes.push(c))
  const reads = {getAll: 0, history: 0}
  const getAll = s.getAll.bind(s)
  const history = s.history.bind(s)
  s.getAll = (t => (reads.getAll++, getAll(t))) as Store['getAll']
  s.history = ((t, id) => (reads.history++, history(t, id))) as Store['history']
  const expectFull = async (state: Awaited<ReturnType<typeof track>>) => {
    expect(state.events).toEqual(await loadActivity(s))
    expect(state.entities.expense).toEqual(await getAll('expense'))
  }
  await expectFull(await track('unknown'))
  const riya = await createPerson(s, ctx, {name: 'Riya'})
  const e = await createExpense(s, ctx, draft(riya.id))
  await updateExpense(s, ctx, e.id, draft(riya.id, {total: 300n, payers: {me: 300n}}))
  // Notices can be handled after later commits; once every notice is handled the state is current.
  let state = await track(changes.shift()!)
  for (const c of changes.splice(0)) state = await track(c)
  await expectFull(state)
  reads.getAll = 0
  reads.history = 0
  await deleteExpense(s, ctx, e.id)
  const [deleted] = changes.splice(0)
  state = await track(deleted!)
  // One type re-read and one history: not every entity's.
  expect(reads).toEqual({getAll: 1, history: 1})
  await expectFull(state)
  reads.getAll = 0
  reads.history = 0
  await setPref(s, ctx, 'accent', '#7c3aed')
  const [pref] = changes.splice(0)
  state = await track(pref!)
  // Preferences are not in the feed: nothing is read.
  expect(reads).toEqual({getAll: 0, history: 0})
  await expectFull(state)
})
