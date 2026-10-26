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
  test('a comma decimal mark (de-DE) reads 12,50 as 12.50, not 1250', () =>
    expect(evaluateForm(base({amount: '12,50'}), 'UTC', ',').total).toBe(1250n))
  test('negative payer, exact and item rows are refused', () => {
    const paid = evaluateForm(
      base({payerMode: 'multiple', paid: {me: '400', riya: '-100'}}),
      'UTC',
    )
    expect(paid.rowErrors['paid:riya']).toBe('NEGATIVE_AMOUNT')
    expect(paid.draft).toBeUndefined()
    const exact = evaluateForm(
      base({mode: 'exact', exact: {me: '0-50', riya: '350'}}),
      'UTC',
    )
    expect(exact.rowErrors.me).toBe('NEGATIVE_AMOUNT')
    expect(exact.draft).toBeUndefined()
  })
  test('an adjustment that pushes a share below zero is refused', () => {
    const r = evaluateForm(
      base({mode: 'adjusted', adjust: {me: '-400'}, people: ['me', 'riya']}),
      'UTC',
    )
    expect(r.error).toBe('SIGN_MISMATCH')
    expect(r.draft).toBeUndefined()
    expect(
      evaluateForm(base({mode: 'adjusted', adjust: {me: '-50'}}), 'UTC').draft,
    ).toBeDefined()
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
  test('item portions: 2 of 3 beers, and they survive a round trip', () => {
    const items = [
      {
        key: 'a',
        name: 'Beers',
        amount: '300',
        people: ['me', 'riya'],
        portions: {riya: 2},
      },
    ]
    const r = evaluateForm(base({mode: 'items', items}), 'UTC')
    expect(r.error).toBeUndefined()
    expect(r.shares).toEqual({me: 10000n, riya: 20000n})
    expect(r.itemParts).toEqual({a: {me: 10000n, riya: 20000n}})
    const split = r.draft!.split
    expect(split.mode === 'items' && split.items[0]!.participants).toEqual([
      'me',
      {id: 'riya', weight: 2},
    ])
    const back = formFromExpense(
      {...r.draft!, shares: r.shares!} as unknown as Expense,
      'me',
    )
    expect(back.items[0]!.people).toEqual(['me', 'riya'])
    expect(back.items[0]!.portions).toEqual({riya: 2})
  })
  test('service charge joins tax and tip, and survives a round trip', () => {
    const items = [
      {key: 'a', name: 'Pizza', amount: '200', people: ['me', 'riya']},
      {key: 'b', name: 'Juice', amount: '100', people: ['sam']},
    ]
    const r = evaluateForm(
      base({mode: 'items', items, amount: '330', service: '30'}),
      'UTC',
    )
    expect(r.error).toBeUndefined()
    expect(r.itemsTotal).toBe(33000n)
    expect(r.shares).toEqual({me: 11000n, riya: 11000n, sam: 11000n})
    const split = r.draft!.split
    expect(split.mode === 'items' && split.service).toBe(3000n)
    const back = formFromExpense(
      {...r.draft!, shares: r.shares!} as unknown as Expense,
      'me',
    )
    expect(back.service).toBe('30.00')
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
    const r = evaluateForm(base({mode: 'exact', exact: {me: '1.2345'}}), 'UTC')
    expect(r.rowErrors.me).toBe('TOO_MANY_DECIMALS')
    // Three decimals could be a thousands group (F-310): the row says it is unclear.
    const r2 = evaluateForm(base({mode: 'exact', exact: {me: '1.234'}}), 'UTC')
    expect(r2.rowErrors.me).toBe('AMBIGUOUS_AMOUNT')
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

describe('F-310 smart amount in the form', () => {
  test('shorthand and pasted symbols', () => {
    expect(evaluateForm(base({amount: '1.5L'}), 'UTC').total).toBe(15000000n)
    expect(evaluateForm(base({amount: '₹1,20,000.50'}), 'UTC').total).toBe(
      12000050n,
    )
    expect(
      evaluateForm(base({amount: '2k'}), 'UTC', '.', {shorthand: false})
        .amountError,
    ).toBe('INVALID_AMOUNT')
  })
  test('an ambiguous amount offers its readings and blocks Save until one is picked', () => {
    const r = evaluateForm(base({amount: '1,234', currency: 'EUR'}), 'UTC', ',')
    expect(r.amountError).toBe('AMBIGUOUS_AMOUNT')
    expect(r.amountReadings).toEqual({grouped: 123400n})
    expect(r.draft).toBeUndefined()
    const picked = evaluateForm(
      base({amount: '1,234', currency: 'EUR', amountReading: 'grouped'}),
      'UTC',
      ',',
    )
    expect(picked.total).toBe(123400n)
    expect(picked.draft).toBeDefined()
  })
})

describe('F-402 cash rounding in the form', () => {
  test('1000 over 3 rounded to 1 gives 334/333/333 and the draft carries the unit', () => {
    const r = evaluateForm(base({amount: '1000', roundTo: 1}), 'UTC')
    expect(r.shares).toEqual({me: 33400n, riya: 33300n, sam: 33300n})
    expect(r.draft?.split).toEqual({
      mode: 'equal',
      participants: ['me', 'riya', 'sam'],
      roundTo: 100n,
    })
    expect(r.cash?.remainder).toBe(0n)
  })
  test('a remainder is shown with who carries it', () => {
    const r = evaluateForm(base({amount: '1000.50', roundTo: 1}), 'UTC')
    expect(r.cash).toEqual({
      shares: r.shares!,
      remainder: 50n,
      remainderTo: 'riya',
    })
  })
  test('rounding off leaves the split as before; exact mode never rounds', () => {
    expect(evaluateForm(base({amount: '1000'}), 'UTC').draft?.split).toEqual({
      mode: 'equal',
      participants: ['me', 'riya', 'sam'],
    })
    const exact = evaluateForm(
      base({mode: 'exact', roundTo: 5, exact: {me: '1000'}, amount: '1000'}),
      'UTC',
    )
    expect(exact.cash).toBeUndefined()
    expect(exact.draft?.split).toEqual({mode: 'exact', amounts: {me: 100000n}})
  })
  test('editing a rounded expense keeps the unit', () => {
    const r = evaluateForm(
      base({amount: '1000', roundTo: 10, mode: 'shares'}),
      'UTC',
    )
    const form = formFromExpense(
      {
        ...r.draft!,
        id: 'e',
        shares: r.shares!,
        deleted: false,
        createdBy: 'me',
      } as unknown as Expense,
      'me',
    )
    expect(form.roundTo).toBe(10)
  })
})
