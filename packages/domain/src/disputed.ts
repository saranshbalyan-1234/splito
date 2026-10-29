import {allocate} from './allocate'


/** One person's disputed or held part of a net balance, per group and currency (the shape of the `disputed_balances` projection). */
export interface DisputedBalanceRow {
  personId: string
  currency: string
  amount: bigint
}

/** What `otherId` owes `personId` on disputed or held records in one group (null: outside groups) and currency. */
export interface DisputedPairRow {
  groupId: string | null
  currency: string
  amount: bigint
}

/**
 * Disputed and held amounts (F-1210, ARCHITECTURE 26.20). A disputed record still counts in every balance; these
 * say how much of a balance sits on such records, and what Settle up plans over when they are left out.
 */

/**
 * How much of a friend balance sits on disputed or held records, per currency (F-1210, 26.20). `pairs` are what
 * they owe me on those records (> 0) or I owe them (< 0), per group and currency; `totals` is the balance shown
 * (> 0 they owe me). Only the part pointing the same way as the balance counts, and never more than the balance
 * itself, so "of which" can never exceed what it is part of. Outside groups only when groups are not included.
 */
export function disputedWith(pairs: readonly DisputedPairRow[] | undefined, totals: Readonly<Record<string, bigint>>, includeGroups: boolean): Record<string, bigint> {
  const out: Record<string, bigint> = {}
  for (const [currency, total] of Object.entries(totals)) {
    if (total === 0n) continue
    const sum = (pairs ?? []).filter(p => p.currency === currency && (includeGroups || p.groupId === null)).reduce((acc, p) => acc + p.amount, 0n)
    const towards = total > 0n ? sum : -sum
    const cap = total > 0n ? total : -total
    if (towards > 0n) out[currency] = towards < cap ? towards : cap
  }
  return out
}

/**
 * The disputed or held part of one group's balances, per currency (F-1210): `total` is the amount being questioned in
 * the group (what the disputed records move between members, the sum of the positive nets), and `mine` is my own
 * part of it, pointing the way my balance does and never above it.
 */
export function disputedInGroup(
  rows: readonly DisputedBalanceRow[] | undefined,
  me: string,
  mine: Readonly<Record<string, bigint>>,
): {total: Record<string, bigint>; mine: Record<string, bigint>} {
  const total: Record<string, bigint> = {}
  for (const r of rows ?? []) if (r.amount > 0n) total[r.currency] = (total[r.currency] ?? 0n) + r.amount
  const own: Record<string, bigint> = {}
  for (const [currency, net] of Object.entries(mine)) {
    const part = (rows ?? []).find(r => r.personId === me && r.currency === currency)?.amount ?? 0n
    const towards = net > 0n ? part : -part
    const cap = net > 0n ? net : -net
    if (net !== 0n && towards > 0n) own[currency] = towards < cap ? towards : cap
  }
  return {total, mine: own}
}

type Nets = Record<string, Record<string, bigint>>

/**
 * A group's nets (per currency, per person) with the disputed and held records' part taken out, for Settle up to plan
 * over unless "Include disputed" is on (F-1210, 26.20). Each person's net only ever shrinks toward zero by what their
 * disputed part asks: it never flips sign and never grows (a settled group stays settled, a part-repaid balance loses
 * at most what is still owed, and a disputed "payment not received" never makes anyone pay twice). The side that lost
 * more is scaled back with `allocate` so each currency still sums to zero. `leftOut` is what was actually removed per
 * currency (the sum of the positive nets taken out), so the notice never claims more than the plan lost.
 */
export function withoutDisputed(nets: Readonly<Nets>, rows: readonly DisputedBalanceRow[] | undefined): {nets: Nets; leftOut: Record<string, bigint>} {
  const out: Nets = Object.fromEntries(Object.entries(nets).map(([c, net]) => [c, {...net}]))
  const leftOut: Record<string, bigint> = {}
  const byCurrency = new Map<string, Map<string, bigint>>()
  for (const r of rows ?? []) {
    const m = byCurrency.get(r.currency) ?? new Map<string, bigint>()
    m.set(r.personId, (m.get(r.personId) ?? 0n) + r.amount)
    byCurrency.set(r.currency, m)
  }
  for (const [currency, disputed] of byCurrency) {
    const net = out[currency]
    if (!net) continue
    /* What each person's net can lose: toward zero, no further. */
    const removable = new Map<string, bigint>()
    for (const [person, n] of Object.entries(net)) {
      const d = disputed.get(person) ?? 0n
      const take = n > 0n ? (d > 0n ? (d < n ? d : n) : 0n) : n < 0n ? (d < 0n ? (-d < -n ? -d : -n) : 0n) : 0n
      if (take > 0n) removable.set(person, take)
    }
    const side = (positive: boolean) => [...removable].filter(([p]) => net[p]! > 0n === positive)
    const sum = (xs: Array<[string, bigint]>) => xs.reduce((a, [, v]) => a + v, 0n)
    const gain = side(true)
    const loss = side(false)
    const total = sum(gain) < sum(loss) ? sum(gain) : sum(loss)
    if (total === 0n) continue
    for (const [positive, list] of [[true, gain], [false, loss]] as const) {
      if (list.length === 0) continue
      const parts = sum(list) === total ? Object.fromEntries(list) : allocate(total, list.map(([id, weight]) => ({id, weight})))
      for (const [person, v] of Object.entries(parts)) net[person] = positive ? net[person]! - v : net[person]! + v
    }
    leftOut[currency] = total
  }
  return {nets: out, leftOut}
}

/**
 * One friend's balance parts (direct, then each group) with the disputed amount taken off the parts that point the
 * way the balance does, in proportion to their size, never below zero: what the friend's Settle up offers and what
 * "Call it even" forgives unless "Include disputed" is on (F-1210). `direction` is the sign of the balance (> 0 they owe me).
 */
export function withoutDisputedParts<P extends {amount: bigint}>(parts: readonly P[], direction: 1 | -1, disputed: bigint): P[] {
  const pointing = parts.filter(p => (direction > 0 ? p.amount > 0n : p.amount < 0n))
  const owed = pointing.reduce((a, p) => a + (direction > 0 ? p.amount : -p.amount), 0n)
  const take = disputed < owed ? disputed : owed
  if (take <= 0n) return [...parts]
  const shares = allocate(take, pointing.map((p, i) => ({id: String(i), weight: direction > 0 ? p.amount : -p.amount})))
  let k = 0
  return parts.map(p => {
    if (!pointing.includes(p)) return p
    const cut = shares[String(k++)] ?? 0n
    return {...p, amount: direction > 0 ? p.amount - cut : p.amount + cut}
  })
}
