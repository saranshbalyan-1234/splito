import {type LocalDate} from '@splito/domain'
import {type ActivityEvent} from '@splito/sync'

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
export function isRead(s: FeedState, e: Readable, me: string): boolean {
  if (s.unread.includes(e.id)) return false
  return e.actor === me || e.at <= s.readUpTo || s.read.includes(e.id)
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

/** The Notifications tabs: everything, only changes by other people (Bluesky's "Mentions" slot), or only disputes and holds (F-1210). */
export type FeedFilter = 'all' | 'others' | 'disputed'

/**
 * The list's rows: the visible changes (newest first) under one header per
 * local day, as Bluesky's notifications sit under "Today" and "Earlier".
 * `unreadFromOthers` is the badge count: your own changes never badge.
 */
export function buildRows(
  events: ActivityEvent[],
  s: FeedState,
  me: string,
  filter: FeedFilter = 'all',
  tz: string,
) {
  const hidden = new Set(s.hidden)
  const rows: FeedRow[] = []
  let hiddenCount = 0
  let unreadCount = 0
  let unreadFromOthers = 0
  let day: LocalDate | undefined
  for (const event of events) {
    if (filter === 'others' && event.actor === me) continue
    if (filter === 'disputed' && event.entityType !== 'dispute') continue
    if (hidden.has(event.id)) {
      hiddenCount++
      continue
    }
    const eventDay = dayOf(event.at, tz)
    if (eventDay !== day) {
      day = eventDay
      rows.push({type: 'section', key: `day-${day}`, day})
    }
    const read = isRead(s, event, me)
    if (!read) {
      unreadCount++
      if (event.actor !== me) unreadFromOthers++
    }
    rows.push({
      type: 'event',
      key: event.id,
      event,
      isRead: read,
      hasDivider: rows.at(-1)?.type === 'event',
    })
  }
  return {rows, hiddenCount, unreadCount, unreadFromOthers}
}
