import {expect, test} from 'bun:test'
import {type Entity, type SearchResults} from '@splito/sync'

import {searchRows} from './model'

const e = (type: Entity['type'], id: string) =>
  ({
    type,
    id,
    data: {},
    version: 1,
    deleted: false,
    updatedAt: 1,
  }) as Entity<never>

test('people and groups come first, then expenses; every result is reachable by keyboard in order', () => {
  const results: SearchResults = {
    people: [e('person', 'sam')],
    groups: [],
    expenses: [e('expense', 'x1'), e('expense', 'x2')],
    totals: {EUR: 100n, INR: 5n},
    terms: ['s'],
  }
  expect(
    searchRows(results).map(r =>
      r.type === 'header' ? `${r.section}:${r.count}` : `${r.key}#${r.nav}`,
    ),
  ).toEqual([
    'people:1',
    'person-sam#0',
    'expenses:2',
    'expense-x1#1',
    'expense-x2#2',
  ])
})

test('no results, no rows', () => {
  expect(
    searchRows({people: [], groups: [], expenses: []}),
  ).toEqual([])
})

test('a partial expense count is flagged; a known one is not', () => {
  const results = {people: [], groups: [], expenses: [e('expense', 'x1')]}
  const header = (count?: {count: number; isPartial: boolean}) =>
    searchRows(results, count)[0]
  expect(header()).toMatchObject({count: 1, isPartial: false})
  expect(header({count: 30, isPartial: true})).toMatchObject({
    count: 30,
    isPartial: true,
  })
})

test('the "Ask Splito" row heads the list and is the first stop of the keyboard, results follow', () => {
  const results = {people: [e('person', 'sam')], groups: [], expenses: [e('expense', 'x1')]}
  const rows = searchRows(results, undefined, 'who owes me?')
  expect(rows.map(r => (r.type === 'header' ? r.section : `${r.key}#${r.nav}`))).toEqual(['ask#0', 'people', 'person-sam#1', 'expenses', 'expense-x1#2'])
  expect(rows[0]).toMatchObject({type: 'ask', query: 'who owes me?'})
  // Nothing found still offers the question: it is answered from the books, not the search.
  expect(searchRows({people: [], groups: [], expenses: []}, undefined, 'who owes me?')).toHaveLength(1)
  expect(searchRows({people: [], groups: [], expenses: []})).toEqual([])
})
