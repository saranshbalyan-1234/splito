import {describe, expect, test} from 'bun:test'

import {
  amountReadings,
  amountInputText,
  evaluateAmount,
  numberReadings,
  parseBasisPoints,
} from '../src/calc'
import {CURRENCIES, getCurrency} from '../src/currency'

/* F-111: regressions for logic-audit findings (docs/audit/AUDIT-2026-10-27.md). */

describe('C1/C2: text the app writes reads back to the same amount', () => {
  const cases: Array<[string, bigint]> = [
    ['JPY', 1234n],
    ['JPY', 5n],
    ['INR', 123456n],
    ['EUR', 1250n],
    ['BHD', 1234n],
    ['BHD', 12345n],
    ['KWD', 7500n],
    ['OMR', 1234567n],
    ['BHD', 5000n],
  ]
  for (const mark of ['.', ','] as const)
    for (const [code, minor] of cases)
      test(`${code} ${minor} under "${mark}"`, () => {
        const text = amountInputText(minor, code, mark)
        expect(evaluateAmount(text, code, mark, {reading: 'decimal'})).toBe(
          minor,
        )
      })
  test('written in the locale mark', () => {
    expect(amountInputText(1234n, 'BHD', ',')).toBe('1,234')
    expect(amountInputText(1234n, 'BHD', '.')).toBe('1.234')
    expect(amountInputText(1250n, 'EUR', ',')).toBe('12,50')
    expect(amountInputText(1234n, 'JPY', ',')).toBe('1234')
  })
  test('the old "." prefill in a comma locale was the 1000x bug', () =>
    expect(evaluateAmount('1.234', 'BHD', ',', {reading: 'decimal'})).toBe(
      1234000n,
    ))
})

describe('M1: a repeated mark is never the decimal point', () => {
  test('KWD 1.000.000 under "." is a million dinars', () =>
    expect(evaluateAmount('1.000.000', 'KWD', '.')).toBe(1000000000n))
  test('OMR 1,000,000 under ","', () =>
    expect(evaluateAmount('1,000,000', 'OMR', ',')).toBe(1000000000n))
  test('BHD 1.234.567 under "."', () =>
    expect(evaluateAmount('1.234.567', 'BHD', '.')).toBe(1234567000n))
  test('malformed groups are refused, not guessed', () => {
    expect(() => evaluateAmount('1.2.3', 'USD', '.')).toThrow('INVALID_AMOUNT')
    expect(() => evaluateAmount('12,34,56', 'INR', '.')).toThrow(
      'INVALID_AMOUNT',
    )
  })
  test('Indian and Western grouping still read', () => {
    expect(evaluateAmount('1,00,000', 'INR', '.')).toBe(10000000n)
    expect(evaluateAmount('1.234.567,89', 'EUR', ',')).toBe(123456789n)
  })
})

describe('M2: a 1-2 digit tail is a decimal in 0-decimal currencies too', () => {
  test('2.5k JPY under "," is 2,500', () =>
    expect(evaluateAmount('2.5k', 'JPY', ',')).toBe(2500n))
  test('2.5 JPY is too precise, never 25', () =>
    expect(() => evaluateAmount('2.5', 'JPY', ',')).toThrow(
      'TOO_MANY_DECIMALS',
    ))
  test('1.5L JPY under "," is 150,000', () =>
    expect(evaluateAmount('1.5L', 'JPY', ',')).toBe(150000n))
  test('1,5 JPY under "." is too precise; 1,5k is 1,500 like INR', () => {
    expect(() => evaluateAmount('1,5', 'JPY', '.')).toThrow('TOO_MANY_DECIMALS')
    expect(evaluateAmount('1,5k', 'JPY', '.')).toBe(1500n)
    expect(evaluateAmount('1,5k', 'INR', '.')).toBe(150000n)
  })
})

describe('M7: percents take the comma decimal mark', () => {
  test('33,33 and 12,5', () => {
    expect(parseBasisPoints('33,33')).toBe(3333)
    expect(parseBasisPoints('12,5')).toBe(1250)
  })
  test('still no grouping in a percent', () =>
    expect(() => parseBasisPoints('1,2,3')).toThrow('INVALID_PERCENT'))
})

describe('m8: an ambiguous operand in a sum asks too', () => {
  test('1,234+1 under "," asks instead of rounding to 2.23', () => {
    expect(() => evaluateAmount('1,234+1', 'EUR', ',')).toThrow(
      'AMBIGUOUS_AMOUNT',
    )
    expect(amountReadings('1,234+1', 'EUR', ',')).toEqual({
      grouped: 123500n,
      decimal: 223n,
    })
    expect(evaluateAmount('1,234+1', 'EUR', ',', {reading: 'grouped'})).toBe(
      123500n,
    )
  })
})

describe('m9: an expression may start with a minus', () => {
  test('-5+3 is -2', () => expect(evaluateAmount('-5+3', 'INR')).toBe(-200n))
  test('−10 x 2 with the unicode minus', () =>
    expect(evaluateAmount('−10 x 2', 'INR')).toBe(-2000n))
})

describe('m13: prototype keys are not currencies', () => {
  test('getCurrency refuses toString, constructor and __proto__', () => {
    for (const key of ['toString', 'constructor', '__proto__', 'hasOwnProperty'])
      expect(() => getCurrency(key)).toThrow('UNKNOWN_CURRENCY')
  })
  test('lookups by key see only real codes', () => {
    expect('toString' in CURRENCIES).toBe(false)
    expect(CURRENCIES['valueOf']).toBeUndefined()
  })
})

describe('M14: numberReadings for lenient lookups', () => {
  test('Indian grouping, German grouping and decimals', () => {
    expect(numberReadings('1,00,000', '.')).toEqual(['100000'])
    expect(numberReadings('1.000', ',')).toEqual(['1000'])
    expect(numberReadings('1.234,56', ',')).toEqual(['1234.56'])
  })
  test('an ambiguous number means either', () =>
    expect(numberReadings('1.000', '.')).toEqual(['1000', '1.000']))
  test('not a number', () => {
    expect(numberReadings('abc', '.')).toEqual([])
    expect(numberReadings('1.2.3', '.')).toEqual([])
  })
})
