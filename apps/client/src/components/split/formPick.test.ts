import {describe, expect, test} from 'bun:test'

import {emptyForm, type ExpenseForm} from './form'
import {formWithCurrency, formWithGroup, hasMoneyText} from './formPick'

const base = (over: Partial<ExpenseForm> = {}): ExpenseForm => ({
  ...emptyForm({
    me: 'me',
    currency: 'EUR',
    date: '2026-10-26',
    people: ['me', 'riya', 'sam'],
    groupId: null,
    mode: 'equal',
  }),
  ...over,
})

const one = () => 1
const goa = {
  id: 'g1',
  currency: 'INR',
  members: ['me', 'riya', 'sam', 'lena'].map(personId => ({
    personId,
    leftAt: null,
  })),
}

describe('formWithGroup (audit M5)', () => {
  test('add mode, untouched currency, no amount: takes the group home currency', () => {
    expect(formWithGroup(base(), goa, 'me', one, {}).currency).toBe('INR')
  })
  test('an amount already typed keeps its currency', () => {
    const f = formWithGroup(base({amount: '45'}), goa, 'me', one, {})
    expect(f.currency).toBe('EUR')
    expect(f.amount).toBe('45')
  })
  test('a currency the user picked is never overwritten', () => {
    expect(
      formWithGroup(base(), goa, 'me', one, {isCurrencyPicked: true}).currency,
    ).toBe('EUR')
  })
  test('edit mode never changes the currency', () => {
    expect(formWithGroup(base(), goa, 'me', one, {isEdit: true}).currency).toBe(
      'EUR',
    )
  })
  test('people unticked and still in the group stay unticked', () => {
    const f = formWithGroup(
      base({excluded: ['sam', 'ghost']}),
      goa,
      'me',
      one,
      {},
    )
    expect(f.excluded).toEqual(['sam'])
    expect(f.people).toEqual(['me', 'riya', 'sam', 'lena'])
  })
  test('former members are left out', () => {
    const g = {
      ...goa,
      members: [...goa.members, {personId: 'old', leftAt: 5}],
    }
    expect(formWithGroup(base(), g, 'me', one, {}).people).not.toContain('old')
  })
})

describe('formWithCurrency (audit M15)', () => {
  const unitOf = (c: string) => ({INR: 100, EUR: 5})[c] ?? 1
  test('rounding on: the new currency brings its own unit', () => {
    const f = base({roundTo: 100, currency: 'INR'})
    expect(formWithCurrency(f, 'EUR', unitOf)).toMatchObject({
      currency: 'EUR',
      roundTo: 5,
    })
    expect(formWithCurrency(f, 'JPY', unitOf).roundTo).toBe(1)
  })
  test('rounding off stays off', () => {
    expect(formWithCurrency(base({roundTo: 0}), 'INR', unitOf).roundTo).toBe(0)
  })
  test('a group that pre-fills its currency also switches the unit', () => {
    const f = formWithGroup(base({roundTo: 5}), goa, 'me', unitOf, {})
    expect(f).toMatchObject({currency: 'INR', roundTo: 100})
  })
})

describe('pre-filling the group currency (audit M5)', () => {
  const typed: Array<[string, Partial<ExpenseForm>]> = [
    [
      'an item amount',
      {items: [{key: 'i', name: '', amount: '12', people: []}]},
    ],
    ['an exact amount', {exact: {sam: '5'}}],
    ['a paid amount', {paid: {me: '10'}}],
    ['an adjustment', {adjust: {sam: '1'}}],
    ['tax', {tax: '3'}],
    ['a tip', {tip: '3'}],
    ['a service charge', {service: '3'}],
    ['a discount', {discount: '3'}],
  ]
  test('blank fields hold no money text', () => {
    expect(hasMoneyText(base())).toBe(false)
    expect(hasMoneyText(base({exact: {sam: '  '}}))).toBe(false)
  })
  for (const [name, over] of typed)
    test(`${name} typed keeps the form's currency`, () => {
      const f = base(over)
      expect(hasMoneyText(f)).toBe(true)
      expect(formWithGroup(f, goa, 'me', one, {}).currency).toBe('EUR')
    })
})
