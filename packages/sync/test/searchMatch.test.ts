import {describe, expect, test} from 'bun:test'

import {matchedFields} from '../src/searchMatch'
import {parseQuery} from '../src/searchQuery'
import {expense} from './searchFixture'

/* Which field a query matched, per field: the row names it and marks the words. */
const names = new Map([
  ['me', 'Asha Rao'],
  ['riya', 'Riya Sharma'],
])
const e = expense('x', {
  title: 'Dinner',
  notes: 'Anniversary at the beach',
  currency: 'INR',
  total: 12500n,
  payers: {riya: 12500n},
  split: {mode: 'items', items: [{id: 'i', name: 'Custard tarts', amount: 12500n, participants: ['me', 'riya']}], tax: 0n, tip: 0n, discount: 0n},
  shares: {me: 6250n, riya: 6250n},
})

const fields = (q: string, extra: Partial<Parameters<typeof matchedFields>[1]> = {}) => {
  const {tokens} = parseQuery(q)
  const terms = tokens.flatMap(t => ('text' in t ? [t.text] : []))
  return matchedFields(e, {tokens, terms, names, ...extra}).map(f => (f.field === 'status' ? `status:${f.status}` : f.field))
}

describe('matchedFields', () => {
  test('words: notes, item names, group, place, category, people and comments', () => {
    expect(fields('anniversary')).toEqual(['notes'])
    expect(fields('custard')).toEqual(['item'])
    expect(fields('goa', {group: {name: 'Goa trip', location: 'Candolim'}})).toEqual(['group'])
    expect(fields('candolim', {group: {name: 'Goa trip', location: 'Candolim'}})).toEqual(['place'])
    expect(fields('food', {categoryName: 'Food'})).toEqual(['category'])
    expect(fields('sharma')).toEqual(['person'])
    expect(fields('receipt', {comment: 'Please send the receipt'})).toEqual(['comment'])
  })

  test('a title match alone adds no line', () => {
    expect(fields('dinner')).toEqual([])
  })

  test('facets: amount, date, currency, status, payer and with', () => {
    expect(fields('over 100')).toEqual(['amount'])
    expect(fields('125')).toEqual(['amount'])
    expect(fields('7')).toEqual([])
    expect(fields('march')).toEqual(['date'])
    expect(fields('last month')).toEqual(['date'])
    expect(fields('inr')).toEqual(['currency'])
    expect(fields('deleted')).toEqual(['status:deleted'])
    expect(fields('paid by riya')).toEqual(['payer'])
    expect(fields('with riya')).toEqual(['person'])
  })

  test('alternatives name each facet once', () => {
    expect(fields('march or april')).toEqual(['date'])
  })
})
