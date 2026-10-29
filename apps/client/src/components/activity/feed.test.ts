/// <reference types="bun" />
import {expect, test} from 'bun:test'
import {type ActivityEvent} from '@splito/sync'

import {
  buildRows,
  dayOf,
  daysAgo,
  EMPTY_FEED_STATE,
  ALL_ACTIVITY,
  activityTypeOf,
  isRead,
  markAllRead,
  setHidden,
  setRead,
  writeOffParties,
} from './feed'

const tab = (t: 'all' | 'me' | 'others') => ({...ALL_ACTIVITY, tab: t})

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
  // My own changes are never unread, whatever is marked (owner 92).
  s = setRead(s, mine, false)
  expect(isRead(s, mine, 'me')).toBe(true)

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
  const {rows, hiddenCount, unreadCount} = buildRows(events, s, 'me', ALL_ACTIVITY, 'UTC')
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
  expect(buildRows(events, setHidden(s, 'x', false), 'me', ALL_ACTIVITY, 'UTC').hiddenCount).toBe(0)
})

test('tabs: Me lists what I did, Others what other people did; only others\' changes can be unread', () => {
  const events = [
    ev('c', at(26, 9)),
    ev('b', at(26, 8), 'me'),
    ev('a', at(25, 12)),
  ]
  // Marking my own change unread does nothing: the badge and "Mark all read" count only others.
  const s = setRead(EMPTY_FEED_STATE, events[1]!, false)
  const ids = (t: 'all' | 'me' | 'others') =>
    buildRows(events, s, 'me', tab(t), 'UTC').rows.flatMap(r => (r.type === 'event' ? [r.event.id] : []))
  expect(ids('all')).toEqual(['c', 'b', 'a'])
  expect(ids('me')).toEqual(['b'])
  expect(ids('others')).toEqual(['c', 'a'])
  expect(buildRows(events, s, 'me', tab('all'), 'UTC').unreadCount).toBe(2)
  expect(buildRows(events, s, 'me', tab('me'), 'UTC').unreadCount).toBe(0)
  expect(buildRows(events, s, 'me', tab('others'), 'UTC').unreadCount).toBe(2)
})

test('types: transactions are expenses and payments; disputes are read from their kind; a type list narrows, empty is all', () => {
  const kinds = ['expense.created', 'repayment.recorded', 'writeoff.recorded', 'comment.added', 'group.created', 'person.added', 'friendRequest.sent', 'reminder.set', 'dispute.opened']
  expect(kinds.map(k => activityTypeOf(k))).toEqual(['expenses', 'payments', 'payments', 'comments', 'groups', 'friends', 'friends', 'reminders', 'disputes'])
  const events = kinds.map((kind, i) => ({id: String(i), at: at(26, 9 - i), actor: 'riya', kind}) as ActivityEvent)
  const ids = (types: Parameters<typeof buildRows>[3]['types']) =>
    buildRows(events, EMPTY_FEED_STATE, 'me', {tab: 'all', types}, 'UTC').rows.flatMap(r => (r.type === 'event' ? [r.event.kind as string] : []))
  expect(ids(['expenses', 'payments'])).toEqual(['expense.created', 'repayment.recorded', 'writeoff.recorded'])
  expect(ids(['disputes', 'comments'])).toEqual(['comment.added', 'dispute.opened'])
  expect(ids([])).toHaveLength(kinds.length)
})

test('a group scope keeps that group\'s changes, a comment going by its expense', () => {
  const events = [
    {id: 'e1', at: at(26, 9), actor: 'riya', kind: 'expense.created', entityType: 'expense', data: {groupId: 'g1'}},
    {id: 'e2', at: at(26, 8), actor: 'riya', kind: 'expense.created', entityType: 'expense', data: {groupId: 'g2'}},
    {id: 'c1', at: at(26, 7), actor: 'riya', kind: 'comment.added', entityType: 'comment', data: {targetType: 'expense', targetId: 'x1'}},
  ] as unknown as ActivityEvent[]
  const rows = buildRows(events, EMPTY_FEED_STATE, 'me', {tab: 'all', types: [], group: 'g1'}, 'UTC', id => (id === 'x1' ? 'g1' : undefined)).rows
  expect(rows.flatMap(r => (r.type === 'event' ? [r.event.id] : []))).toEqual(['e1', 'c1'])
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
  const ist = buildRows(events, EMPTY_FEED_STATE, 'me', ALL_ACTIVITY, 'Asia/Kolkata')
  const la = buildRows(events, EMPTY_FEED_STATE, 'me', ALL_ACTIVITY, 'America/Los_Angeles')
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
