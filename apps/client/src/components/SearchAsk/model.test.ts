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
    payments: [],
    totals: {EUR: 100n, INR: 5n},
    terms: ['s'],
  }
  expect(
    searchRows(results).map(r =>
      r.type === 'header' ? `${r.section}:${r.count}` : r.type === 'more' ? r.key : `${r.key}#${r.nav}`,
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
  expect(rows.map(r => (r.type === 'header' ? r.section : r.type === 'more' ? r.key : `${r.key}#${r.nav}`))).toEqual(['ask#0', 'people', 'person-sam#1', 'expenses', 'expense-x1#2'])
  expect(rows[0]).toMatchObject({type: 'ask', query: 'who owes me?'})
  // Nothing found still offers the question: it is answered from the books, not the search.
  expect(searchRows({people: [], groups: [], expenses: []}, undefined, 'who owes me?')).toHaveLength(1)
  expect(searchRows({people: [], groups: [], expenses: []})).toEqual([])
})

test('payments and write-offs come before the expenses under their own heading, with the count of all of them and Show more', () => {
  const results = {people: [], groups: [], expenses: [e('expense', 'x1')], payments: [e('repayment', 'p1'), e('writeoff', 'w1')]}
  const shape = (paymentCount?: number) => searchRows(results, undefined, undefined, paymentCount).map(r => (r.type === 'header' ? `${r.section}:${r.count}` : r.type === 'more' ? r.key : `${r.key}#${r.nav}`))
  expect(shape(5)).toEqual(['payments:5', 'payment-p1#0', 'payment-w1#1', 'more-payments', 'expenses:1', 'expense-x1#2'])
  // All of them shown: no Show more.
  expect(shape(2)).toEqual(['payments:2', 'payment-p1#0', 'payment-w1#1', 'expenses:1', 'expense-x1#2'])
})

test('a payment count still being worked out (a broad query, F-266) is flagged and keeps Show more; nothing found shows nothing', () => {
  const results = {people: [], groups: [], expenses: [], payments: [e('repayment', 'p1'), e('writeoff', 'w1')]}
  const rows = searchRows(results, undefined, undefined, {count: 2, isPartial: true})
  expect(rows[0]).toMatchObject({type: 'header', section: 'payments', count: 2, isPartial: true})
  expect(rows.map(r => r.key)).toContain('more-payments')
  expect(searchRows({...results, payments: []}, undefined, undefined, {count: 0, isPartial: true})).toEqual([])
})
