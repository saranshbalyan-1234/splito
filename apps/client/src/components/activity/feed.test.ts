/// <reference types="bun" />
import {expect, test} from 'bun:test'
import {type ActivityEvent} from '@splito/sync'

import {
  buildRows,
  dayOf,
  daysAgo,
  EMPTY_FEED_STATE,
  isRead,
  markAllRead,
  setHidden,
  setRead,
  writeOffParties,
} from './feed'

const at = (day: number, hour: number) => Date.UTC(2026, 9, day, hour)
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
  const {rows, hiddenCount, unreadCount} = buildRows(events, s, 'me', 'all', 'UTC')
  expect(
    rows.map(r =>
      r.type === 'section'
        ? `#${r.day}`
        : `${r.event.id}${r.hasDivider ? '|' : ''}`,
    ),
  ).toEqual([
    '#2026-10-26',
    'c',
    'b|',
    '#2026-10-20',
    'a',
  ])
  expect(hiddenCount).toBe(1)
  // Hidden rows don't count as unread.
  expect(unreadCount).toBe(2)
  expect(buildRows(events, setHidden(s, 'x', false), 'me', 'all', 'UTC').hiddenCount).toBe(0)
})

test('"From others" leaves out your own changes; the badge counts only unread from others', () => {
  const events = [
    ev('c', at(26, 9)),
    ev('b', at(26, 8), 'me'),
    ev('a', at(25, 12)),
  ]
  // Your own change marked unread again shows as unread in All, but never badges.
  const s = setRead(EMPTY_FEED_STATE, events[1]!, false)
  const all = buildRows(events, s, 'me', 'all', 'UTC')
  expect(all.unreadCount).toBe(3)
  expect(all.unreadFromOthers).toBe(2)
  const others = buildRows(events, s, 'me', 'others', 'UTC')
  expect(
    others.rows.flatMap(r => (r.type === 'event' ? [r.event.id] : [])),
  ).toEqual(['c', 'a'])
  expect(others.unreadCount).toBe(2)
})

test('daysAgo counts calendar days, not 24-hour periods', () => {
  expect(daysAgo('2026-10-26', '2026-10-26')).toBe(0)
  expect(daysAgo('2026-10-25', '2026-10-26')).toBe(1)
  expect(daysAgo('2026-10-19', '2026-10-26')).toBe(7)
  // Across the end of a month.
  expect(daysAgo('2026-09-30', '2026-10-26')).toBe(26)
})

/* F-115 m23: days follow the Timezone preference, not the device's. */
test('events are grouped by the day they fall on in the chosen timezone', () => {
  // 20:00Z on the 25th is 01:30 on the 26th in Kolkata but still the 25th in London.
  const events = [ev('a', at(25, 20))]
  const ist = buildRows(events, EMPTY_FEED_STATE, 'me', 'all', 'Asia/Kolkata')
  const la = buildRows(events, EMPTY_FEED_STATE, 'me', 'all', 'America/Los_Angeles')
  expect(ist.rows[0]).toMatchObject({type: 'section', day: '2026-10-26'})
  expect(la.rows[0]).toMatchObject({type: 'section', day: '2026-10-25'})
  expect(dayOf(at(25, 20), 'Asia/Kolkata')).toBe('2026-10-26')
})

/* F-113 m5: a write-off row is told from who recorded it. */
test('write-off rows name the person the actor called it even with', () => {
  // I owe Bob and I call it even: the row is mine, with Bob.
  expect(writeOffParties({from: 'me', to: 'bob'}, 'me')).toEqual({
    kind: 'pair',
    other: 'bob',
  })
  // Bob forgives me on his device: Bob's row, with me.
  expect(writeOffParties({from: 'me', to: 'bob'}, 'bob')).toEqual({
    kind: 'pair',
    other: 'me',
  })
  // Riya records it for the two of us.
  expect(writeOffParties({from: 'me', to: 'bob'}, 'riya')).toEqual({
    kind: 'third',
  })
})
