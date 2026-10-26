import {useSyncExternalStore} from 'react'
import {plural} from '@lingui/core/macro'
import {
  type ActivityEvent,
  type Entity,
  type Expense,
  type Group,
  loadActivity,
  type Person,
  type Store,
} from '@splito/sync'

import {useMutationCtx, useStore} from '#/data/hooks'
import {device, useStorage} from '#/storage'
import {
  buildRows,
  EMPTY_FEED_STATE,
  type FeedFilter,
  type FeedState,
} from './feed'

export type ActivitySnapshot = {
  events: ActivityEvent[]
  /** Every person, group and expense, deleted ones included, by id. */
  people: Map<string, Entity<Person>>
  groups: Map<string, Entity<Group>>
  expenses: Map<string, Entity<Expense>>
}

type Source = {
  subscribe: (onChange: () => void) => () => void
  get: () => ActivitySnapshot | undefined
}

const sources = new WeakMap<Store, Source>()

/*
 * One live load of the feed per store, shared by the Activity screen and the
 * nav badges, re-read after every committed transaction while anyone listens.
 */
function sourceFor(store: Store): Source {
  const existing = sources.get(store)
  if (existing) return existing
  let snapshot: ActivitySnapshot | undefined
  let generation = 0
  let unsubscribeStore: (() => void) | undefined
  const listeners = new Set<() => void>()
  const load = () => {
    const current = ++generation
    void Promise.all([
      loadActivity(store),
      store.getAll<Person>('person'),
      store.getAll<Group>('group'),
      store.getAll<Expense>('expense'),
    ]).then(([events, people, groups, expenses]) => {
      // A newer load has started; it will report.
      if (current !== generation) return
      snapshot = {
        events,
        people: new Map(people.map(p => [p.id, p])),
        groups: new Map(groups.map(g => [g.id, g])),
        expenses: new Map(expenses.map(e => [e.id, e])),
      }
      listeners.forEach(l => l())
    })
  }
  const source: Source = {
    subscribe(onChange) {
      listeners.add(onChange)
      if (listeners.size === 1) {
        load()
        unsubscribeStore = store.subscribe(load)
      }
      return () => {
        listeners.delete(onChange)
        if (listeners.size === 0) unsubscribeStore?.()
      }
    },
    get: () => snapshot,
  }
  sources.set(store, source)
  return source
}

const FEED_KEY: ['activityFeed'] = ['activityFeed']

/**
 * The feed with your read and hidden marks applied. `snapshot` is undefined
 * until the first load. `update` changes the marks from their latest stored
 * value, so quick successive actions never overwrite each other.
 */
export function useActivityFeed(filter: FeedFilter = 'all') {
  const store = useStore()
  const {actor: me} = useMutationCtx()
  const source = sourceFor(store)
  const snapshot = useSyncExternalStore(source.subscribe, source.get)
  const [stored, setStored] = useStorage(device, FEED_KEY)
  const state = stored ?? EMPTY_FEED_STATE
  const update = (fn: (s: FeedState) => FeedState) =>
    setStored(fn(device.get(FEED_KEY) ?? EMPTY_FEED_STATE))
  const feed = buildRows(snapshot?.events ?? [], state, me, filter)
  return {me, snapshot, state, update, ...feed}
}

/**
 * The Activity nav item's badge, as Bluesky badges Notifications: unread
 * changes by other people, capped at "30+" as upstream's
 * `useUnreadNotifications`; empty when there's nothing new.
 */
export function useActivityBadge() {
  const {unreadFromOthers: n} = useActivityFeed()
  return n >= 30 ? '30+' : n > 0 ? String(n) : ''
}

/** "13 unread items" for screen readers. The badge can read '30+', which plural() would read as NaN, so it gets a number. */
export function describeUnread(badge: string) {
  const count = Number.parseInt(badge, 10)
  if (!count) return ''
  return badge.endsWith('+')
    ? plural(count, {
        one: '# or more unread items',
        other: '# or more unread items',
      })
    : plural(count, {one: '# unread item', other: '# unread items'})
}
