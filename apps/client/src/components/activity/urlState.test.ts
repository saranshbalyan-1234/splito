/// <reference types="bun" />
import {expect, test} from 'bun:test'

import {activityParams, RECORD_PARAMS, readActivityParams, typesToParam} from './urlState'

test('type=transactions is expenses and payments; unknown tokens are dropped; all clears', () => {
  expect(readActivityParams({type: 'transactions'}).types).toEqual(['expenses', 'payments'])
  expect(readActivityParams({type: 'comments,bogus,transactions'}).types).toEqual(['expenses', 'payments', 'comments'])
  expect(readActivityParams({type: 'all'}).types).toEqual([])
  expect(readActivityParams({type: 'bogus'}).types).toBeUndefined()
  expect(readActivityParams({tab: 'me', group: 'g1'})).toEqual({tab: 'me', group: 'g1'})
  expect(readActivityParams({tab: 'all', type: 'expenses,payments,disputes', person: 'p1'})).toEqual({tab: 'all', types: ['expenses', 'payments', 'disputes'], person: 'p1'})
  expect(readActivityParams({tab: 'nope'}).tab).toBeUndefined()
})

test('types are written as transactions when expenses and payments are both on', () => {
  expect(typesToParam(['expenses', 'payments'])).toBe('transactions')
  expect(typesToParam(['expenses', 'payments', 'groups'])).toBe('transactions,groups')
  expect(typesToParam(['payments'])).toBe('payments')
  expect(typesToParam([])).toBe('all')
})

test('a stock value is left out only when the saved choice is stock too', () => {
  const stock = {tab: 'all' as const, types: []}
  expect(activityParams(stock, stock)).toEqual({tab: undefined, type: undefined})
  expect(activityParams(stock, {tab: 'others', types: ['groups']})).toEqual({tab: 'all', type: 'all'})
  expect(activityParams({tab: 'me', types: ['groups']}, stock)).toEqual({tab: 'me', type: 'groups'})
})

test('the record filters (owner 226) are read from since/until, currency, category and scope', () => {
  expect(readActivityParams({since: '2026-01-01', until: '2026-03-31', currency: 'EUR', category: 'food', scope: '0:g1,g2'})).toEqual({
    from: '2026-01-01',
    to: '2026-03-31',
    currency: 'EUR',
    category: 'food',
    scope: {nonGroup: false, groups: ['g1', 'g2']},
  })
  // One bound alone is a filter too (a day: since = until).
  expect(readActivityParams({since: '2026-02-01'})).toEqual({from: '2026-02-01'})
  expect(readActivityParams({since: '2026-02-03', until: '2026-02-03'})).toEqual({from: '2026-02-03', to: '2026-02-03'})
  // `from` and `to` are not date filters here: `from` names the tab a pushed copy opened from.
  expect(readActivityParams({from: '2026-01-01', to: '2026-02-01'})).toEqual({})
  expect(RECORD_PARAMS).toEqual(['since', 'until', 'currency', 'category', 'scope'])
})

test('junk record filters are dropped, never half-read', () => {
  expect(readActivityParams({since: '2026-1-1', until: 'yesterday', currency: 'eur', category: 'a b', scope: 'junk'})).toEqual({})
  expect(readActivityParams({since: '2026-13-45x', currency: 'EURO', category: 'x'.repeat(65)})).toEqual({})
  expect(readActivityParams({category: '<script>', scope: '2:all'})).toEqual({})
  // A swapped range is no date filter, as in Analytics' custom range.
  expect(readActivityParams({since: '2026-03-01', until: '2026-01-01', currency: 'INR'})).toEqual({currency: 'INR'})
  // Everything narrows nothing; so does an empty group list with non-group off (the scope helper's rule).
  expect(readActivityParams({scope: '1:all'})).toEqual({})
  expect(readActivityParams({scope: '0:'})).toEqual({})
})
