/// <reference types="bun" />
import {expect, test} from 'bun:test'
import {type ActivityEvent} from '@splito/sync'

import {
  buildRows,
  daysAgo,
  EMPTY_FEED_STATE,
  isRead,
  markAllRead,
  setHidden,
  setRead,
} from './feed'

const at = (day: number, hour: number) => new Date(2026, 9, day, hour).getTime()
const ev = (id: string, time: number, actor = 'riya') =>
  ({id, at: time, actor, kind: 'expense.created'}) as ActivityEvent

test('own changes and anything up to "mark all read" are read; marks override per row', () => {
  let s = EMPTY_FEED_STATE
  const mine = ev('a', at(20, 9), 'me')
  const theirs = ev('b', at(20, 10))
  const later = ev('c', at(21, 10))
  expect(isRead(s, mine, 'me')).toBe(true)
  expect(isRead(s, theirs, 'me')).toBe(false)

  s = setRead(s, theirs, true)
  expect(isRead(s, theirs, 'me')).toBe(true)
  s = setRead(s, mine, false)
  expect(isRead(s, mine, 'me')).toBe(false)

  s = markAllRead(s, [mine, theirs])
  expect([mine, theirs].every(e => isRead(s, e, 'me'))).toBe(true)
  expect(isRead(s, later, 'me')).toBe(false)
  // Marking everything read clears the per-row lists, so state stays small.
  expect(s.read).toEqual([])
  expect(s.unread).toEqual([])
})

test('rows: one header per local day, dividers only between rows of a day, hidden rows left out', () => {
  const events = [
    ev('c', at(26, 9)),
    ev('b', at(26, 8), 'me'),
    ev('x', at(25, 23)),
    ev('a', at(20, 12)),
  ]
  const s = setHidden(EMPTY_FEED_STATE, 'x', true)
  const {rows, hiddenCount, unreadCount} = buildRows(events, s, 'me')
  expect(
    rows.map(r =>
      r.type === 'section'
        ? `#${r.day}`
        : `${r.event.id}${r.hasDivider ? '|' : ''}`,
    ),
  ).toEqual([
    `#${new Date(2026, 9, 26).getTime()}`,
    'c',
    'b|',
    `#${new Date(2026, 9, 20).getTime()}`,
    'a',
  ])
  expect(hiddenCount).toBe(1)
  // Hidden rows don't count as unread.
  expect(unreadCount).toBe(2)
  expect(buildRows(events, setHidden(s, 'x', false), 'me').hiddenCount).toBe(0)
})

test('"From others" leaves out your own changes; the badge counts only unread from others', () => {
  const events = [
    ev('c', at(26, 9)),
    ev('b', at(26, 8), 'me'),
    ev('a', at(25, 12)),
  ]
  // Your own change marked unread again shows as unread in All, but never badges.
  const s = setRead(EMPTY_FEED_STATE, events[1]!, false)
  const all = buildRows(events, s, 'me')
  expect(all.unreadCount).toBe(3)
  expect(all.unreadFromOthers).toBe(2)
  const others = buildRows(events, s, 'me', 'others')
  expect(others.rows.flatMap(r => (r.type === 'event' ? [r.event.id] : []))).toEqual(['c', 'a'])
  expect(others.unreadCount).toBe(2)
})

test('daysAgo counts calendar days, not 24-hour periods', () => {
  const now = at(26, 0) + 60_000
  expect(daysAgo(at(26, 0), now)).toBe(0)
  expect(daysAgo(at(25, 23), now)).toBe(1)
  expect(daysAgo(at(19, 1), now)).toBe(7)
  // Across the end of a month.
  expect(daysAgo(new Date(2026, 8, 30, 12).getTime(), now)).toBe(26)
})
