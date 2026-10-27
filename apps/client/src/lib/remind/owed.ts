import {type BalanceRow, balanceParts, isSettledBalance, partsOwedBy, personSummary, sumMinor, ZERO} from '@splito/domain'

/**
 * What a friend owes me, per currency, for a reminder (F-1118): in each currency where they owe me overall,
 * the parts they owe (direct and each group), never offset against what I owe them in another group. Empty
 * when they owe me nothing, which is when Remind is hidden.
 */
export function owedByThem(rows: BalanceRow[], personId: string): Record<string, bigint> {
  const summary = personSummary(rows, {includeGroups: true}).find(s => s.person === personId)
  const out: Record<string, bigint> = {}
  for (const [currency, c] of Object.entries(summary?.byCurrency ?? {})) {
    if (c.total <= ZERO) continue
    const owed = sumMinor(partsOwedBy(balanceParts(c), false).map(p => p.amount))
    if (owed > ZERO) out[currency] = owed
  }
  return out
}

/** Whether anything is open with a friend in any currency or group (Remind me is offered then, in either direction). */
export function hasOpenBalance(rows: BalanceRow[], personId: string): boolean {
  const summary = personSummary(rows, {includeGroups: true}).find(s => s.person === personId)
  return Object.values(summary?.byCurrency ?? {}).some(c => !isSettledBalance(c))
}
