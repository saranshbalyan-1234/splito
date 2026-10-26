/// <reference types="bun" />
import {expect, test} from 'bun:test'
import {formatAmount} from '@splito/domain'

import {amountFrames, amountSteps} from './amountSteps'

const CASES: [string, bigint, bigint][] = [
  ['INR', 0n, 123456n], // Rs 1,234.56
  ['INR', 99999n, -100n],
  ['JPY', 0n, 5n], // scale 0: fewer distinct values than frames
  ['JPY', 1000000n, 7n],
  ['BHD', 0n, 1234567n], // scale 3
  ['BHD', -1n, 1n],
  ['INR', 0n, 123456789012345678901234567890n], // far past 2^53
  ['BHD', 98765432109876543210987654321n, 1n],
]

for (const [currency, from, to] of CASES) {
  test(`${currency} ${from} -> ${to}: last step and frame are exact`, () => {
    const steps = amountSteps(from, to, 36)
    expect(steps).toHaveLength(36)
    expect(steps.at(-1)).toBe(to)
    const frames = amountFrames(
      {minor: from, currency},
      {minor: to, currency},
      'en-IN',
    )
    expect(frames.at(-1)).toBe(formatAmount(to, currency, 'en-IN'))
  })

  test(`${currency} ${from} -> ${to}: steps move monotonically toward the target`, () => {
    const steps = amountSteps(from, to, 36)
    const dir = to > from ? 1n : -1n
    let prev = from
    for (const s of steps) {
      expect((s - prev) * dir >= 0n).toBe(true)
      prev = s
    }
  })
}

test('every step is a bigint (no float money)', () => {
  for (const s of amountSteps(0n, 10n ** 40n, 36))
    expect(typeof s).toBe('bigint')
})

test('ease-out: the first half of the frames covers most of the distance', () => {
  const steps = amountSteps(0n, 1000n, 36)
  expect(steps[17]! > 800n).toBe(true)
})

test('nothing to animate, first value, or a currency change gives one final frame', () => {
  const to = {minor: 500n, currency: 'INR'}
  expect(amountFrames(undefined, to, 'en-IN')).toEqual([
    formatAmount(500n, 'INR', 'en-IN'),
  ])
  expect(amountFrames(to, to, 'en-IN')).toHaveLength(1)
  // Never interpolate across currencies: USD 100 -> INR 500 jumps straight to INR 500.
  expect(amountFrames({minor: 100n, currency: 'USD'}, to, 'en-IN')).toEqual([
    formatAmount(500n, 'INR', 'en-IN'),
  ])
})

test('rejects a non-positive or fractional step count', () => {
  expect(() => amountSteps(0n, 1n, 0)).toThrow()
  expect(() => amountSteps(0n, 1n, 2.5)).toThrow()
})
