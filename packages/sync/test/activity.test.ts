import {beforeEach, expect, test} from 'bun:test'

import {activityFromHistory, activityTracker, loadActivity} from '../src/activity'
import {createExpense, createGroup, createPerson, deleteExpense, deletePerson, type ExpenseDraft, ensureMe, restoreExpense, updateExpense} from '../src/mutations'
import {setPref} from '../src/preferences'
import {openSqlStore} from '../src/sqlStore'
import {type Store, type StoreChange} from '../src/store'
import {type HistoryRow, type MutationCtx} from '../src/types'
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

test('repayments are recorded, edited, removed and restored (audit m1: a restore is not a second payment)', () => {
  const data = {from: 'riya', to: 'me', amount: 500n, currency: 'INR', groupId: null, date: '2026-10-26'}
  const feed = activityFromHistory([
    row({entityType: 'repayment', entityId: 'r1', version: 1, data, actor: 'riya'}),
    row({entityType: 'repayment', entityId: 'r1', version: 2, data: {...data, amount: 400n}}),
    row({entityType: 'repayment', entityId: 'r1', version: 3, data, deleted: true}),
    row({entityType: 'repayment', entityId: 'r1', version: 4, data}),
  ])
  expect(feed.map(x => x.kind)).toEqual(['repayment.restored', 'repayment.removed', 'repayment.edited', 'repayment.recorded'])
  expect(feed.at(-1)!.actor).toBe('riya')
})

test('write-offs: a restored one is "restored", not recorded again (audit m1)', () => {
  const data = {from: 'riya', to: 'me', amount: 500n, currency: 'INR', groupId: null, date: '2026-10-26'}
  const feed = activityFromHistory([
    row({entityType: 'writeoff', entityId: 'w1', version: 1, data}),
    row({entityType: 'writeoff', entityId: 'w1', version: 2, data, deleted: true}),
    row({entityType: 'writeoff', entityId: 'w1', version: 3, data}),
  ])
  expect(feed.map(x => x.kind)).toEqual(['writeoff.restored', 'writeoff.removed', 'writeoff.recorded'])
})

test('groups: active again, restore and a member leaving have their own kinds; records a group delete took with it stay out of the feed', () => {
  const m = (personId: string, leftAt: number | null) => ({personId, joinedAt: 1, leftAt})
  const g = {name: 'Flat', archived: false, members: [m('me', null), m('bob', null)]}
  const exp = {title: 'Rent', groupId: 'g1'}
  const feed = activityFromHistory([
    row({entityType: 'group', entityId: 'g1', version: 1, at: 100, data: g}),
    row({entityType: 'group', entityId: 'g1', version: 2, at: 200, data: {...g, inactive: true}}),
    row({entityType: 'group', entityId: 'g1', version: 3, at: 300, data: g}),
    row({entityType: 'group', entityId: 'g1', version: 4, at: 400, data: {...g, members: [m('me', null), m('bob', 400)]}}),
    row({entityType: 'group', entityId: 'g1', version: 5, at: 500, data: g, deleted: true}),
    row({entityType: 'group', entityId: 'g1', version: 6, at: 600, data: g}),
    row({entityType: 'expense', entityId: 'e1', version: 1, at: 150, data: exp}),
    row({entityType: 'expense', entityId: 'e1', version: 2, at: 500, data: {...exp, deletedWithGroup: 'g1'}, deleted: true}),
    row({entityType: 'expense', entityId: 'e1', version: 3, at: 600, data: exp}),
  ])
  expect(feed.map(x => x.kind)).toEqual(['group.restored', 'group.deleted', 'group.memberLeft', 'group.active', 'group.inactive', 'expense.created', 'group.created'])
})

test('groups: becoming inactive reads as inactive, other changes as edited, tombstones as deleted', () => {
  const g = {name: 'Flat', archived: false}
  const feed = activityFromHistory([
    row({entityType: 'group', entityId: 'g1', version: 1, data: g}),
    row({entityType: 'group', entityId: 'g1', version: 2, data: {...g, name: 'Flat 4B'}}),
    row({entityType: 'group', entityId: 'g1', version: 3, data: {...g, inactive: true}}),
    row({entityType: 'group', entityId: 'g1', version: 4, data: g, deleted: true}),
  ])
  expect(feed.map(x => x.kind)).toEqual(['group.deleted', 'group.inactive', 'group.edited', 'group.created'])
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

test('the tracker re-reads only what each change touched and always equals the top of a full load', async () => {
  const track = activityTracker(s)
  const changes: StoreChange[] = []
  s.subscribe(c => changes.push(c))
  const reads = {getAllMoney: 0, historyMany: [] as string[]}
  const getAll = s.getAll.bind(s)
  const historyMany = s.historyMany.bind(s)
  s.getAll = (t => (['expense', 'repayment', 'writeoff'].includes(t) && reads.getAllMoney++, getAll(t))) as Store['getAll']
  s.historyMany = (refs => (reads.historyMany.push(...refs.map(r => `${r.type}:${r.id}`)), historyMany(refs))) as Store['historyMany']
  const expectFull = async (state: Awaited<ReturnType<typeof track>>) => {
    expect(state.events).toEqual(await loadActivity(s))
    expect(state.isDone).toBe(true)
    // The expense rows the events name, current: a deleted one is in, flagged.
    const named = new Set(state.events.filter(e => e.entityType === 'expense').map(e => e.entityId))
    expect(state.entities.expense.map(e => e.id).sort()).toEqual([...named].sort())
    expect(state.entities.person).toEqual(await getAll('person'))
  }
  await expectFull(await track('unknown'))
  const riya = await createPerson(s, ctx, {name: 'Riya'})
  const e = await createExpense(s, ctx, draft(riya.id))
  await updateExpense(s, ctx, e.id, draft(riya.id, {total: 300n, payers: {me: 300n}}))
  // Notices can be handled after later commits; once every notice is handled the state is current.
  let state = await track(changes.shift()!)
  for (const c of changes.splice(0)) state = await track(c)
  await expectFull(state)
  reads.historyMany = []
  reads.getAllMoney = 0
  await deleteExpense(s, ctx, e.id)
  const [deleted] = changes.splice(0)
  state = await track(deleted!)
  // One history: not every entity's. And never a whole money store.
  expect(reads.historyMany).toEqual([`expense:${e.id}`])
  expect(reads.getAllMoney).toBe(0)
  await expectFull(state)
  reads.historyMany = []
  await setPref(s, ctx, 'accent', '#7c3aed')
  const [pref] = changes.splice(0)
  state = await track(pref!)
  // Preferences are not in the feed: nothing is read.
  expect(reads.historyMany).toEqual([])
  await expectFull(state)
})

test('the feed is a window of the newest events; asking for more reads older history by cursor', async () => {
  const riya = await createPerson(s, ctx, {name: 'Riya'})
  for (let i = 0; i < 12; i++) await createExpense(s, ctx, draft(riya.id, {title: `Lunch ${i}`}))
  const full = await loadActivity(s)
  let want = 5
  const track = activityTracker(s, () => want)
  let state = await track('unknown')
  expect(state.events).toEqual(full.slice(0, 5))
  expect(state.isDone).toBe(false)
  want = 9
  state = await track({})
  expect(state.events).toEqual(full.slice(0, 9))
  want = 500
  state = await track({})
  expect(state.events).toEqual(full)
  expect(state.isDone).toBe(true)
  // A new change lands on top of the window.
  want = 5
  const again = activityTracker(s, () => want)
  await again('unknown')
  const added = await createExpense(s, ctx, draft(riya.id, {title: 'Newest'}))
  const next = await again({expense: new Set([added.id])})
  expect(next.events[0]).toMatchObject({kind: 'expense.created', entityId: added.id})
  expect(next.events).toHaveLength(5)
})
