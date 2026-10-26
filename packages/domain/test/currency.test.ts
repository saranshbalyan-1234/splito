import {describe, expect, test} from 'bun:test'

import {formatAmount, getCurrency, parseAmount} from '../src/currency'

describe('parseAmount', () => {
  test('scale 2', () => expect(parseAmount('12.34', 'INR')).toBe(1234n))
  test('scale 0', () => expect(parseAmount('1200', 'JPY')).toBe(1200n))
  test('scale 3', () => expect(parseAmount('12.345', 'BHD')).toBe(12345n))
  test('fewer decimals than scale', () => expect(parseAmount('12.5', 'INR')).toBe(1250n))
  test('negative', () => expect(parseAmount('-5', 'INR')).toBe(-500n))
  test('whitespace trimmed', () => expect(parseAmount(' 7 ', 'INR')).toBe(700n))
  test('too many decimals for INR', () =>
    expect(() => parseAmount('12.345', 'INR')).toThrow('TOO_MANY_DECIMALS'))
  test('any decimals for JPY', () =>
    expect(() => parseAmount('12.5', 'JPY')).toThrow('TOO_MANY_DECIMALS'))
  test('grouping separators rejected', () =>
    expect(() => parseAmount('1,200.50', 'INR')).toThrow('INVALID_AMOUNT'))
  test('empty rejected', () => expect(() => parseAmount('', 'INR')).toThrow('INVALID_AMOUNT'))
  test('lone dot rejected', () => expect(() => parseAmount('.', 'INR')).toThrow('INVALID_AMOUNT'))
  test('out of range', () =>
    expect(() => parseAmount('10000000000000.00', 'INR')).toThrow('OUT_OF_RANGE'))
})

describe('currencies', () => {
  test('unknown code', () => expect(() => getCurrency('XXX')).toThrow('UNKNOWN_CURRENCY'))
  test('scales', () => {
    expect(getCurrency('JPY').scale).toBe(0)
    expect(getCurrency('KWD').scale).toBe(3)
    expect(getCurrency('INR').scale).toBe(2)
  })
})

describe('formatAmount', () => {
  test('Indian grouping', () => expect(formatAmount(10000000n, 'INR', 'en-IN')).toBe('₹1,00,000.00'))
  test('JPY no decimals', () => expect(formatAmount(1200n, 'JPY', 'en-US')).toBe('¥1,200'))
  test('BHD three decimals', () => expect(formatAmount(12345n, 'BHD', 'en-US')).toMatch(/12\.345/))
  test('negative', () => expect(formatAmount(-1250n, 'INR', 'en-IN')).toBe('-₹12.50'))
  test('beyond float precision stays exact', () =>
    expect(formatAmount(999999999999999n, 'INR', 'en-US')).toBe('₹9,999,999,999,999.99'))
})
