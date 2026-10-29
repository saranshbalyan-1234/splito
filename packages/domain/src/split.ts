import {type AdjustmentKind} from './adjustments'
import {allocate, allocateCash, type CashAllocation} from './allocate'
import {assertCharge, assertRoundOff, type BillBreakdown, billBreakdown, billShares, type Charge, type RoundOff} from './charges'
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

/**
 * Cash rounding (F-402): each share is a whole multiple of this many minor
 * units (`cashUnit`); what is not a whole unit is a visible remainder on one
 * person (`allocateCash`). Absent on older records and when rounding is off.
 */
type RoundTo = {roundTo?: bigint}

export type SplitInput =
  | ({mode: 'equal'; participants: string[]} & RoundTo)
  | {mode: 'exact'; amounts: Record<string, bigint>}
  /** Integer basis points (1% = 100), summing to 10000. */
  | ({mode: 'percent'; basisPoints: Record<string, number>} & RoundTo)
  | ({mode: 'shares'; shares: Record<string, number>} & RoundTo)
  /** A bill of items; tax, tip, service charge (optional, older records have none) and discount follow each person's item subtotal. */
  | {
      mode: 'items'
      items: Array<{id: string; name?: string; amount: bigint; participants: ItemParticipant[]; taxClass?: string}>
      tax: bigint
      tip: bigint
      service?: bigint
      discount: bigint
      /** The rates (basis points) charges were entered as, for "Tax 18%" lines; the money above is what counts. */
      rates?: Partial<Record<AdjustmentKind, number>>
      /**
       * Scoped, stacked charges (F-403). When present they replace tax, tip,
       * service and discount above (stored as zero); the money is worked out
       * by `billBreakdown`. Absent on older expenses, which load unchanged.
       */
      charges?: Charge[]
      /** The line that ties the charged total to the printed one (charged bills only). */
      roundOff?: RoundOff
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

/** The weights of a split that can be cash-rounded; undefined for the others. */
function roundableWeights(split: SplitInput): Array<{id: string; weight: bigint}> | undefined {
  switch (split.mode) {
    case 'equal':
      return split.participants.map(id => ({id, weight: 1n}))
    case 'percent': {
      const w = intWeights(split.basisPoints)
      if (sum(w.map(x => x.weight)) !== 10000n) throw new DomainError('PERCENT_NOT_100')
      return w
    }
    case 'shares':
      return intWeights(split.shares)
    case 'exact':
    case 'adjusted':
    case 'items':
      return undefined
  }
}

/** The cash rounding of a split with `roundTo` (shares, remainder and who carries it); undefined when it is not rounded. */
export function cashSplit(total: bigint, split: SplitInput): CashAllocation | undefined {
  const unit = 'roundTo' in split ? split.roundTo : undefined
  if (unit === undefined) return undefined
  return allocateCash(assertInRange(total), roundableWeights(split)!, unit)
}

/** Returns each participant's owed share; always sums exactly to `total`. */
export function computeShares(total: bigint, split: SplitInput): Record<string, bigint> {
  assertInRange(total)
  const cash = cashSplit(total, split)
  if (cash) return cash.shares
  switch (split.mode) {
    case 'equal':
      return allocate(total, roundableWeights(split)!)
    case 'exact': {
      const amounts = Object.values(split.amounts)
      if (amounts.length === 0) throw new DomainError('EMPTY_PARTICIPANTS')
      amounts.forEach(assertInRange)
      if (sum(amounts) !== total) throw new DomainError('TOTAL_MISMATCH')
      return {...split.amounts}
    }
    case 'percent':
    case 'shares':
      return allocate(total, roundableWeights(split)!)
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

/** One item split by its portions ("2 of 3 beers"), exactly; refuses an item nobody had. */
export function splitItem(amount: bigint, participants: ItemParticipant[]): Record<string, bigint> {
  if (participants.length === 0) throw new DomainError('UNASSIGNED_ITEM')
  const weights = participants.map(p => {
    const w = participantWeight(p)
    if (!Number.isInteger(w) || w <= 0) throw new DomainError('NON_POSITIVE_WEIGHT')
    return {id: participantId(p), weight: BigInt(w)}
  })
  return allocate(amount, weights)
}

/** Tax + tip + service charge - discount (or the charges and round-off of a charged bill): what is spread over the item subtotals. */
export function itemsAdjustment(split: ItemsSplit): bigint {
  if (split.charges) return billOf(split).chargesTotal + (split.roundOff?.minor ?? 0n)
  return split.tax + split.tip + (split.service ?? 0n) - split.discount
}

/** A charged bill's items split by portion and its charges worked out (F-403); the split must have `charges`. */
export function billOf(split: ItemsSplit): BillBreakdown {
  return billBreakdown(
    split.items.map(i => ({id: i.id, ...(i.taxClass === undefined ? {} : {taxClass: i.taxClass}), parts: splitItem(i.amount, i.participants)})),
    split.charges ?? [],
  )
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
    items[item.id] = splitItem(item.amount, item.participants)
    for (const [id, v] of Object.entries(items[item.id]!)) subtotals[id] = (subtotals[id] ?? 0n) + v
  }
  if (split.charges) {
    const bill = billOf(split)
    const shares = billShares(bill, split.roundOff)
    const extras: Record<string, bigint> = {}
    for (const [id, v] of Object.entries(shares)) if (v !== (subtotals[id] ?? 0n)) extras[id] = v - (subtotals[id] ?? 0n)
    return {items, subtotals, extras}
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
export function validateExpense(e: {
  total: bigint
  payers: Record<string, bigint>
  shares: Record<string, bigint>
  charges?: Charge[]
  roundOff?: RoundOff
  currency?: string
}): void {
  assertInRange(e.total)
  e.charges?.forEach(assertCharge)
  if (e.currency) assertRoundOff(e.roundOff, e.currency)
  const isAgainstTotal = (v: bigint) => (e.total >= 0n ? v < 0n : v > 0n)
  if ([...Object.values(e.payers), ...Object.values(e.shares)].some(isAgainstTotal)) throw new DomainError('SIGN_MISMATCH')
  if (sum(Object.values(e.payers)) !== e.total) throw new DomainError('PAYERS_MISMATCH')
  if (sum(Object.values(e.shares)) !== e.total) throw new DomainError('TOTAL_MISMATCH')
}
