import {describe, expect, test} from 'bun:test'

import {isPersonalExpense, personNet} from '../src/ledger'

test('payer who also shares lent the rest', () =>
  expect(personNet({payers: {me: 300n}, shares: {me: 100n, x: 200n}}, 'me')).toBe(200n))
test('participant who did not pay borrowed their share', () =>
  expect(personNet({payers: {x: 300n}, shares: {me: 100n, x: 200n}}, 'me')).toBe(-100n))
test('uninvolved person is zero', () => expect(personNet({payers: {x: 1n}, shares: {x: 1n}}, 'me')).toBe(0n))

describe('isPersonalExpense (owner 230)', () => {
  test('only me paid and only I share it', () => {
    expect(isPersonalExpense({payers: {me: 120n}, shares: {me: 120n}}, 'me')).toBe(true)
    expect(isPersonalExpense({payers: {me: 120n, riya: 0n}, shares: {me: 120n}}, 'me')).toBe(true)
  })
  test('anyone else on it, or me not on it, is not personal', () => {
    expect(isPersonalExpense({payers: {me: 120n}, shares: {me: 60n, riya: 60n}}, 'me')).toBe(false)
    expect(isPersonalExpense({payers: {riya: 120n}, shares: {me: 120n}}, 'me')).toBe(false)
    expect(isPersonalExpense({payers: {riya: 120n}, shares: {riya: 120n}}, 'me')).toBe(false)
    expect(isPersonalExpense({payers: {}, shares: {}}, 'me')).toBe(false)
  })
})
