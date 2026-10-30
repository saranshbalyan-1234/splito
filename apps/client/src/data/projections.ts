import {
  ACTIVITY_PAGE,
  type ActivityState,
  activityTracker,
  displayPerson,
  type Entity,
  type EntityType,
  type HistoryRow,
  MONEY_TYPES,
  mergeChanges,
  type Person,
  type Store,
  type StoreChange,
  touches,
} from '@splito/sync'

/**
 * Shared live reads of the store (ARCHITECTURE 9.6, A-016). One projection per
 * store and query serves every hook that asks for it: it loads when the first
 * subscriber arrives, re-reads only when a commit touches what it covers
 * (a burst of commits is one re-read), keeps its previous value when the new
 * answer is equal, and goes idle with the last subscriber (no store
 * subscription, no value: the next subscriber loads afresh, as before).
 */
export type Query<T> = {
  key: string
  /** Whether this commit may change the answer. */
  isTouchedBy: (change: StoreChange) => boolean
  /**
   * Makes a loader for one subscription lifetime (state such as an
   * incremental reader lives in its closure). The loader gets what changed
   * since the last load and the previous value, to keep equal parts.
   * `controls.reload` asks for another load without a commit (a pager
   * wanting its next page).
   */
  loader: (store: Store, controls: Controls) => (change: StoreChange, prev: T | undefined) => Promise<T>
}

/** What a loader may ask of its projection. */
export type Controls = {reload: (change?: StoreChange) => void}

/** A load that no commit caused: "extend what you hold" (a pager's next page). */
export const MORE: StoreChange = {}

export type Projection<T> = {
  subscribe: (onChange: () => void) => () => void
  get: () => T | undefined
}

const registry = new WeakMap<Store, Map<string, Projection<unknown>>>()

function create<T>(store: Store, query: Query<T>): Projection<T> {
  let value: T | undefined
  const listeners = new Set<() => void>()
  let load: ReturnType<Query<T>['loader']> | undefined
  let offStore: (() => void) | undefined
  let isLoading = false
  // What changed while a load was running; read once it ends.
  let pending: StoreChange | undefined
  let isLive = false

  const run = (change: StoreChange) => {
    if (isLoading) {
      pending = pending ? mergeChanges(pending, change) : change
      return
    }
    isLoading = true
    load!(change, value).then(
      next => {
        isLoading = false
        if (!isLive) return
        if (next !== value) {
          value = next
          listeners.forEach(l => l())
        }
        if (pending) {
          const again = pending
          pending = undefined
          run(again)
        }
      },
      () => {
        // A failed read keeps the last answer; the next commit retries.
        isLoading = false
        if (isLive && pending) {
          const again = pending
          pending = undefined
          run(again)
        }
      },
    )
  }

  return {
    subscribe(onChange) {
      listeners.add(onChange)
      if (listeners.size === 1 && !isLive) {
        isLive = true
        load = query.loader(store, {reload: change => isLive && run(change ?? 'unknown')})
        offStore = store.subscribe(change => {
          if (query.isTouchedBy(change)) run(change)
        })
        run('unknown')
      }
      return () => {
        listeners.delete(onChange)
        if (listeners.size === 0) {
          isLive = false
          offStore?.()
          value = undefined
          pending = undefined
        }
      }
    },
    get: () => value,
  }
}

/** The one projection of `query` on `store`, created on first use. */
export function projectionFor<T>(store: Store, query: Query<T>): Projection<T> {
  let byKey = registry.get(store)
  if (!byKey) registry.set(store, (byKey = new Map()))
  const existing = byKey.get(query.key) as Projection<T> | undefined
  if (existing) return existing
  // ponytail: idle projections stay registered (one per entity type, one per expense history opened); prune if that grows.
  const created = create(store, query)
  byKey.set(query.key, created as Projection<unknown>)
  return created
}

/* -------------------------------------------------------------------------- */
/* Queries                                                                    */
/* -------------------------------------------------------------------------- */

/** Person names are capitalised word by word on display (owner 181), so rows saved lower-case read right. Every screen reads people and friend requests through these queries. */
const shown = <T>(type: EntityType, e: Entity<T>): Entity<T> =>
  type === 'person' || type === 'friendRequest' ? (displayPerson(e as unknown as Entity<Person>) as unknown as Entity<T>) : e

/* The sync status counts: an acknowledgement changes only that, and the row must redraw at full strength (decision 111). */
const isSameRow = (a: Entity, b: Entity) =>
  a.id === b.id && a.version === b.version && a.deleted === b.deleted && a.updatedAt === b.updatedAt && a.syncStatus === b.syncStatus

/**
 * `next` with every unchanged row replaced by its previous object, and the
 * previous array itself when nothing changed, so memoised rows and derived
 * figures stay put.
 */
export function shareRows<T>(prev: Entity<T>[] | undefined, next: Entity<T>[]): Entity<T>[] {
  if (!prev) return next
  const old = new Map(prev.map(e => [e.id, e]))
  let isSame = prev.length === next.length
  const out = next.map((e, i) => {
    const p = old.get(e.id)
    const kept = p && isSameRow(p, e) ? p : e
    if (kept !== prev[i]) isSame = false
    return kept
  })
  return isSame ? prev : out
}

const entityQueries = new Map<EntityType, Query<Entity[]>>()

/**
 * Every row of one entity type, tombstones included, ordered by id. Small
 * stores only (people, groups, preferences, requests, links): a money store
 * is read through indexes, projections and cursors (ARCHITECTURE 9.8).
 */
export function entitiesQuery<T>(type: EntityType): Query<Entity<T>[]> {
  if ((MONEY_TYPES as readonly string[]).includes(type)) throw new Error(`${type} is a money store: read it by index, not whole`)
  let q = entityQueries.get(type)
  if (!q) {
    q = {
      key: `entities:${type}`,
      isTouchedBy: change => touches(change, type),
      loader: store => async (_change, prev) => shareRows(prev, (await store.getAll<T>(type)).map(e => shown(type, e))),
    }
    entityQueries.set(type, q)
  }
  return q as unknown as Query<Entity<T>[]>
}

const oneQueries = new Map<string, Query<Entity | null>>()

/** One row by id, tombstone included; null when there is none. */
export function entityQuery<T>(type: EntityType, id: string): Query<Entity<T> | null> {
  const key = `entity:${type}:${id}`
  let q = oneQueries.get(key)
  if (!q) {
    q = {
      key,
      isTouchedBy: change => touches(change, type, id),
      loader: store => async (_change, prev) => {
        const row = await store.get(type, id)
        const next = row ? shown(type, row) : null
        return prev && next && isSameRow(prev, next) ? prev : next
      },
    }
    oneQueries.set(key, q)
  }
  return q as unknown as Query<Entity<T> | null>
}

const historyQueries = new Map<string, Query<HistoryRow[]>>()

/** One entity's stored versions, oldest first. */
export function historyQuery(type: EntityType, id: string): Query<HistoryRow[]> {
  const key = `history:${type}:${id}`
  let q = historyQueries.get(key)
  if (!q) {
    q = {
      key,
      isTouchedBy: change => touches(change, type, id),
      loader: store => async () => [...(await store.history(type, id))].sort((x, y) => x.version - y.version),
    }
    historyQueries.set(key, q)
  }
  return q
}

/** The Activity feed value: the newest events, and a way to ask for older ones. */
export type ActivityFeed = ActivityState & {loadMore: (pages?: number) => void; /** Widens the window to at least this many events (never narrows it; a no-op when it already holds them). */ ensureWindow: (events: number) => void}

/**
 * The Activity feed: the newest events by cursor, re-reading only the
 * histories each commit touched; `loadMore` widens the window by a page.
 */
export const activityQuery: Query<ActivityFeed> = {
  key: 'activity',
  isTouchedBy: change =>
    touches(change, 'person') || touches(change, 'group') || touches(change, 'expense') ||
    touches(change, 'repayment') ||
    touches(change, 'writeoff') ||
    touches(change, 'friendRequest') ||
    touches(change, 'reminder') ||
    touches(change, 'comment') ||
    touches(change, 'dispute'),
  loader: (store, controls) => {
    let want = ACTIVITY_PAGE
    const track = activityTracker(store, () => want)
    const loadMore = (pages = 1) => {
      want += ACTIVITY_PAGE * pages
      /* An empty notice, not 'unknown': the tracker keeps what it read and only goes on from its cursor. */
      controls.reload({})
    }
    const ensureWindow = (events: number) => {
      if (events <= want) return
      want = events
      controls.reload({})
    }
    return async change => ({...(await track(change)), loadMore, ensureWindow})
  },
}
