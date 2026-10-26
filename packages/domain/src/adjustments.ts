import {DomainError} from './errors'

/** The charges an itemised bill can carry on top of (or off) its items. */
export type AdjustmentKind = 'tax' | 'tip' | 'service' | 'discount'

/** One charge as typed: money in minor units, or a rate in integer basis points (18% = 1800). */
export type AdjustmentInput = {mode: 'amount'; minor: bigint} | {mode: 'percent'; basisPoints: number}

/** `basisPoints` of `minor`, rounded half away from zero to the minor unit. */
export function percentOfMinor(minor: bigint, basisPoints: number): bigint {
  if (!Number.isInteger(basisPoints) || basisPoints < 0) throw new DomainError('INVALID_PERCENT')
  const scaled = (minor < 0n ? -minor : minor) * BigInt(basisPoints)
  const rounded = (scaled + 5000n) / 10000n
  return minor < 0n ? -rounded : rounded
}

/**
 * Turns an itemised bill's charges into money. Order (owner rule): the
 * discount comes off the items subtotal first; service charge and tax are
 * then taken on the discounted subtotal; tip on the discounted subtotal
 * too, before tax. Amounts are used as typed.
 */
export function resolveItemAdjustments(
  subtotal: bigint,
  inputs: Record<AdjustmentKind, AdjustmentInput>,
): Record<AdjustmentKind, bigint> {
  const money = (input: AdjustmentInput, base: bigint) =>
    input.mode === 'amount' ? input.minor : percentOfMinor(base, input.basisPoints)
  const discount = money(inputs.discount, subtotal)
  const base = subtotal - discount
  return {
    discount,
    service: money(inputs.service, base),
    tax: money(inputs.tax, base),
    tip: money(inputs.tip, base),
  }
}
