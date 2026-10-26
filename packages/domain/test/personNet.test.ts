import {expect, test} from 'bun:test'

import {personNet} from '../src/ledger'

test('payer who also shares lent the rest', () =>
  expect(personNet({payers: {me: 300n}, shares: {me: 100n, x: 200n}}, 'me')).toBe(200n))
test('participant who did not pay borrowed their share', () =>
  expect(personNet({payers: {x: 300n}, shares: {me: 100n, x: 200n}}, 'me')).toBe(-100n))
test('uninvolved person is zero', () => expect(personNet({payers: {x: 1n}, shares: {x: 1n}}, 'me')).toBe(0n))
