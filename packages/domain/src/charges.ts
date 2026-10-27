import {type AdjustmentInput, percentOfMinor} from './adjustments'
import {allocate} from './allocate'
import {getCurrency} from './currency'
import {assertInRange, DomainError} from './errors'

/** What a charge is for; a discount comes off, every other kind is added. */
export type ChargeKind = 'service' | 'tax' | 'packing' | 'delivery' | 'other' | 'discount'

/** Which items a charge applies to: all of them, items of chosen tax classes, or chosen items. */
export type ChargeScope = {type: 'all'} | {type: 'classes'; classes: string[]} | {type: 'items'; items: string[]}

/** The class an item without one belongs to. */
export const STANDARD_CLASS = 'standard'

/**
 * One line under the items of a bill (F-403). `value` is a rate in basis
 * points or a fixed amount (a magnitude: a discount's sign comes from its
 * kind). `stacksOn: 'earlier'` also takes the earlier charges that fell on
 * the same items into its base. `inclusive` marks a tax already inside the
 * prices: it shows its portion and adds nothing.
 */
export type Charge = {
  id: string
  name: string
  kind: ChargeKind
  value: AdjustmentInput
  appliesTo: ChargeScope
  stacksOn: 'items' | 'earlier'
  inclusive?: boolean
}

/** One item of the bill, already split by person (`splitItem`); `taxClass` absent is Standard. */
export type BillItem = {id: string; taxClass?: string; parts: Record<string, bigint>}

/** One charge worked out: its signed total and who carries it. */
export type BillLine = {
  charge: Charge
  /** What the percentage was taken of (items, and earlier charges when stacking). */
  base: bigint
  /** Signed: a discount is negative. For an inclusive tax, the portion inside the prices. */
  amount: bigint
  isInclusive: boolean
  /** Only people who had items in scope; sums to `amount`. */
  byPerson: Record<string, bigint>
}

export type BillBreakdown = {
  lines: BillLine[]
  itemsTotal: bigint
  /** Everything the charges add (inclusive ones add nothing). */
  chargesTotal: bigint
  computedTotal: bigint
  subtotals: Record<string, bigint>
  /** Each person's charges (inclusive ones left out). */
  extras: Record<string, bigint>
}

/** A round-off line that ties the computed total to the printed one: `to` takes it all, else it spreads pro rata. */
export type RoundOff = {minor: bigint; to?: string}

const sum = (xs: Iterable<bigint>) => {
  let s = 0n
  for (const x of xs) s += x
  return s
}
const abs = (x: bigint) => (x < 0n ? -x : x)

/** How far a printed total may be from the computed one and still be called round-off: one whole unit of the currency. */
export function roundOffLimit(code: string): bigint {
  return 10n ** BigInt(getCurrency(code).scale)
}

/** The printed total against the charged bill: the gap, and whether it is small enough to add as round-off. */
export function billGap(b: BillBreakdown, total: bigint, currency: string): {gap: bigint; canRoundOff: boolean} {
  const gap = total - b.computedTotal
  return {gap, canRoundOff: gap !== 0n && abs(gap) <= roundOffLimit(currency)}
}

const CHARGE_KINDS: ChargeKind[] = ['service', 'tax', 'packing', 'delivery', 'other', 'discount']

/**
 * A charge that can be worked out: a known kind and scope, a whole number of
 * basis points from 0 to 10,000, or a money value in range and not below
 * zero (a discount's sign comes from its kind, not its value).
 */
export function assertCharge(c: Charge): void {
  if (!CHARGE_KINDS.includes(c.kind)) throw new DomainError('INVALID_CHARGE')
  const scope = c.appliesTo
  if (scope.type !== 'all' && scope.type !== 'classes' && scope.type !== 'items') throw new DomainError('INVALID_CHARGE')
  if (c.stacksOn !== 'items' && c.stacksOn !== 'earlier') throw new DomainError('INVALID_CHARGE')
  if (c.value.mode === 'percent') {
    const bp = c.value.basisPoints
    if (!Number.isInteger(bp) || bp < 0 || bp > 10000) throw new DomainError('INVALID_CHARGE')
  } else if (c.value.mode === 'amount') {
    assertInRange(c.value.minor)
    if (c.value.minor < 0n && c.kind !== 'discount') throw new DomainError('INVALID_CHARGE')
  } else {
    throw new DomainError('INVALID_CHARGE')
  }
}

/** A round-off line within the printed-total tolerance (one whole unit of the currency). */
export function assertRoundOff(roundOff: RoundOff | undefined, currency: string): void {
  if (roundOff && abs(roundOff.minor) > roundOffLimit(currency)) throw new DomainError('ROUND_OFF_TOO_LARGE')
}

/** The tax inside a price that includes `basisPoints` of tax: base * r / (1 + r), half away from zero. */
function inclusivePortion(base: bigint, basisPoints: number): bigint {
  const denom = 10000n + BigInt(basisPoints)
  const rounded = (2n * abs(base) * BigInt(basisPoints) + denom) / (2n * denom)
  return base < 0n ? -rounded : rounded
}

type Cell = {item: string; person: string; amount: bigint; stack: bigint}

/** Whether a charge with this scope applies to the item. */
export function isInScope(scope: ChargeScope, item: Pick<BillItem, 'id' | 'taxClass'>): boolean {
  switch (scope.type) {
    case 'all':
      return true
    case 'classes':
      return scope.classes.includes(item.taxClass ?? STANDARD_CLASS)
    case 'items':
      return scope.items.includes(item.id)
  }
}

/**
 * Works out a bill's charges, in order. A percentage is taken of the base of
 * the items in scope (plus the earlier charges on those items when it
 * stacks), rounded once to the minor unit; that amount is then spread over
 * the people who had those items by their share of the base, with `allocate`
 * (largest remainder, ties by person id), so a person is never off exact pro
 * rata by a unit per item and the same bill always splits the same way. Each
 * person's part is then spread over their own items, only to feed a charge
 * that stacks. Nobody pays a charge on items they did not have, and every
 * line sums exactly to its amount.
 */
export function billBreakdown(items: BillItem[], charges: Charge[]): BillBreakdown {
  const cells = new Map<string, Cell[]>()
  const subtotals: Record<string, bigint> = {}
  for (const item of items) {
    cells.set(
      item.id,
      Object.entries(item.parts).map(([person, amount]) => {
        subtotals[person] = (subtotals[person] ?? 0n) + amount
        return {item: item.id, person, amount, stack: 0n}
      }),
    )
  }
  const lines: BillLine[] = []
  const extras: Record<string, bigint> = {}
  for (const charge of charges) {
    assertCharge(charge)
    const inScope = items.filter(i => isInScope(charge.appliesTo, i)).flatMap(i => cells.get(i.id)!)
    const isInclusive = !!charge.inclusive && charge.kind !== 'discount'
    const stacks = charge.stacksOn === 'earlier' && !isInclusive
    const bases = inScope.map(c => c.amount + (stacks ? c.stack : 0n))
    const base = sum(bases)
    const sign = charge.kind === 'discount' ? -1n : 1n
    const magnitude =
      charge.value.mode === 'amount'
        ? charge.value.minor
        : isInclusive
          ? inclusivePortion(base, charge.value.basisPoints)
          : percentOfMinor(base, charge.value.basisPoints)
    const amount = sign * magnitude
    if (amount !== 0n && inScope.length === 0) throw new DomainError('CHARGE_NO_ITEMS')
    const byPerson: Record<string, bigint> = {}
    if (amount !== 0n) {
      // Level 1: the amount over PEOPLE by what each has in scope (ties by person id, so a bill splits the same every time).
      const personBase: Record<string, bigint> = {}
      inScope.forEach((c, n) => {
        personBase[c.person] = (personBase[c.person] ?? 0n) + bases[n]!
      })
      const people = Object.keys(personBase)
      const weighted = people.filter(p => personBase[p] !== 0n).map(p => ({id: p, weight: abs(personBase[p]!)}))
      // A fixed charge on free items still has to land somewhere: equally.
      const personParts = allocate(amount, weighted.length > 0 ? weighted : people.map(id => ({id, weight: 1n})))
      // Level 2: each person's part over their own cells, only to feed what a later charge stacks on.
      for (const [person, part] of Object.entries(personParts)) {
        byPerson[person] = part
        if (isInclusive) continue
        const own = inScope.map((c, n) => ({c, w: abs(bases[n]!)})).filter(x => x.c.person === person)
        const cellsOf = own.some(x => x.w > 0n) ? own.filter(x => x.w > 0n) : own.map(x => ({c: x.c, w: 1n}))
        const parts = allocate(part, cellsOf.map(x => ({id: x.c.item, weight: x.w})))
        for (const {c} of cellsOf) c.stack += parts[c.item]!
      }
    }
    if (!isInclusive) for (const [p, v] of Object.entries(byPerson)) extras[p] = (extras[p] ?? 0n) + v
    lines.push({charge, base, amount, isInclusive, byPerson})
  }
  const itemsTotal = sum(Object.values(subtotals))
  const chargesTotal = sum(lines.filter(l => !l.isInclusive).map(l => l.amount))
  return {lines, itemsTotal, chargesTotal, computedTotal: itemsTotal + chargesTotal, subtotals, extras}
}

/** Each person's items + charges, before any round-off. */
function personTotals(b: BillBreakdown): Record<string, bigint> {
  const out = {...b.subtotals}
  for (const [p, v] of Object.entries(b.extras)) out[p] = (out[p] ?? 0n) + v
  return out
}

/** The round-off line per person: all on `to`, or pro rata to what each owes (largest remainder). */
export function roundOffByPerson(b: BillBreakdown, roundOff: RoundOff): Record<string, bigint> {
  if (roundOff.minor === 0n) return {}
  if (roundOff.to !== undefined) return {[roundOff.to]: roundOff.minor}
  const totals = Object.entries(personTotals(b))
  const weighted = totals.filter(([, v]) => v !== 0n).map(([id, v]) => ({id, weight: abs(v)}))
  return allocate(roundOff.minor, weighted.length > 0 ? weighted : totals.map(([id]) => ({id, weight: 1n})))
}

/** Each person's share of the bill: items, charges and round-off; sums to computedTotal + round-off. */
export function billShares(b: BillBreakdown, roundOff?: RoundOff): Record<string, bigint> {
  const out = personTotals(b)
  if (roundOff) for (const [p, v] of Object.entries(roundOffByPerson(b, roundOff))) out[p] = (out[p] ?? 0n) + v
  return out
}

/**
 * The Simple preset, read from an expense that has one overall discount,
 * service charge, tax and tip (older expenses): every charge on all items,
 * the stored money kept as typed (or its rate, when it was a percentage).
 * Display only: those expenses keep their stored amounts and are never
 * re-worked, so they load unchanged.
 */
export function chargesOf(split: {
  tax: bigint
  tip: bigint
  service?: bigint
  discount: bigint
  rates?: Partial<Record<'tax' | 'tip' | 'service' | 'discount', number>>
}): Charge[] {
  const line = (id: string, name: string, kind: ChargeKind, minor: bigint, bp?: number): Charge => ({
    id,
    name,
    kind,
    value: bp === undefined ? {mode: 'amount', minor} : {mode: 'percent', basisPoints: bp},
    appliesTo: {type: 'all'},
    stacksOn: 'items',
  })
  const r = split.rates ?? {}
  return [
    line('discount', 'Discount', 'discount', split.discount, r.discount),
    line('service', 'Service charge', 'service', split.service ?? 0n, r.service),
    line('tax', 'Tax', 'tax', split.tax, r.tax),
    line('tip', 'Tip', 'other', split.tip, r.tip),
  ].filter(c => (c.value.mode === 'amount' ? c.value.minor !== 0n : true))
}
