import {describe, expect, test} from 'bun:test'
import fc from 'fast-check'

import {percentOfMinor, resolveItemAdjustments} from '../src/adjustments'

const amount = (minor: bigint) => ({mode: 'amount' as const, minor})
const percent = (basisPoints: number) => ({mode: 'percent' as const, basisPoints})
const none = amount(0n)

describe('percentOfMinor', () => {
  test('18% GST on INR 1,200.00 is INR 216.00', () => expect(percentOfMinor(120000n, 1800)).toBe(21600n))
  test('rounds half away from zero to the minor unit', () => {
    // 12.5% of 0.01 = 0.00125 -> 0; 50% of 0.01 = 0.005 -> 0.01; and negatives mirror it.
    expect(percentOfMinor(1n, 1250)).toBe(0n)
    expect(percentOfMinor(1n, 5000)).toBe(1n)
    expect(percentOfMinor(-1n, 5000)).toBe(-1n)
    expect(percentOfMinor(3n, 5000)).toBe(2n)
  })
  test('JPY (scale 0): 10% of 1,005 yen is 101 yen (100.5 rounds up)', () => expect(percentOfMinor(1005n, 1000)).toBe(101n))
  test('BHD (scale 3): 12.5% service on BHD 4.321 is BHD 0.540', () => expect(percentOfMinor(4321n, 1250)).toBe(540n))
  test('refuses fractional or negative basis points', () => {
    expect(() => percentOfMinor(100n, 12.5)).toThrow()
    expect(() => percentOfMinor(100n, -1)).toThrow()
  })
})

describe('resolveItemAdjustments', () => {
  test('discount first, then service and tax on the discounted subtotal, tip on it pre-tax', () => {
    // Items 1,000.00; 15% discount = 150.00 -> base 850.00; 12.5% service = 106.25; 18% tax = 153.00; 10% tip = 85.00.
    expect(
      resolveItemAdjustments(100000n, {discount: percent(1500), service: percent(1250), tax: percent(1800), tip: percent(1000)}),
    ).toEqual({discount: 15000n, service: 10625n, tax: 15300n, tip: 8500n})
  })
  test('amounts pass through untouched and do not move the percentage base unless they are the discount', () =>
    expect(resolveItemAdjustments(100000n, {discount: amount(10000n), service: none, tax: percent(1000), tip: amount(5000n)})).toEqual({
      discount: 10000n,
      service: 0n,
      tax: 9000n,
      tip: 5000n,
    }))
  test('JPY: 8% tax on 1,234 yen', () =>
    expect(resolveItemAdjustments(1234n, {discount: none, service: none, tax: percent(800), tip: none}).tax).toBe(99n))
  test('the result is always whole minor units and a percentage never exceeds its base', () =>
    fc.assert(
      fc.property(fc.bigInt({min: 0n, max: 10n ** 12n}), fc.integer({min: 0, max: 10000}), (subtotal, bp) => {
        const r = resolveItemAdjustments(subtotal, {discount: none, service: none, tax: percent(bp), tip: none})
        expect(r.tax >= 0n && r.tax <= subtotal).toBe(true)
      }),
    ))
})
