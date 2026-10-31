/// <reference types="bun" />
import {expect, test} from 'bun:test'
import {type ActivityEvent} from '@splito/sync'

import {
  ACTIVITY_TYPE_ART,
  activityEmptyArt,
  buildRows,
  EMPTY_FEED_STATE,
  type FeedFilter,
  ALL_ACTIVITY,
  activityTypeOf,
  isRead,
  markAllRead,
  markRows,
  matchesFilter,
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
  const rows = buildRows(events, EMPTY_FEED_STATE, 'me', {tab: 'all', types: [], group: 'g1'}, 'UTC', (_type, id) => (id === 'x1' ? 'g1' : undefined)).rows
  expect(rows.flatMap(r => (r.type === 'event' ? [r.event.id] : []))).toEqual(['e1', 'c1'])
})

/* F-115 m23: days follow the Timezone preference, not the device's. */
test('events are grouped by the day they fall on in the chosen timezone', () => {
  // 20:00Z on the 25th is 01:30 on the 26th in Kolkata but still the 25th in London.
  const events = [ev('a', at(25, 20))]
  const ist = buildRows(events, EMPTY_FEED_STATE, 'me', ALL_ACTIVITY, 'Asia/Kolkata')
  const la = buildRows(events, EMPTY_FEED_STATE, 'me', ALL_ACTIVITY, 'America/Los_Angeles')
  expect(ist.rows[0]).toMatchObject({type: 'section', day: '2026-10-26'})
  expect(la.rows[0]).toMatchObject({type: 'section', day: '2026-10-25'})
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

test('a narrowed "Mark all read" marks only the unread rows it lists, in one pass, and keeps the rest unread', () => {
  const events = [ev('a', at(26, 9)), ev('b', at(26, 8)), ev('c', at(26, 7)), ev('own', at(26, 6), 'me')]
  const listed = [events[0]!, events[1]!]
  const s = markRows(setRead(EMPTY_FEED_STATE, events[1]!, false), listed)
  expect(listed.every(e => isRead(s, e, 'me'))).toBe(true)
  expect(isRead(s, events[2]!, 'me')).toBe(false)
  // The per-row lists stay small: no duplicates, and an unread mark on a listed row is gone.
  expect(s.read.sort()).toEqual(['a', 'b'])
  expect(s.unread).toEqual([])
  expect(buildRows(events, s, 'me', ALL_ACTIVITY, 'UTC').unreadCount).toBe(1)
})

test('the unread count and the badge never depend on the tab or the filter: all tabs agree on what is unread', () => {
  const events = [ev('a', at(26, 9)), ev('b', at(26, 8), 'me'), ev('c', at(25, 9))]
  const unread = (f: Parameters<typeof buildRows>[3]) => buildRows(events, EMPTY_FEED_STATE, 'me', f, 'UTC').unreadCount
  // The badge counts the whole feed (ALL_ACTIVITY); the others tab holds the same unread rows, Me none.
  expect(unread(ALL_ACTIVITY)).toBe(2)
  expect(unread(tab('others'))).toBe(2)
  expect(unread(tab('me'))).toBe(0)
})

test('a dispute is a type of its own and keeps its group; a comment on a payment goes by the payment\'s group', () => {
  const dispute = {id: 'd', at: at(26, 9), actor: 'riya', kind: 'dispute.opened', entityType: 'dispute', data: {groupId: 'g1'}} as unknown as ActivityEvent
  const comment = {id: 'c', at: at(26, 8), actor: 'riya', kind: 'comment.added', entityType: 'comment', data: {targetType: 'repayment', targetId: 'p1'}} as unknown as ActivityEvent
  const of = (type: 'expense' | 'repayment', id: string) => (type === 'repayment' && id === 'p1' ? 'g1' : undefined)
  expect(matchesFilter(dispute, {tab: 'all', types: ['disputes'], group: 'g1'}, 'me')).toBe(true)
  expect(matchesFilter(dispute, {tab: 'all', types: ['disputes'], group: 'g2'}, 'me')).toBe(false)
  expect(matchesFilter(dispute, {tab: 'all', types: ['expenses']}, 'me')).toBe(false)
  expect(matchesFilter(comment, {tab: 'all', types: ['comments'], group: 'g1'}, 'me', of)).toBe(true)
  expect(matchesFilter(comment, {tab: 'all', types: ['comments'], group: 'g1'}, 'me')).toBe(false)
})

test('the person filter keeps what involves that friend: their expenses and payments, comments and disputes on them, reminders, requests and friend events (owner 194)', () => {
  const e = (entityType: string, kind: string, data: unknown, entityId = 'x') => ({id: `${kind}-${entityId}`, at: at(26, 9), actor: 'me', kind, entityType, entityId, data}) as unknown as ActivityEvent
  const f = {tab: 'all', types: [], person: 'riya'} as const
  const parties = (_type: string, id: string) => (id === 'e1' ? ['me', 'riya'] : ['me', 'sam'])
  const yes = [
    e('expense', 'expense.created', {payers: {me: 1n}, shares: {me: 1n, riya: 1n}}),
    e('repayment', 'repayment.recorded', {from: 'riya', to: 'me'}),
    e('writeoff', 'writeoff.recorded', {from: 'me', to: 'riya'}),
    e('comment', 'comment.added', {authorId: 'me', mentions: [], targetType: 'expense', targetId: 'e1'}),
    e('comment', 'comment.added', {authorId: 'me', mentions: ['riya'], targetType: 'expense', targetId: 'e2'}),
    e('dispute', 'dispute.opened', {raisedBy: 'me', targetType: 'expense', targetId: 'e1'}),
    e('reminder', 'reminder.set', {personId: 'riya'}),
    e('friendRequest', 'friendRequest.sent', {personId: 'riya'}),
    e('person', 'person.added', {}, 'riya'),
  ]
  const no = [
    e('expense', 'expense.created', {payers: {me: 1n}, shares: {me: 1n, sam: 1n}}),
    e('repayment', 'repayment.recorded', {from: 'sam', to: 'me'}),
    e('comment', 'comment.added', {authorId: 'me', mentions: [], targetType: 'expense', targetId: 'e2'}),
    e('dispute', 'dispute.opened', {raisedBy: 'me', targetType: 'expense', targetId: 'e2'}),
    e('reminder', 'reminder.set', {personId: 'sam'}),
    e('person', 'person.added', {}, 'sam'),
    e('group', 'group.created', {}),
  ]
  expect(yes.map(x => matchesFilter(x, f, 'me', undefined, parties))).toEqual(yes.map(() => true))
  expect(no.map(x => matchesFilter(x, f, 'me', undefined, parties))).toEqual(no.map(() => false))
  expect(matchesFilter(yes[0]!, {...f, types: ['payments']}, 'me')).toBe(false)
})

test('an empty Activity shows art about what is missing (F-260)', () => {
  const none = {hiddenCount: 0, canLookFurther: false}
  const art = (f: Partial<FeedFilter>, o = none) => activityEmptyArt({...ALL_ACTIVITY, ...f}, o)
  expect(art({})).toBe('empty-activity')
  expect(art({tab: 'me'})).toBe('empty-activity')
  expect(art({}, {...none, hiddenCount: 3})).toBe('empty-activity')
  expect(art({tab: 'others'}, {...none, canLookFurther: true})).toBe('empty-search')
  expect(art({}, {...none, canLookFurther: true})).toBe('empty-activity')
  for (const type of Object.keys(ACTIVITY_TYPE_ART) as (keyof typeof ACTIVITY_TYPE_ART)[])
    expect(art({types: [type]})).toBe(ACTIVITY_TYPE_ART[type])
  expect(new Set(Object.values(ACTIVITY_TYPE_ART)).size).toBe(7)
  expect(art({types: ['expenses', 'payments']})).toBe('empty-expenses')
  expect(art({types: ['comments', 'payments']})).toBe('empty-filter')
  expect(art({types: ['expenses'], group: 'g1'})).toBe('empty-filter')
  expect(art({person: 'p1'})).toBe('empty-filter')
})
