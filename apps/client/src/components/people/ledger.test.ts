import {expect, test} from 'bun:test'

import {parseTypedAmount, paymentCurrencies, upiPayUrl} from './ledger'

test('typed amounts: grouping ignored, decimal mark by position and scale', () => {
  expect(parseTypedAmount('1,200', 'INR', 'en-IN')).toBe(120000n)
  expect(parseTypedAmount('1,00,000.5', 'INR', 'en-IN')).toBe(10000050n)
  expect(parseTypedAmount(' 12.50 ', 'EUR', 'en')).toBe(1250n)
  expect(parseTypedAmount('12,50', 'EUR', 'de-DE')).toBe(1250n)
  expect(parseTypedAmount('1.234,56', 'EUR', 'de-DE')).toBe(123456n)
  expect(parseTypedAmount('1,000', 'JPY', 'en')).toBe(1000n)
  expect(parseTypedAmount('1.234', 'KWD', 'en')).toBe(1234n)
  expect(parseTypedAmount('1.234', 'KWD', 'de-DE')).toBe(1234000n)
  expect(parseTypedAmount('.5', 'INR', 'en')).toBe(50n)
  for (const bad of ['', 'abc', '-5', '1.2.3x', '1.234', '12.345'])
    expect(() => parseTypedAmount(bad, 'INR', 'en')).toThrow()
})

test('UPI link: payee, name and amount in rupees, INR only', () => {
  expect(
    upiPayUrl({upiId: 'riya@okaxis', name: 'Riya Sharma', amount: 150050n}),
  ).toBe(
    'upi://pay?pa=riya%40okaxis&pn=Riya%20Sharma&am=1500.50&cu=INR&tn=Splito',
  )
})

test('Record payment: open currencies first, the default when settled (audit M8)', () => {
  expect(paymentCurrencies([], 'EUR')).toEqual({
    currencies: ['EUR'],
    initial: 'EUR',
  })
  expect(paymentCurrencies([], undefined).initial).toBe('INR')
  expect(paymentCurrencies(['EUR'], 'INR')).toEqual({
    currencies: ['EUR'],
    initial: 'EUR',
  })
  expect(paymentCurrencies(['EUR', 'INR'], 'INR').initial).toBe('INR')
})
