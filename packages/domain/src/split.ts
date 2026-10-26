import type {AdjustmentKind} from './adjustments'
import {allocate} from './allocate'
import {assertInRange, DomainError} from './errors'

/** Who had an item: a person id (one portion), or an id with a whole number of portions ("2 of 3 beers"). */
export type ItemParticipant = string | {id: string; weight: number}

/** The person an item participant names. */
export function participantId(p: ItemParticipant): string {
  return typeof p === 'string' ? p : p.id
}

/** How many portions of the item a participant had (1 unless set). */
export function participantWeight(p: ItemParticipant): number {
  return typeof p === 'string' ? 1 : p.weight
}

export type SplitInput =
  | {mode: 'equal'; participants: string[]}
  | {mode: 'exact'; amounts: Record<string, bigint>}
  /** Integer basis points (1% = 100), summing to 10000. */
  | {mode: 'percent'; basisPoints: Record<string, number>}
  | {mode: 'shares'; shares: Record<string, number>}
  /** A bill of items; tax, tip, service charge (optional, older records have none) and discount follow each person's item subtotal. */
  | {
      mode: 'items'
      items: Array<{id: string; name?: string; amount: bigint; participants: ItemParticipant[]}>
      tax: bigint
      tip: bigint
      service?: bigint
      discount: bigint
      /** The rates (basis points) charges were entered as, for "Tax 18%" lines; the money above is what counts. */
      rates?: Partial<Record<AdjustmentKind, number>>
    }
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
      const {subtotals, extras} = itemBreakdown(split)
      if (sum(split.items.map(i => i.amount)) + itemsAdjustment(split) !== total) throw new DomainError('TOTAL_MISMATCH')
      const shares = {...subtotals}
      for (const [id, v] of Object.entries(extras)) shares[id] = (shares[id] ?? 0n) + v
      return shares
    }
  }
}

type ItemsSplit = Extract<SplitInput, {mode: 'items'}>

/** Tax + tip + service charge - discount: what is spread over the item subtotals. */
export function itemsAdjustment(split: ItemsSplit): bigint {
  return split.tax + split.tip + (split.service ?? 0n) - split.discount
}

/**
 * Who owes what of an itemised bill, item by item: `items[itemId][personId]`
 * splits each item by its portions; `subtotals` adds them up per person;
 * `extras` spreads tax, tip, service and discount by those subtotals. A
 * person's share is their subtotal plus their extras, exactly.
 */
export function itemBreakdown(split: ItemsSplit): {
  items: Record<string, Record<string, bigint>>
  subtotals: Record<string, bigint>
  extras: Record<string, bigint>
} {
  const items: Record<string, Record<string, bigint>> = {}
  const subtotals: Record<string, bigint> = {}
  for (const item of split.items) {
    assertInRange(item.amount)
    if (item.participants.length === 0) throw new DomainError('UNASSIGNED_ITEM')
    const weights = item.participants.map(p => {
      const w = participantWeight(p)
      if (!Number.isInteger(w) || w <= 0) throw new DomainError('NON_POSITIVE_WEIGHT')
      return {id: participantId(p), weight: BigInt(w)}
    })
    items[item.id] = allocate(item.amount, weights)
    for (const [id, v] of Object.entries(items[item.id]!)) subtotals[id] = (subtotals[id] ?? 0n) + v
  }
  const adjustment = itemsAdjustment(split)
  let extras: Record<string, bigint> = {}
  if (adjustment !== 0n) {
    const weights = Object.entries(subtotals)
      .filter(([, v]) => v !== 0n)
      .map(([id, v]) => ({id, weight: v < 0n ? -v : v}))
    extras = allocate(adjustment, weights)
  }
  return {items, subtotals, extras}
}

/**
 * Paid = owed = total, exactly, and no payer or share runs against the
 * total's sign (a +150 / -50 payer pair would make pairwise and group
 * balances disagree). Every write goes through here via `buildExpense`.
 */
export function validateExpense(e: {total: bigint; payers: Record<string, bigint>; shares: Record<string, bigint>}): void {
  assertInRange(e.total)
  const isAgainstTotal = (v: bigint) => (e.total >= 0n ? v < 0n : v > 0n)
  if ([...Object.values(e.payers), ...Object.values(e.shares)].some(isAgainstTotal)) throw new DomainError('SIGN_MISMATCH')
  if (sum(Object.values(e.payers)) !== e.total) throw new DomainError('PAYERS_MISMATCH')
  if (sum(Object.values(e.shares)) !== e.total) throw new DomainError('TOTAL_MISMATCH')
}
