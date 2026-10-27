/**
 * Writes and removes the large demo set (`@splito/sync` `generateLargeDemo`,
 * ARCHITECTURE 26.1, F-227) in dev and e2e builds: through the real
 * mutations, many per store transaction, yielding to the UI between batches.
 * Every row it writes carries `DEMO_LARGE_PREFIX` in its id, which is how
 * "Remove demo data" finds exactly them.
 */
import {
  applyDemoOp,
  DEMO_LARGE_PREFIX,
  type DemoCounts as PlanCounts,
  type Entity,
  type EntityType,
  generateLargeDemo,
  insideTransaction,
  type Key,
  localToday,
  type MutationCtx,
  type Page,
  type Store,
} from '@splito/sync'

const BATCH = 150
const DEMO_TYPES: EntityType[] = [
  'person',
  'group',
  'expense',
  'repayment',
  'writeoff',
]

/** Every demo id starts with the tag, so the demo rows are one id range of each store. */
const DEMO_RANGE = {min: DEMO_LARGE_PREFIX, max: DEMO_LARGE_PREFIX + '\uffff'}

/** True when the large demo set (or part of it) is in the store. */
export async function hasLargeDemo(store: Store): Promise<boolean> {
  return (
    (await store.count('group', DEMO_RANGE)) > 0 ||
    (await store.count('person', DEMO_RANGE)) > 0
  )
}

/** What the large demo set holds right now: friends, groups and live expenses (counts, no rows read). */
export type DemoCounts = {friends: number; groups: number; expenses: number}

export async function demoCounts(store: Store): Promise<DemoCounts> {
  // Tombstoned demo expenses (the "deleted items" of the set) are in the range but not in the count.
  let deleted = 0
  let after: Key | null = null
  do {
    const page: Page<Entity> = await store.page('expense', {
      index: 'byDeleted',
      eq: [1],
      after,
      limit: 200,
    })
    deleted += page.items.filter(e => e.id.startsWith(DEMO_LARGE_PREFIX)).length
    after = page.next
  } while (after)
  return {
    friends: await store.count('person', DEMO_RANGE),
    groups: await store.count('group', DEMO_RANGE),
    expenses: (await store.count('expense', DEMO_RANGE)) - deleted,
  }
}

let running: Promise<unknown> | undefined

/** One add or remove at a time, whoever asks (URL, Settings, a double tap). */
function exclusive<T>(fn: () => Promise<T>): Promise<T> {
  const next = (running ?? Promise.resolve()).then(fn, fn)
  running = next.catch(() => undefined)
  return next
}

const yieldToUi = () => new Promise<void>(resolve => setTimeout(resolve, 0))

/**
 * Writes the large demo set through the real mutations, `BATCH` writes per
 * transaction, yielding between batches so the UI keeps painting. Returns
 * the counts, or null when the set is already there (adding twice is a no-op).
 */
export function addLargeDemo(
  store: Store,
  ctx: MutationCtx,
  onProgress?: (done: number) => void,
): Promise<PlanCounts | null> {
  return exclusive(async () => {
    if (await hasLargeDemo(store)) return null
    const now = Date.now()
    const {ops, counts} = generateLargeDemo({
      me: ctx.actor,
      today: localToday(now),
      now,
    })
    for (let i = 0; i < ops.length; i += BATCH) {
      await store.transaction(async tx => {
        const batched = insideTransaction(store, tx)
        for (const op of ops.slice(i, i + BATCH)) await applyDemoOp(batched, ctx, op)
      })
      onProgress?.(Math.min(1, (i + BATCH) / ops.length))
      await yieldToUi()
    }
    return counts
  })
}

/** Erases every row the large demo set wrote (entities, history, outbox), nothing else. */
export function removeLargeDemo(store: Store): Promise<number> {
  return exclusive(async () => {
    const refs: Array<{type: EntityType; id: string}> = []
    for (const type of DEMO_TYPES) {
      let after: Key | null = null
      do {
        // The demo rows are one id range of the store: read it by cursor, never the whole store.
        const page: Page<Entity> = await store.page(type, {...DEMO_RANGE, after, limit: 500})
        for (const e of page.items) refs.push({type: e.type, id: e.id})
        after = page.next
      } while (after)
    }
    if (refs.length) await store.erase(refs)
    return refs.length
  })
}
