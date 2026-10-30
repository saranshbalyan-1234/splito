/// <reference types="bun" />
import {expect, test} from 'bun:test'

import {activityParams, readActivityParams, typesToParam} from './urlState'

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
