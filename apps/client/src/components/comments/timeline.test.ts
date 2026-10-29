import {expect, test} from 'bun:test'
import {type Comment, type Entity} from '@splito/sync'

import {dayKey, mergeTimeline, withDividers} from './timeline'

const comment = (id: string, at: number): Entity<Comment> => ({
  type: 'comment',
  id,
  data: {
    targetType: 'expense',
    targetId: 'e1',
    authorId: 'me',
    body: id,
    mentions: [],
    editedAt: null,
  },
  version: 1,
  deleted: false,
  createdAt: at,
  updatedAt: at,
  syncStatus: 'local',
  serverVersion: null,
  syncedAt: null,
  syncError: null,
})
const line = (key: string, at: number) => ({key, at})
const keys = (items: ReadonlyArray<{key: string}>) => items.map(i => i.key)

test('comments and history lines come out in time order, history first on a tie', () => {
  const merged = mergeTimeline(
    [comment('c1', 20), comment('c2', 40), comment('c3', 50)],
    [line('h1', 10), line('h2', 30), line('h3', 50)],
    {
      showHistory: true,
      hasEarlier: false,
    },
  )
  expect(keys(merged)).toEqual(['h1', 'c1', 'h2', 'c2', 'h3', 'c3'])
})

test('with the preference off only comments show', () => {
  const merged = mergeTimeline([comment('c1', 20)], [line('h1', 10)], {
    showHistory: false,
    hasEarlier: false,
  })
  expect(keys(merged)).toEqual(['c1'])
})

test('history older than the oldest loaded comment waits while earlier comments are unloaded', () => {
  const comments = [comment('c5', 100), comment('c6', 110)]
  const history = [line('h1', 10), line('h2', 105)]
  expect(
    keys(
      mergeTimeline(comments, history, {showHistory: true, hasEarlier: true}),
    ),
  ).toEqual(['c5', 'h2', 'c6'])
  expect(
    keys(
      mergeTimeline(comments, history, {showHistory: true, hasEarlier: false}),
    ),
  ).toEqual(['h1', 'c5', 'h2', 'c6'])
})

test('no comments: all history shows even when the flag says earlier exist', () => {
  expect(
    keys(
      mergeTimeline([], [line('h1', 10)], {
        showHistory: true,
        hasEarlier: true,
      }),
    ),
  ).toEqual(['h1'])
})

test('a date divider opens each local day, in the given zone', () => {
  const day = 24 * 3600_000
  const base = Date.UTC(2026, 9, 26, 12, 0)
  const items = mergeTimeline(
    [comment('a', base), comment('b', base + 1000), comment('c', base + day)],
    [],
    {showHistory: true, hasEarlier: false},
  )
  expect(keys(withDividers(items, 'UTC'))).toEqual([
    'divider:2026-10-26',
    'a',
    'b',
    'divider:2026-10-27',
    'c',
  ])
  // 23:30 UTC on the 26th is already the 27th in Kolkata
  expect(dayKey(Date.UTC(2026, 9, 26, 23, 30), 'Asia/Kolkata')).toBe(
    '2026-10-27',
  )
  expect(dayKey(Date.UTC(2026, 9, 26, 23, 30), 'UTC')).toBe('2026-10-26')
})
