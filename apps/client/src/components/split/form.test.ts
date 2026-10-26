import {describe, expect, test} from 'bun:test'
import {type Expense} from '@splito/sync'

import {
  emptyForm,
  evaluateForm,
  type ExpenseForm,
  formFromExpense,
} from './form'
import {suggestCategory} from './suggestCategory'

const base = (over: Partial<ExpenseForm> = {}): ExpenseForm => ({
  ...emptyForm({
    me: 'me',
    currency: 'INR',
    date: '2026-10-26',
    people: ['me', 'riya', 'sam'],
    groupId: null,
    mode: 'equal',
  }),
  title: 'Dinner',
  amount: '300',
  ...over,
})

describe('evaluateForm', () => {
  test('equal split, single payer: a valid draft', () => {
    const r = evaluateForm(base(), 'Asia/Kolkata')
    expect(r.error).toBeUndefined()
    expect(r.shares).toEqual({me: 10000n, riya: 10000n, sam: 10000n})
    expect(r.draft?.payers).toEqual({me: 30000n})
    expect(r.draft?.total).toBe(30000n)
  })
  test('title and amount are required', () => {
    expect(evaluateForm(base({title: '  '}), 'UTC').error).toBe(
      'TITLE_REQUIRED',
    )
    expect(evaluateForm(base({amount: ''}), 'UTC').error).toBe(
      'AMOUNT_REQUIRED',
    )
    expect(evaluateForm(base({amount: '0'}), 'UTC').error).toBe(
      'AMOUNT_NOT_POSITIVE',
    )
  })
  test('calculator amount', () =>
    expect(evaluateForm(base({amount: '250+50'}), 'UTC').total).toBe(30000n))
  test('excluded people leave the equal split', () =>
    expect(evaluateForm(base({excluded: ['sam']}), 'UTC').shares).toEqual({
      me: 15000n,
      riya: 15000n,
    }))
  test('exact: remaining readout until it adds up', () => {
    const r = evaluateForm(
      base({mode: 'exact', exact: {me: '100', riya: '50'}}),
      'UTC',
    )
    expect(r.remaining).toEqual({kind: 'money', value: 15000n})
    expect(r.error).toBe('TOTAL_MISMATCH')
    const ok = evaluateForm(
      base({mode: 'exact', exact: {me: '100', riya: '50', sam: '150'}}),
      'UTC',
    )
    expect(ok.error).toBeUndefined()
  })
  test('percent: remaining in percent', () => {
    const r = evaluateForm(
      base({mode: 'percent', percent: {me: '50', riya: '25'}}),
      'UTC',
    )
    expect(r.remaining).toEqual({kind: 'percent', value: 2500})
    expect(
      evaluateForm(
        base({mode: 'percent', percent: {me: '50', riya: '25', sam: '25'}}),
        'UTC',
      ).shares,
    ).toEqual({me: 15000n, riya: 7500n, sam: 7500n})
  })
  test('shares default to 1 each, 0 leaves someone out', () =>
    expect(
      evaluateForm(base({mode: 'shares', shares: {me: 2, sam: 0}}), 'UTC')
        .shares,
    ).toEqual({me: 20000n, riya: 10000n}))
  test('equal with adjustments', () =>
    expect(
      evaluateForm(base({mode: 'adjusted', adjust: {sam: '60'}}), 'UTC').shares,
    ).toEqual({me: 8000n, riya: 8000n, sam: 14000n}))
  test('items with tax', () => {
    const items = [
      {key: 'a', name: 'Pizza', amount: '200', people: ['me', 'riya']},
      {key: 'b', name: 'Juice', amount: '70', people: ['sam']},
    ]
    const r = evaluateForm(base({mode: 'items', items, tax: '30'}), 'UTC')
    expect(r.error).toBeUndefined()
    expect(r.itemsTotal).toBe(30000n)
    const short = evaluateForm(base({mode: 'items', items}), 'UTC')
    expect(short.remaining).toEqual({kind: 'money', value: 3000n})
  })
  test('multiple payers must add up', () => {
    const r = evaluateForm(
      base({payerMode: 'multiple', paid: {me: '100', riya: '100'}}),
      'UTC',
    )
    expect(r.payersRemaining).toBe(10000n)
    expect(r.error).toBe('PAYERS_MISMATCH')
    expect(
      evaluateForm(
        base({payerMode: 'multiple', paid: {me: '100', riya: '200'}}),
        'UTC',
      ).draft?.payers,
    ).toEqual({me: 10000n, riya: 20000n})
  })
  test('bad row amounts are reported per person', () => {
    const r = evaluateForm(base({mode: 'exact', exact: {me: '1.234'}}), 'UTC')
    expect(r.rowErrors.me).toBe('TOO_MANY_DECIMALS')
  })
})

describe('formFromExpense', () => {
  test('round-trips an equal split with someone who only paid', () => {
    const e: Expense = {
      title: 'Cab',
      groupId: null,
      currency: 'INR',
      total: 30000n,
      payers: {riya: 30000n},
      split: {mode: 'equal', participants: ['me', 'sam']},
      shares: {me: 15000n, sam: 15000n},
      date: '2026-01-02',
      tz: 'Asia/Kolkata',
      category: 'transport',
      notes: '',
    }
    const f = formFromExpense(e, 'me')
    expect(f.amount).toBe('300.00')
    expect(f.people).toEqual(['me', 'riya', 'sam'])
    expect(f.excluded).toEqual(['riya'])
    expect(f.payer).toBe('riya')
    const r = evaluateForm(f, 'Asia/Kolkata')
    expect(r.draft?.split).toEqual(e.split)
    expect(r.shares).toEqual(e.shares)
  })
})

describe('suggestCategory', () => {
  const ids = [
    'food',
    'transport',
    'stay',
    'shopping',
    'entertainment',
    'bills',
    'groceries',
    'other',
  ].map(id => ({id, name: id[0]!.toUpperCase() + id.slice(1)}))
  test('keywords', () => {
    expect(suggestCategory('Dinner at Thalassa', ids)).toBe('food')
    expect(suggestCategory('Cab to airport', ids)).toBe('transport')
    expect(suggestCategory('Rent, January', ids)).toBe('bills')
    expect(suggestCategory('Villa, 4 nights', ids)).toBe('stay')
    expect(suggestCategory('BigBasket order', ids)).toBe('groceries')
  })
  test('custom category names match too', () =>
    expect(suggestCategory('Gym fees', [...ids, {id: 'x', name: 'Gym'}])).toBe(
      'x',
    ))
  test('nothing to suggest', () =>
    expect(suggestCategory('Misc', ids)).toBeUndefined())
})
