import {expect, test} from 'bun:test'

import {hasOpenBalance, owedByThem} from './owed'

const row = (groupId: string | null, currency: string, amount: bigint, person = 'riya') => ({person, groupId, currency, amount})

test('what they owe me is per currency, from the parts they owe, never netted across groups', () => {
  const rows = [row(null, 'INR', 50000n), row('goa', 'INR', -20000n), row('goa', 'USD', 1500n), row('pune', 'JPY', 1200n)]
  // INR: net +300 so they owe me, 500 of it directly (the 200 I owe them in Goa is not subtracted).
  expect(owedByThem(rows, 'riya')).toEqual({INR: 50000n, USD: 1500n, JPY: 1200n})
})

test('currencies where I owe them, or nothing is open, are left out', () => {
  expect(owedByThem([row(null, 'INR', -50000n), row(null, 'EUR', 700n)], 'riya')).toEqual({EUR: 700n})
  expect(owedByThem([row(null, 'INR', -50000n)], 'riya')).toEqual({})
  expect(owedByThem([row(null, 'INR', 50000n, 'sam')], 'riya')).toEqual({})
  expect(owedByThem([], 'riya')).toEqual({})
})

test('a net that is owed overall but cancels part by part still counts only the positive parts', () => {
  expect(owedByThem([row(null, 'INR', 1000n), row('goa', 'INR', -1000n)], 'riya')).toEqual({})
})

test('open means any part is not zero, in either direction', () => {
  expect(hasOpenBalance([row(null, 'INR', -50000n)], 'riya')).toBe(true)
  expect(hasOpenBalance([row(null, 'INR', 1000n), row('goa', 'INR', -1000n)], 'riya')).toBe(true)
  expect(hasOpenBalance([], 'riya')).toBe(false)
  expect(hasOpenBalance([row(null, 'INR', 0n)], 'riya')).toBe(false)
})
