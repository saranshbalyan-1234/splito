import {describe, expect, test} from 'bun:test'

import {emptyForm, type ExpenseForm} from './form'
import {formWithGroup} from './groupPick'

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
    expect(formWithGroup(base(), goa, 'me', {}).currency).toBe('INR')
  })
  test('an amount already typed keeps its currency', () => {
    const f = formWithGroup(base({amount: '45'}), goa, 'me', {})
    expect(f.currency).toBe('EUR')
    expect(f.amount).toBe('45')
  })
  test('a currency the user picked is never overwritten', () => {
    expect(
      formWithGroup(base(), goa, 'me', {isCurrencyPicked: true}).currency,
    ).toBe('EUR')
  })
  test('edit mode never changes the currency', () => {
    expect(formWithGroup(base(), goa, 'me', {isEdit: true}).currency).toBe(
      'EUR',
    )
  })
  test('people unticked and still in the group stay unticked', () => {
    const f = formWithGroup(base({excluded: ['sam', 'ghost']}), goa, 'me', {})
    expect(f.excluded).toEqual(['sam'])
    expect(f.people).toEqual(['me', 'riya', 'sam', 'lena'])
  })
  test('former members are left out', () => {
    const g = {
      ...goa,
      members: [...goa.members, {personId: 'old', leftAt: 5}],
    }
    expect(formWithGroup(base(), g, 'me', {}).people).not.toContain('old')
  })
})
