import {describe, expect, test} from 'bun:test'

import {amountReadings, cleanAmountText, evaluateAmount} from '../src/calc'

describe('F-310 shorthand', () => {
  test('1.5L is 150000.00 INR and 2k is 2000', () => {
    expect(evaluateAmount('1.5L', 'INR')).toBe(15000000n)
    expect(evaluateAmount('2k', 'INR')).toBe(200000n)
  })
  test('lakh, crore and million spellings, any case', () => {
    expect(evaluateAmount('2 lakh', 'INR')).toBe(20000000n)
    expect(evaluateAmount('3lac', 'INR')).toBe(30000000n)
    expect(evaluateAmount('1.2cr', 'INR')).toBe(1200000000n)
    expect(evaluateAmount('1 Crore', 'INR')).toBe(1000000000n)
    expect(evaluateAmount('2.5m', 'USD')).toBe(250000000n)
    expect(evaluateAmount('2.5K', 'USD')).toBe(250000n)
  })
  test('shorthand works inside a sum', () =>
    expect(evaluateAmount('2k + 500', 'INR')).toBe(250000n))
  test('a shorthand that lands between minor units is too precise, never rounded', () => {
    expect(() => evaluateAmount('1.234567k', 'INR')).toThrow(
      'TOO_MANY_DECIMALS',
    )
    expect(evaluateAmount('1.23456k', 'INR')).toBe(123456n)
    expect(evaluateAmount('1.2345k', 'INR')).toBe(123450n)
    expect(() => evaluateAmount('1.5k', 'JPY')).not.toThrow()
    expect(() => evaluateAmount('1.0005k', 'JPY')).toThrow('TOO_MANY_DECIMALS')
  })
  test('shorthand off: suffixes are not numbers', () =>
    expect(() => evaluateAmount('2k', 'INR', '.', {shorthand: false})).toThrow(
      'INVALID_AMOUNT',
    ))
  test('a comma decimal mark with shorthand', () =>
    expect(evaluateAmount('1,5k', 'EUR', ',')).toBe(150000n))
})

describe('F-310 native digits', () => {
  test('Devanagari', () => expect(evaluateAmount('१२००', 'INR')).toBe(120000n))
  test('Arabic-Indic and Persian, with the Arabic decimal mark', () => {
    expect(evaluateAmount('١٢٫٥', 'AED')).toBe(1250n)
    expect(evaluateAmount('۱۲۰۰', 'INR')).toBe(120000n)
  })
  test('Devanagari inside a sum', () =>
    expect(evaluateAmount('१०० + ५०', 'INR')).toBe(15000n))
})

describe('F-310 locales', () => {
  test('1.234,56 under de-DE is 1234.56', () =>
    expect(evaluateAmount('1.234,56', 'EUR', ',')).toBe(123456n))
})

describe('F-310 paste cleanup', () => {
  test('rupee symbol and Indian grouping', () => {
    expect(evaluateAmount('₹1,20,000.50', 'INR')).toBe(12000050n)
    expect(evaluateAmount('₹1,234.50', 'INR')).toBe(123450n)
  })
  test('codes and symbol words before or after', () => {
    expect(evaluateAmount('Rs. 1,200', 'INR')).toBe(120000n)
    expect(evaluateAmount('INR 450', 'INR')).toBe(45000n)
    expect(evaluateAmount('1.234,50 €', 'EUR', ',')).toBe(123450n)
    expect(evaluateAmount('usd 12', 'USD')).toBe(1200n)
    expect(evaluateAmount('S$ 40', 'SGD')).toBe(4000n)
  })
  test('cleanAmountText drops what an amount can never hold and keeps the rest as typed', () => {
    expect(cleanAmountText('₹1,20,000.50')).toBe('1,20,000.50')
    expect(cleanAmountText('Rs. 1,200')).toBe('1,200')
    expect(cleanAmountText('1.234,50 €')).toBe('1.234,50')
    expect(cleanAmountText('1200 + 300')).toBe('1200 + 300')
    expect(cleanAmountText('1.5L')).toBe('1.5L')
    expect(cleanAmountText('१२००')).toBe('१२००')
  })
})

describe('F-310 ambiguous input asks', () => {
  test('"1,234" in a comma-decimal locale is ambiguous', () => {
    expect(() => evaluateAmount('1,234', 'EUR', ',')).toThrow(
      'AMBIGUOUS_AMOUNT',
    )
    expect(amountReadings('1,234', 'EUR', ',')).toEqual({grouped: 123400n})
  })
  test('both readings when the currency has three decimals', () =>
    expect(amountReadings('1,234', 'BHD', ',')).toEqual({
      grouped: 1234000n,
      decimal: 1234n,
    }))
  test('"1.234" in a dot-decimal locale asks too', () => {
    expect(() => evaluateAmount('1.234', 'INR')).toThrow('AMBIGUOUS_AMOUNT')
    expect(amountReadings('1.234', 'INR', '.')).toEqual({grouped: 123400n})
  })
  test('the chosen reading resolves it', () => {
    expect(evaluateAmount('1,234', 'EUR', ',', {reading: 'grouped'})).toBe(
      123400n,
    )
    expect(evaluateAmount('1,234', 'BHD', ',', {reading: 'decimal'})).toBe(
      1234n,
    )
    expect(() =>
      evaluateAmount('1,234', 'EUR', ',', {reading: 'decimal'}),
    ).toThrow('TOO_MANY_DECIMALS')
  })
  test('not ambiguous: grouping by the other mark, a leading zero, other lengths, shorthand', () => {
    expect(amountReadings('1,234', 'INR', '.')).toBeNull()
    expect(amountReadings('0,500', 'EUR', ',')).toBeNull()
    expect(amountReadings('12,50', 'EUR', ',')).toBeNull()
    expect(amountReadings('1.234,5', 'EUR', ',')).toBeNull()
    expect(amountReadings('1,234k', 'EUR', ',')).toBeNull()
  })
})
