import {type CurrencyCode} from './currency'
import {directPlan, type SettlementRules} from './settlement'

/** One payment (or one write-off) that clears part of a leaving member's balance in a group. */
export interface ExitTransfer {
  currency: CurrencyCode
  from: string
  to: string
  amount: bigint
}

/** One member's balance in one currency, before and after the transfers (> 0: owed). */
export interface ExitChange {
  currency: CurrencyCode
  personId: string
  before: bigint
  after: bigint
}

/**
 * What it takes to clear one member's balance in a group (F-613, F-615): the transfers of the group's own
 * settle-up plan (`directPlan`, the group's rules) that involve them, per currency. The plan zeroes everyone, so
 * the transfers touching one member sum to exactly their net; the others are changed only by what they exchange
 * with that member. `nets` has every member listed per currency (`zeroFillNets`).
 */
export function memberExitTransfers(nets: Record<CurrencyCode, Record<string, bigint>>, personId: string, rules: SettlementRules): ExitTransfer[] {
  return Object.entries(nets)
    .sort(([x], [y]) => x.localeCompare(y))
    .flatMap(([currency, net]) => {
      if ((net[personId] ?? 0n) === 0n) return []
      return directPlan(net, rules)
        .transfers.filter(t => t.from === personId || t.to === personId)
        .map(t => ({currency, from: t.from, to: t.to, amount: t.amount}))
    })
}

/**
 * Every member whose balance moves if `transfers` are recorded, per currency and never summed across
 * them: a payment (or write-off) from A to B raises A's net and lowers B's. Sorted by currency, then person.
 */
export function memberExitChanges(nets: Record<CurrencyCode, Record<string, bigint>>, transfers: ExitTransfer[]): ExitChange[] {
  const moved = new Map<string, bigint>()
  const key = (currency: string, personId: string) => `${currency}\u0000${personId}`
  for (const t of transfers) {
    moved.set(key(t.currency, t.from), (moved.get(key(t.currency, t.from)) ?? 0n) + t.amount)
    moved.set(key(t.currency, t.to), (moved.get(key(t.currency, t.to)) ?? 0n) - t.amount)
  }
  return [...moved]
    .map(([k, delta]) => {
      const [currency, personId] = k.split('\u0000') as [string, string]
      const before = nets[currency]?.[personId] ?? 0n
      return {currency, personId, before, after: before + delta}
    })
    .filter(c => c.before !== c.after)
    .sort((x, y) => x.currency.localeCompare(y.currency) || x.personId.localeCompare(y.personId))
}

/**
 * What is still open in a group, per currency: the sum of what its members are owed, which is also the sum of
 * what they owe (nets add to zero). Currencies that are settled are left out; currencies are never added together.
 */
export function openAmounts(nets: Record<CurrencyCode, Record<string, bigint>>): Record<CurrencyCode, bigint> {
  const out: Record<CurrencyCode, bigint> = {}
  for (const [currency, net] of Object.entries(nets)) {
    const owed = Object.values(net).filter(v => v > 0n)
    if (owed.length === 0) continue
    out[currency] = owed.reduce((sum, v) => sum + v, 0n)
  }
  return out
}
