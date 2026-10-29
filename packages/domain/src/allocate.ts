import {getCurrency} from './currency'
import {DomainError} from './errors'

/**
 * Splits `total` minor units across weights with no loss. Largest remainder method:
 * every id gets floor(total * w / W), and the leftover units go one each to the
 * largest fractional remainders, ties broken by id (code-unit order, smallest first).
 */
export function allocate(total: bigint, weights: ReadonlyArray<{id: string; weight: bigint}>): Record<string, bigint> {
  if (weights.length === 0) throw new DomainError('EMPTY_PARTICIPANTS')
  if (weights.some(w => w.weight <= 0n)) throw new DomainError('NON_POSITIVE_WEIGHT')
  if (new Set(weights.map(w => w.id)).size !== weights.length) throw new DomainError('DUPLICATE_PARTICIPANT')

  const neg = total < 0n
  const t = neg ? -total : total
  const W = weights.reduce((a, w) => a + w.weight, 0n)
  const parts = weights.map(w => ({id: w.id, quota: (t * w.weight) / W, rem: (t * w.weight) % W}))
  let leftover = t - parts.reduce((a, p) => a + p.quota, 0n)
  const order = [...parts].sort((x, y) => (x.rem === y.rem ? (x.id < y.id ? -1 : 1) : x.rem > y.rem ? -1 : 1))
  for (const p of order) {
    if (leftover === 0n) break
    p.quota += 1n
    leftover -= 1n
  }
  return Object.fromEntries(parts.map(p => [p.id, neg ? -p.quota : p.quota]))
}

/** One cash unit of a currency in minor units: `roundTo` whole units (1, 5, 10 ...), so INR 10 is 1000n and JPY 10 is 10n. */
export function cashUnit(code: string, roundTo: number): bigint {
  if (!Number.isInteger(roundTo) || roundTo <= 0) throw new DomainError('INVALID_ROUNDING')
  return BigInt(roundTo) * 10n ** BigInt(getCurrency(code).scale)
}

/** `cashUnit` back to whole currency units (INR 1000n -> 10), for labels and edit forms. */
export function cashUnitWhole(code: string, unit: bigint): number {
  return Number(unit / 10n ** BigInt(getCurrency(code).scale))
}

/** A cash-rounded split: whole-unit shares plus the visible remainder and who carries it. */
export type CashAllocation = {shares: Record<string, bigint>; remainder: bigint; remainderTo?: string; /** Rounding was skipped: the total holds fewer whole units than people. */ isExact?: true}

/**
 * Cash rounding: every share is a whole multiple of `unit` (from `cashUnit`)
 * and the part of `total` that is not a whole unit is a visible remainder,
 * never dropped. Whole units go out by `allocate` (largest remainder, ties by
 * id); the remainder joins the share rounded furthest below its exact value
 * (ties by id), so the result is the same whatever the input order and always
 * sums to `total`. A negative total (a refund) mirrors a positive one. When
 * `total` holds too few whole units to give every person at least one (EUR 45
 * for 3 at a unit of 100, or a 1:1:4 split of EUR 300 at 100), rounding would
 * leave someone nothing, so it is skipped and the split is exact (audit M15).
 */
export function allocateCash(total: bigint, weights: ReadonlyArray<{id: string; weight: bigint}>, unit: bigint): CashAllocation {
  if (unit <= 0n) throw new DomainError('INVALID_ROUNDING')
  const neg = total < 0n
  const t = neg ? -total : total
  const units = t / unit
  const shares = allocate(units, weights)
  if (weights.some(w => w.weight > 0n && shares[w.id] === 0n)) {
    const exact = allocate(t, weights)
    if (neg) for (const id in exact) exact[id] = -exact[id]!
    return {shares: exact, remainder: 0n, isExact: true}
  }
  const remainder = t - units * unit
  for (const id in shares) shares[id] = shares[id]! * unit
  let remainderTo: string | undefined
  if (remainder !== 0n) {
    const W = weights.reduce((a, w) => a + w.weight, 0n)
    // Shortfall in units of 1/W: the exact share t*w/W minus the rounded one.
    let best: bigint | undefined
    for (const w of [...weights].sort((x, y) => (x.id < y.id ? -1 : 1))) {
      const short = t * w.weight - shares[w.id]! * W
      if (best === undefined || short > best) [best, remainderTo] = [short, w.id]
    }
    shares[remainderTo!] = shares[remainderTo!]! + remainder
  }
  if (neg) for (const id in shares) shares[id] = -shares[id]!
  return {shares, remainder: neg ? -remainder : remainder, ...(remainderTo === undefined ? {} : {remainderTo})}
}
