
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
 * A group's nets (per currency, per person) with the disputed and held records' part taken out, and what that part
 * is per currency (the sum of the positive nets: the payments the disputed records would ask for, at most). Settle up
 * plans over `nets` unless "Include disputed" is on (F-1210, 26.20). Each record's net sums to zero, so the rest still does.
 */
export function withoutDisputed(nets: Readonly<Nets>, rows: readonly DisputedBalanceRow[] | undefined): {nets: Nets; leftOut: Record<string, bigint>} {
  const out: Nets = Object.fromEntries(Object.entries(nets).map(([c, net]) => [c, {...net}]))
  const leftOut: Record<string, bigint> = {}
  for (const r of rows ?? []) {
    if (r.amount > 0n) leftOut[r.currency] = (leftOut[r.currency] ?? 0n) + r.amount
    const net = (out[r.currency] ??= {})
    net[r.personId] = (net[r.personId] ?? 0n) - r.amount
  }
  return {nets: out, leftOut}
}
