import {allocate} from './allocate'
import {assertInRange, DomainError} from './errors'

export type SplitInput =
  | {mode: 'equal'; participants: string[]}
  | {mode: 'exact'; amounts: Record<string, bigint>}
  /** Integer basis points (1% = 100), summing to 10000. */
  | {mode: 'percent'; basisPoints: Record<string, number>}
  | {mode: 'shares'; shares: Record<string, number>}
  | {mode: 'items'; items: Array<{id: string; name?: string; amount: bigint; participants: string[]}>; tax: bigint; tip: bigint; discount: bigint}
  /** Equal with adjustments: each adjustment is added to (or taken from) that person, the rest is split equally. */
  | {mode: 'adjusted'; participants: string[]; adjustments: Record<string, bigint>}

const sum = (xs: Iterable<bigint>) => {
  let s = 0n
  for (const x of xs) s += x
  return s
}

function intWeights(m: Record<string, number>) {
  return Object.entries(m).map(([id, w]) => {
    if (!Number.isInteger(w) || w <= 0) throw new DomainError('NON_POSITIVE_WEIGHT')
    return {id, weight: BigInt(w)}
  })
}

/** Returns each participant's owed share; always sums exactly to `total`. */
export function computeShares(total: bigint, split: SplitInput): Record<string, bigint> {
  assertInRange(total)
  switch (split.mode) {
    case 'equal':
      return allocate(total, split.participants.map(id => ({id, weight: 1n})))
    case 'exact': {
      const amounts = Object.values(split.amounts)
      if (amounts.length === 0) throw new DomainError('EMPTY_PARTICIPANTS')
      amounts.forEach(assertInRange)
      if (sum(amounts) !== total) throw new DomainError('TOTAL_MISMATCH')
      return {...split.amounts}
    }
    case 'percent': {
      const w = intWeights(split.basisPoints)
      if (sum(w.map(x => x.weight)) !== 10000n) throw new DomainError('PERCENT_NOT_100')
      return allocate(total, w)
    }
    case 'shares':
      return allocate(total, intWeights(split.shares))
    case 'adjusted': {
      const ids = new Set(split.participants)
      if (Object.keys(split.adjustments).some(id => !ids.has(id))) throw new DomainError('NOT_A_PARTICIPANT')
      const adjustments = Object.values(split.adjustments)
      adjustments.forEach(assertInRange)
      const base = total - sum(adjustments)
      if ((total >= 0n && base < 0n) || (total < 0n && base > 0n)) throw new DomainError('ADJUSTMENT_TOO_LARGE')
      const shares = allocate(base, split.participants.map(id => ({id, weight: 1n})))
      for (const [id, v] of Object.entries(split.adjustments)) shares[id] = shares[id]! + v
      return shares
    }
    case 'items': {
      const adjustment = split.tax + split.tip - split.discount
      if (sum(split.items.map(i => i.amount)) + adjustment !== total) throw new DomainError('TOTAL_MISMATCH')
      const subtotals: Record<string, bigint> = {}
      for (const item of split.items) {
        if (item.participants.length === 0) throw new DomainError('UNASSIGNED_ITEM')
        for (const [id, v] of Object.entries(allocate(item.amount, item.participants.map(id => ({id, weight: 1n})))))
          subtotals[id] = (subtotals[id] ?? 0n) + v
      }
      if (adjustment !== 0n) {
        // Tax, tip and discount follow each person's item subtotal.
        const weights = Object.entries(subtotals)
          .filter(([, v]) => v !== 0n)
          .map(([id, v]) => ({id, weight: v < 0n ? -v : v}))
        for (const [id, v] of Object.entries(allocate(adjustment, weights))) subtotals[id] = subtotals[id]! + v
      }
      return subtotals
    }
  }
}

export function validateExpense(e: {total: bigint; payers: Record<string, bigint>; shares: Record<string, bigint>}): void {
  assertInRange(e.total)
  if (sum(Object.values(e.payers)) !== e.total) throw new DomainError('PAYERS_MISMATCH')
  if (sum(Object.values(e.shares)) !== e.total) throw new DomainError('TOTAL_MISMATCH')
}
