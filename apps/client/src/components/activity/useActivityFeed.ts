import {useMemo} from 'react'
import {plural} from '@lingui/core/macro'
import {
  type ActivityEvent,
  type ActivityState,
  type Entity,
  type Expense,
  type FriendRequest,
  type Group,
  type Person,
} from '@splito/sync'

import {useTimeZone} from '#/locale/useDates'
import {useActivityState, useMutationCtx} from '#/data/hooks'
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
  /** Friend requests by id, for their current state (a request row shows Accept until answered). */
  requests: Map<string, Entity<FriendRequest>>
}

const snapshots = new WeakMap<ActivityState, ActivitySnapshot>()

/* One snapshot object per loaded feed state, shared by the Activity screen and the nav badges. */
function snapshotOf(state: ActivityState): ActivitySnapshot {
  let snapshot = snapshots.get(state)
  if (!snapshot) {
    snapshot = {
      events: state.events,
      people: new Map(
        (state.entities.person as Entity<Person>[]).map(p => [p.id, p]),
      ),
      groups: new Map(
        (state.entities.group as Entity<Group>[]).map(g => [g.id, g]),
      ),
      expenses: new Map(
        (state.entities.expense as Entity<Expense>[]).map(e => [e.id, e]),
      ),
      requests: new Map(
        (state.entities.friendRequest as Entity<FriendRequest>[]).map(r => [
          r.id,
          r,
        ]),
      ),
    }
    snapshots.set(state, snapshot)
  }
  return snapshot
}

const NO_EVENTS: ActivityEvent[] = []
const FEED_KEY: ['activityFeed'] = ['activityFeed']

/**
 * The feed with your read and hidden marks applied. `snapshot` is undefined
 * until the first load. `update` changes the marks from their latest stored
 * value, so quick successive actions never overwrite each other.
 */
export function useActivityFeed(filter: FeedFilter = 'all') {
  const {actor: me} = useMutationCtx()
  const tz = useTimeZone()
  const loaded = useActivityState()
  const snapshot = loaded && snapshotOf(loaded)
  const [stored, setStored] = useStorage(device, FEED_KEY)
  const state = stored ?? EMPTY_FEED_STATE
  const update = (fn: (s: FeedState) => FeedState) =>
    setStored(fn(device.get(FEED_KEY) ?? EMPTY_FEED_STATE))
  const events = snapshot?.events ?? NO_EVENTS
  const feed = useMemo(
    () => buildRows(events, state, me, filter, tz),
    [events, state, me, filter, tz],
  )
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
