/*
 * A narrowed Activity list grows its window page by page (F-259); at 10,000 expenses that must read every history
 * row about once, not rebuild the whole history per page, and a change afterwards must cost milliseconds, on both
 * engines. (Before the fix: 20 rebuilds, 23.6 s, then 72 ms for every new expense.)
 */
import 'fake-indexeddb/auto'
import {IDBFactory} from 'fake-indexeddb'

import {describe, expect, test} from 'bun:test'

import {ACTIVITY_PAGE, activityTracker, loadActivity} from '../src/activity'
import {createComment} from '../src/comments'
import {openIdbStore} from '../src/idbStore'
import {createExpense, createPerson, ensureMe, type ExpenseDraft} from '../src/mutations'
import {openSqlStore} from '../src/sqlStore'
import {insideTransaction, type Store} from '../src/store'
import {type MutationCtx} from '../src/types'
import {bunExecutor} from './bunExecutor'

const ENGINES: Array<[string, () => Promise<Store>]> = [
  ['SQLite', () => openSqlStore(bunExecutor(':memory:'))],
  ['IndexedDB', () => openIdbStore('activity-scale', new IDBFactory())],
]
const N = 10_000
const draft = (person: string, i: number): ExpenseDraft => ({
  title: `Expense ${i}`,
  groupId: null,
  currency: 'INR',
  total: BigInt(100 + (i % 900)),
  payers: {me: BigInt(100 + (i % 900))},
  split: {mode: 'equal', participants: ['me', person]},
  date: '2026-10-26',
  tz: 'Asia/Kolkata',
  category: 'food',
  notes: '',
})

/** The store with every row `historyPage` and `historyMany` hand back counted. */
function counting(store: Store) {
  const reads = {rows: 0}
  const proxy = new Proxy(store, {
    get(target, prop, receiver) {
      const v = Reflect.get(target, prop, receiver) as unknown
      if (prop === 'historyPage' || prop === 'historyMany')
        return async (...args: unknown[]) => {
          const out = await (v as (...a: unknown[]) => Promise<unknown>).apply(target, args)
          reads.rows += Array.isArray(out) ? out.length : (out as {items: unknown[]}).items.length
          return out
        }
      return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(target) : v
    },
  })
  return {store: proxy, reads}
}

for (const [name, make] of ENGINES) {
  describe(`activity window at ${N} expenses (${name})`, () => {
    test.skipIf(!!process.env.CI)('growing the window reads each history row about once, and a new expense is cheap afterwards', async () => {
      const s = await make()
      let n = 0
      let clock = 1_000_000
      const ctx: MutationCtx = {deviceId: 'dev1', actor: 'me', now: () => clock++, newId: () => 'id' + String(++n).padStart(6, '0')}
      await ensureMe(s, ctx, 'Me')
      const riya = await createPerson(s, ctx, {name: 'Riya'})
      for (let from = 0; from < N; from += 250)
        await s.transaction(async tx => {
          const batched = insideTransaction(s, tx)
          for (let i = from; i < from + 250; i++) await createExpense(batched, ctx, draft(riya.id, i))
        })
      const first = await createExpense(s, ctx, draft(riya.id, N))
      await createComment(s, ctx, {targetType: 'expense', targetId: first.id, body: 'hello'})

      const {store, reads} = counting(s)
      let size = ACTIVITY_PAGE
      const track = activityTracker(store, () => size)
      const t0 = performance.now()
      let state = await track('unknown')
      // A narrowed list walks back ten pages automatically, then a few more by scrolling: a window of 10 -> 100 pages.
      for (const pages of [5, 10, 20, 40, 80, 100]) {
        size = ACTIVITY_PAGE * pages
        state = await track({})
      }
      const ms = performance.now() - t0
      const total = N + 2 /* me, riya */ + 2 /* the extra expense and its comment */
      expect(state.events.length).toBe(ACTIVITY_PAGE * 100)
      // Each history row is read by the page walk and once more with its entity's whole history; never once per step.
      console.log(`activity window ${name}: ${N} expenses walked to a ${state.events.length}-event window in ${ms.toFixed(0)} ms, ${reads.rows} history rows read for ${total}`)
      expect(reads.rows).toBeLessThan(total * 3)
      expect(ms).toBeLessThan(15_000)

      // A new expense afterwards: one entity re-read, no rebuild.
      const before = reads.rows
      const added = await createExpense(s, ctx, draft(riya.id, N + 1))
      const t1 = performance.now()
      state = await track({expense: new Set([added.id])})
      const after = performance.now() - t1
      console.log(`activity window ${name}: a new expense at 10k costs ${after.toFixed(1)} ms`)
      expect(reads.rows - before).toBeLessThan(10)
      expect(after).toBeLessThan(60)
      expect(state.events[0]!.entityId).toBe(added.id)

      // And it agrees with the full read.
      const full = await loadActivity(s)
      expect(state.events).toEqual(full.slice(0, state.events.length))
      await s.close()
    }, 120_000)
  })
}
