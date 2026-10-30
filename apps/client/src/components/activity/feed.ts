import {type LocalDate} from '@splito/domain'
import {type ActivityEvent, type ActivityTypeId} from '@splito/sync'

import {daysBetween, todayIn} from '#/locale/dates'

/**
 * Your personal view of the feed, kept on this device: what you've read and
 * what you've hidden. The audit history it filters is never changed.
 */
export type FeedState = {
  /** Every change up to this time (epoch ms) is read. */
  readUpTo: number
  /** Changes marked read one by one, after `readUpTo`. */
  read: string[]
  /** Changes marked unread again, even if they would otherwise be read. */
  unread: string[]
  /** Changes hidden from the feed. */
  hidden: string[]
}

export const EMPTY_FEED_STATE: FeedState = {
  readUpTo: 0,
  read: [],
  unread: [],
  hidden: [],
}

type Readable = Pick<ActivityEvent, 'id' | 'at' | 'actor'>

/**
 * Your own changes start out read, as Bluesky never notifies you of your own
 * posts; changes by others are unread until marked.
 * ponytail: `readUpTo` compares change times, so a change that syncs in late
 * with an older time counts as read; compare server receive times once sync exists.
 */
export function isRead(s: FeedState, e: Readable, me: string, sets: ReadSets = readSets(s)): boolean {
  // Your own changes are never unread (owner 92): they cannot be marked unread either.
  if (e.actor === me) return true
  if (sets.unread.has(e.id)) return false
  return e.at <= s.readUpTo || sets.read.has(e.id)
}

/** The per-row marks as sets, built once per list so a row's check is O(1), not a scan of the marks. */
export type ReadSets = {read: ReadonlySet<string>; unread: ReadonlySet<string>}
export const readSets = (s: FeedState): ReadSets => ({read: new Set(s.read), unread: new Set(s.unread)})

/** Marks every one of `events` read in one pass (a narrowed "Mark all read"): the per-row marks are rewritten once. */
export function markRows(s: FeedState, events: readonly Readable[]): FeedState {
  const ids = new Set(events.map(e => e.id))
  return {...s, read: [...new Set([...s.read, ...ids])], unread: s.unread.filter(id => !ids.has(id))}
}

export function setRead(s: FeedState, e: Readable, read: boolean): FeedState {
  const others = (ids: string[]) => ids.filter(id => id !== e.id)
  return read
    ? {...s, read: [...others(s.read), e.id], unread: others(s.unread)}
    : {...s, read: others(s.read), unread: [...others(s.unread), e.id]}
}

/** Everything in `events` becomes read; per-row marks are no longer needed. */
export function markAllRead(s: FeedState, events: Readable[]): FeedState {
  const newest = events.reduce((max, e) => Math.max(max, e.at), s.readUpTo)
  return {...s, readUpTo: newest, read: [], unread: []}
}

export function setHidden(
  s: FeedState,
  id: string,
  hidden: boolean,
): FeedState {
  const others = s.hidden.filter(h => h !== id)
  return {...s, hidden: hidden ? [...others, id] : others}
}

/**
 * Who a write-off row is about, told from whoever recorded it (the row's
 * avatar): the other side when the actor is one of the two, else both
 * (audit m5: never from `to`'s side when `from` recorded it).
 */
export function writeOffParties(
  w: {from: string; to: string},
  actor: string,
): {kind: 'pair'; other: string} | {kind: 'third'} {
  if (actor === w.from) return {kind: 'pair', other: w.to}
  if (actor === w.to) return {kind: 'pair', other: w.from}
  return {kind: 'third'}
}

/** The calendar day `at` falls on in `tz` (the Timezone preference, not the device's). */
export function dayOf(at: number, tz: string): LocalDate {
  return todayIn(tz, new Date(at))
}

/** Calendar days from `day` to `today` (0 = today). */
export function daysAgo(day: LocalDate, today: LocalDate) {
  return daysBetween(day, today)
}

export type FeedRow =
  | {type: 'section'; key: string; /** The calendar day, in the Timezone preference. */ day: LocalDate}
  | {
      type: 'event'
      key: string
      event: ActivityEvent
      isRead: boolean
      /** A divider above it; not under a section header, which has its own. */
      hasDivider: boolean
    }

/** Activity's tabs (owner 92): everything, what I did, what other people did. */
export type ActivityTab = 'all' | 'me' | 'others'

/** What the list shows: the tab, the types (empty is every type, owner 173) and, from a Group's "See all", one group. */
export type FeedFilter = {tab: ActivityTab; types: readonly ActivityTypeId[]; group?: string}

export const ALL_ACTIVITY: FeedFilter = {tab: 'all', types: []}

/** The type an event kind belongs to (owner 173); undefined for a kind this list does not know, which only the unfiltered list shows. */
export function activityTypeOf(kind: string): ActivityTypeId | undefined {
  const family = kind.slice(0, kind.indexOf('.'))
  switch (family) {
    case 'expense':
      return 'expenses'
    case 'repayment':
    case 'writeoff':
      return 'payments'
    case 'comment':
      return 'comments'
    case 'group':
      return 'groups'
    case 'person':
    case 'friendRequest':
      return 'friends'
    case 'reminder':
      return 'reminders'
    case 'dispute':
      return 'disputes'
    default:
      return undefined
  }
}

/** Where a comment's target lives: the group of its expense or payment. */
export type GroupOfTarget = (type: 'expense' | 'repayment', id: string) => string | null | undefined

/** The group a change belongs to, when it has one. */
function groupOf(e: ActivityEvent, groupOfTarget?: GroupOfTarget): string | null | undefined {
  switch (e.entityType) {
    case 'group':
      return e.entityId
    case 'comment':
      return groupOfTarget?.(e.data.targetType, e.data.targetId)
    case 'expense':
    case 'repayment':
    case 'writeoff':
    case 'reminder':
      return e.data.groupId
    default:
      return (e as {data?: {groupId?: string | null}}).data?.groupId
  }
}

/** Whether `event` is in the list for `filter`. */
export function matchesFilter(event: ActivityEvent, filter: FeedFilter, me: string, groupOfTarget?: GroupOfTarget): boolean {
  if (filter.tab === 'others' && event.actor === me) return false
  if (filter.tab === 'me' && event.actor !== me) return false
  if (filter.types.length > 0) {
    const type = activityTypeOf(event.kind)
    if (!type || !filter.types.includes(type)) return false
  }
  return !filter.group || groupOf(event, groupOfTarget) === filter.group
}

/**
 * The list's rows: the visible changes (newest first) under one header per
 * local day, as Bluesky's notifications sit under "Today" and "Earlier".
 * `unreadCount` is the badge count: your own changes are never unread.
 */
export function buildRows(
  events: ActivityEvent[],
  s: FeedState,
  me: string,
  filter: FeedFilter,
  tz: string,
  groupOfTarget?: GroupOfTarget,
) {
  const hidden = new Set(s.hidden)
  const sets = readSets(s)
  const rows: FeedRow[] = []
  let hiddenCount = 0
  let unreadCount = 0
  let day: LocalDate | undefined
  for (const event of events) {
    if (!matchesFilter(event, filter, me, groupOfTarget)) continue
    if (hidden.has(event.id)) {
      hiddenCount++
      continue
    }
    const eventDay = dayOf(event.at, tz)
    if (eventDay !== day) {
      day = eventDay
      rows.push({type: 'section', key: `day-${day}`, day})
    }
    const read = isRead(s, event, me, sets)
    if (!read) {
      unreadCount++
    }
    rows.push({
      type: 'event',
      key: event.id,
      event,
      isRead: read,
      hasDivider: rows.at(-1)?.type === 'event',
    })
  }
  return {rows, hiddenCount, unreadCount}
}
