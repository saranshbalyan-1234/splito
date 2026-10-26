import {amountSteps, type CurrencyCode, formatAmount} from '@splito/domain'

/** Frames in a balance count animation (about 60 fps over AMOUNT_DURATION_MS). */
export const AMOUNT_STEPS = 36

/** Length of a balance count animation. */
export const AMOUNT_DURATION_MS = 600

/** An amount in exact minor units with its currency. */
export type Money = {minor: bigint; currency: CurrencyCode}

/* The exact ease-out curve over minor units lives in @splito/domain. */
export {amountSteps} from '@splito/domain'

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
