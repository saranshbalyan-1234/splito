/*
 * The Activity window holds the newest `size` events whatever the history
 * looks like: edits of old entities, history rows that make no event, and a
 * window larger than one page. Compared with the full `loadActivity`, on both
 * engines.
 */
import 'fake-indexeddb/auto'
import {IDBFactory} from 'fake-indexeddb'

import {describe, expect, test} from 'bun:test'

import {ACTIVITY_PAGE, activityTracker, loadActivity} from '../src/activity'
import {openIdbStore} from '../src/idbStore'
import {createComment} from '../src/comments'
import {createExpense, createGroup, createPerson, createRepayment, type ExpenseDraft, ensureMe, updateExpense, updatePerson} from '../src/mutations'
import {openSqlStore} from '../src/sqlStore'
import {type Store} from '../src/store'
import {type MutationCtx} from '../src/types'
import {bunExecutor} from './bunExecutor'

const ENGINES: Array<[string, () => Promise<Store>]> = [
  ['SQLite', () => openSqlStore(bunExecutor(':memory:'))],
  ['IndexedDB', () => openIdbStore('activity-window', new IDBFactory())],
]

const draft = (person: string, over: Partial<ExpenseDraft> = {}): ExpenseDraft => ({
  title: 'Dinner',
  groupId: null,
  currency: 'INR',
  total: over.total ?? 100n,
  payers: {me: over.total ?? 100n},
  split: {mode: 'equal', participants: ['me', person]},
  date: '2026-10-26',
  tz: 'Asia/Kolkata',
  category: 'food',
  notes: '',
  ...over,
})

async function open(make: () => Promise<Store>) {
  const s = await make()
  let n = 0
  let clock = 1000
  const ctx: MutationCtx = {deviceId: 'dev1', actor: 'me', now: () => clock++, newId: () => 'id' + String(++n).padStart(5, '0')}
  await ensureMe(s, ctx, 'Me')
  const riya = await createPerson(s, ctx, {name: 'Riya'})
  return {s, ctx, riya}
}

for (const [name, make] of ENGINES) {
  describe(`activity window (${name})`, () => {
    test('edits of old entities do not crowd newer events out of a window larger than one page', async () => {
      const {s, ctx, riya} = await open(make)
      const old: string[] = []
      for (let i = 0; i < 30; i++) {
        const e = await createExpense(s, ctx, draft(riya.id, {title: `Old ${i}`}))
        old.push(e.id)
        for (let k = 1; k <= 5; k++) await updateExpense(s, ctx, e.id, draft(riya.id, {title: `Old ${i}`, total: BigInt(100 + k)}))
      }
      for (let i = 0; i < 150; i++) await createExpense(s, ctx, draft(riya.id, {title: `New ${i}`}))
      for (const id of old) await updateExpense(s, ctx, id, draft(riya.id, {title: 'Touched again', total: 999n}))

      const full = await loadActivity(s)
      const size = 200
      expect(size).toBeGreaterThan(ACTIVITY_PAGE)
      const state = await activityTracker(s, () => size)('unknown')
      expect(state.events).toEqual(full.slice(0, size))
      // Every one of the 150 newer creates is in the window.
      expect(state.events.filter(e => e.kind === 'expense.created' && /^New /.test((e.data as {title: string}).title))).toHaveLength(150)
      await s.close()
    })

    test('history rows that make no event (renames) pool old events without shortening the window', async () => {
      const {s, ctx} = await open(make)
      const friends: string[] = []
      for (let i = 0; i < 30; i++) friends.push((await createPerson(s, ctx, {name: `Friend ${i}`})).id)
      for (let i = 0; i < 150; i++) await createExpense(s, ctx, draft(friends[i % 30]!, {title: `Lunch ${i}`}))
      // The newest page is renames: history rows, never activity, that pool each friend's old "added" event.
      for (let i = 0; i < 100; i++) await updatePerson(s, ctx, friends[i % 30]!, {name: `Renamed ${i}`})
      const full = await loadActivity(s)
      for (const size of [100, 120, 140]) {
        const state = await activityTracker(s, () => size)('unknown')
        expect(state.events).toEqual(full.slice(0, size))
      }
      await s.close()
    })

    test('a window of exactly the whole feed is done; a smaller one is not; both equal the full load', async () => {
      const {s, ctx, riya} = await open(make)
      for (let i = 0; i < 25; i++) await createExpense(s, ctx, draft(riya.id, {title: `E ${i}`}))
      for (let i = 0; i < 120; i++) await updatePerson(s, ctx, riya.id, {name: `R ${i}`})
      const full = await loadActivity(s)
      const all = await activityTracker(s, () => 500)('unknown')
      expect(all.events).toEqual(full)
      expect(all.isDone).toBe(true)
      const part = await activityTracker(s, () => 10)('unknown')
      expect(part.events).toEqual(full.slice(0, 10))
      expect(part.isDone).toBe(false)
      await s.close()
    })

    test('comments are events; the window names what each is on (an expense, a payment) and a grown window equals the full load', async () => {
      const {s, ctx, riya} = await open(make)
      const g = await createGroup(s, ctx, {name: 'Goa', kind: 'trip', currency: 'INR', startDate: null, endDate: null, memberIds: [riya.id]})
      const e = await createExpense(s, ctx, draft(riya.id, {groupId: g.id}))
      const pay = await createRepayment(s, ctx, {groupId: g.id, currency: 'INR', from: riya.id, to: 'me', amount: 40n, date: '2026-10-26', tz: 'Asia/Kolkata', note: ''})
      await createComment(s, ctx, {targetType: 'expense', targetId: e.id, body: 'on the dinner'})
      await createComment(s, ctx, {targetType: 'repayment', targetId: pay.id, body: 'on the payment'})
      for (let i = 0; i < 130; i++) await createExpense(s, ctx, draft(riya.id, {title: `E ${i}`}))

      const full = await loadActivity(s)
      expect(full.filter(x => x.kind === 'comment.added')).toHaveLength(2)
      let size = ACTIVITY_PAGE
      const track = activityTracker(s, () => size)
      const small = await track('unknown')
      expect(small.events.some(x => x.kind === 'comment.added')).toBe(false)
      // Growing with an empty notice keeps the pool and reads on; the result equals the full load.
      size = 500
      const grown = await track({})
      expect(grown.events).toEqual(full)
      expect(grown.entities.expense.map(x => x.id)).toContain(e.id)
      expect(grown.entities.repayment.map(x => x.id)).toEqual([pay.id])
      // A comment written afterwards arrives through its change notice.
      const c = await createComment(s, ctx, {targetType: 'expense', targetId: e.id, body: 'later'})
      const after = await track({comment: new Set([c.id])})
      expect(after.events[0]).toMatchObject({kind: 'comment.added', entityId: c.id})
      await s.close()
    })
  })
}
