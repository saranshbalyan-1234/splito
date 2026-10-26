import {type CurrencyCode, formatAmount} from '@splito/domain'

/** Frames in a balance count animation (about 60 fps over AMOUNT_DURATION_MS). */
export const AMOUNT_STEPS = 36

/** Length of a balance count animation. */
export const AMOUNT_DURATION_MS = 600

/** An amount in exact minor units with its currency. */
export type Money = {minor: bigint; currency: CurrencyCode}

/**
 * Intermediate values from `from` to `to` on an ease-out-cubic curve, in exact
 * minor units. The curve is evaluated as (n^3 - (n-k)^3) / n^3 with bigint
 * division, so no float ever touches money and the last value is exactly `to`.
 */
export function amountSteps(from: bigint, to: bigint, steps: number): bigint[] {
  if (!Number.isInteger(steps) || steps < 1)
    throw new RangeError(`steps must be a positive integer, got ${steps}`)
  const n = BigInt(steps)
  const n3 = n ** 3n
  const delta = to - from
  const out: bigint[] = []
  for (let k = 1n; k <= n; k++)
    out.push(from + (delta * (n3 - (n - k) ** 3n)) / n3)
  return out
}

/**
 * Display strings for a count animation from `from` to `to`. Returns only the
 * final value when there is nothing to animate (first render, same amount) or
 * the currency changed - never interpolate across currencies.
 */
export function amountFrames(
  from: Money | undefined,
  to: Money,
  locale: string,
  steps = AMOUNT_STEPS,
): string[] {
  if (!from || from.currency !== to.currency || from.minor === to.minor) {
    return [formatAmount(to.minor, to.currency, locale)]
  }
  return amountSteps(from.minor, to.minor, steps).map(m =>
    formatAmount(m, to.currency, locale),
  )
}
