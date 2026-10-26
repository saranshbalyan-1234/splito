import {assertInRange, DomainError} from './errors'
import {type RepaymentRecord} from './ledger'

/**
 * A decimal-integer string of minor units (the storage and wire form,
 * `"-1250"`) as bigint. Anything else is `INVALID_AMOUNT` and a magnitude of
 * `MAX_MINOR` or more is `OUT_OF_RANGE`; never a default of zero.
 */
export function parseMinor(s: string): bigint {
  if (!/^-?\d+$/.test(s)) throw new DomainError('INVALID_AMOUNT')
  return assertInRange(BigInt(s))
}

/** Ascending order of two amounts (-1, 0, 1), exact at any size. For `sort`. */
export function compareMinor(a: bigint, b: bigint): -1 | 0 | 1 {
  return a < b ? -1 : a > b ? 1 : 0
}

/**
 * `v / max` as a number in [0, 1], for geometry only (pixels, angles), to six
 * decimals. Amounts themselves stay bigint and are only shown via `formatAmount`.
 */
export function fraction(v: bigint, max: bigint): number {
  if (max <= 0n || v <= 0n) return 0
  if (v >= max) return 1
  return Number((v * 1_000_000n) / max) / 1_000_000
}

/** Where `v` sits between `lo` and `hi`, in [0, 1] (geometry only). */
export function fractionBetween(v: bigint, lo: bigint, hi: bigint): number {
  return fraction(v - lo, hi - lo)
}

/** `part` as a percent of `whole`, one decimal, computed in bigint so it never drifts from the amounts. */
export function percentOf(part: bigint, whole: bigint): number {
  if (whole <= 0n) return 0
  return Number((part * 1000n) / whole) / 10
}

/**
 * Intermediate values from `from` to `to` on an ease-out-cubic curve, in exact
 * minor units. The curve is evaluated as (n^3 - (n-k)^3) / n^3 with bigint
 * division, so no float ever touches money and the last value is exactly `to`.
 */
export function amountSteps(from: bigint, to: bigint, steps: number): bigint[] {
  if (!Number.isInteger(steps) || steps < 1) throw new RangeError(`steps must be a positive integer, got ${steps}`)
  const n = BigInt(steps)
  const n3 = n ** 3n
  const delta = to - from
  const out: bigint[] = []
  for (let k = 1n; k <= n; k++) out.push(from + (delta * (n3 - (n - k) ** 3n)) / n3)
  return out
}

/** A repayment as cash for `person`: what they sent is negative, what they received positive, else zero. */
export function repaymentFlow(r: Pick<RepaymentRecord, 'from' | 'to' | 'amount'>, person: string): bigint {
  if (r.from === person) return -r.amount
  if (r.to === person) return r.amount
  return 0n
}
