import {describe, expect, test} from 'bun:test'

import {
  evaluateAmount,
  expenseNet,
  isExpression,
  parseBasisPoints,
  remainingMinor,
  sumMinor,
} from '../src/calc'
import {computeShares} from '../src/split'

describe('evaluateAmount', () => {
  test('plain amount behaves like parseAmount', () =>
    expect(evaluateAmount('12.34', 'INR')).toBe(1234n))
  test('grouping and spaces ignored', () =>
    expect(evaluateAmount(' 1,20,000 ', 'INR')).toBe(12000000n))
  test('addition', () =>
    expect(evaluateAmount('1200+300', 'INR')).toBe(150000n))
  test('subtraction with unicode minus', () =>
    expect(evaluateAmount('500 − 120.5', 'INR')).toBe(37950n))
  test('x and × multiply', () => {
    expect(evaluateAmount('250x3', 'INR')).toBe(75000n)
    expect(evaluateAmount('250×3', 'INR')).toBe(75000n)
    expect(evaluateAmount('250*3', 'INR')).toBe(75000n)
  })
  test('precedence: multiply before add', () =>
    expect(evaluateAmount('100+20x3', 'INR')).toBe(16000n))
  test('division rounds half away from zero to the minor unit', () => {
    expect(evaluateAmount('100/3', 'INR')).toBe(3333n)
    expect(evaluateAmount('2/3', 'INR')).toBe(67n)
    expect(evaluateAmount('1000÷8', 'JPY')).toBe(125n)
    expect(evaluateAmount('1/8', 'BHD')).toBe(125n)
  })
  test('expression results round, plain amounts never do', () => {
    expect(evaluateAmount('12.345+0', 'INR')).toBe(1235n)
    expect(() => evaluateAmount('12.345', 'INR')).toThrow('TOO_MANY_DECIMALS')
  })
  test('divide by zero', () =>
    expect(() => evaluateAmount('10/0', 'INR')).toThrow('DIVIDE_BY_ZERO'))
  test('trailing operator is incomplete', () =>
    expect(() => evaluateAmount('12+', 'INR')).toThrow('INCOMPLETE'))
  test('garbage rejected', () => {
    expect(() => evaluateAmount('12++3', 'INR')).toThrow('INVALID_AMOUNT')
    expect(() => evaluateAmount('abc', 'INR')).toThrow('INVALID_AMOUNT')
    expect(() => evaluateAmount('', 'INR')).toThrow('INVALID_AMOUNT')
  })
  test('out of range', () =>
    expect(() => evaluateAmount('9999999999999x1000', 'INR')).toThrow(
      'OUT_OF_RANGE',
    ))
  test('isExpression', () => {
    expect(isExpression('12.5')).toBe(false)
    expect(isExpression('12+5')).toBe(true)
    expect(isExpression('12 x 5')).toBe(true)
  })
})

describe('parseBasisPoints', () => {
  test('whole and decimal percents', () => {
    expect(parseBasisPoints('50')).toBe(5000)
    expect(parseBasisPoints('33.33')).toBe(3333)
    expect(parseBasisPoints('12.5')).toBe(1250)
    expect(parseBasisPoints('')).toBe(0)
  })
  test('rejects more than two decimals and over 100', () => {
    expect(() => parseBasisPoints('33.333')).toThrow('INVALID_PERCENT')
    expect(() => parseBasisPoints('100.01')).toThrow('INVALID_PERCENT')
    expect(() => parseBasisPoints('-1')).toThrow('INVALID_PERCENT')
  })
})

describe('sums', () => {
  test('sumMinor and remainingMinor', () => {
    expect(sumMinor([1n, 2n, 3n])).toBe(6n)
    expect(remainingMinor(10n, [3n, 4n])).toBe(3n)
  })
})

describe('expenseNet', () => {
  test('paid minus share', () =>
    expect(
      expenseNet({payers: {a: 300n}, shares: {a: 100n, b: 100n, c: 100n}}),
    ).toEqual({a: 200n, b: -100n, c: -100n}))
})

describe('adjusted split (equal with adjustments)', () => {
  test('adjustments on top of an equal split', () =>
    expect(
      computeShares(1000n, {
        mode: 'adjusted',
        participants: ['a', 'b', 'c'],
        adjustments: {a: 100n},
      }),
    ).toEqual({a: 400n, b: 300n, c: 300n}))
  test('negative adjustment', () =>
    expect(
      computeShares(900n, {
        mode: 'adjusted',
        participants: ['a', 'b'],
        adjustments: {b: -100n},
      }),
    ).toEqual({a: 500n, b: 400n}))
  test('remainder uses the stable tie-break', () =>
    expect(
      computeShares(101n, {
        mode: 'adjusted',
        participants: ['b', 'a'],
        adjustments: {},
      }),
    ).toEqual({a: 51n, b: 50n}))
  test('adjustments larger than the total', () =>
    expect(() =>
      computeShares(100n, {
        mode: 'adjusted',
        participants: ['a', 'b'],
        adjustments: {a: 150n},
      }),
    ).toThrow('ADJUSTMENT_TOO_LARGE'))
  test('adjustment for someone outside the split', () =>
    expect(() =>
      computeShares(100n, {
        mode: 'adjusted',
        participants: ['a'],
        adjustments: {z: 10n},
      }),
    ).toThrow('NOT_A_PARTICIPANT'))
})
