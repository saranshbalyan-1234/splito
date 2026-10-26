import {
  balanceRows,
  type BalanceRow,
  type LedgerRecord,
  memberNets as domainMemberNets,
} from '@splito/domain'
import {type Entity, type Group} from '@splito/sync'

/**
 * `groupNet` per currency with every member listed (zero when they have no
 * records yet), so a settlement plan can route through them.
 */
export function memberNets(
  records: LedgerRecord[],
  groupId: string,
  group: Group,
): Record<string, Record<string, bigint>> {
  return domainMemberNets(
    records,
    groupId,
    group.members.map(m => m.personId),
  )
}

/**
 * My balance rows with every person (`balanceRows`): group parts come from
 * each group's settle-up plan under its own rules, so People, Groups, the
 * group page and Settle up always agree.
 */
export function myBalances(
  records: LedgerRecord[],
  me: string,
  groups: Entity<Group>[],
): BalanceRow[] {
  return balanceRows(
    records,
    me,
    Object.fromEntries(groups.map(g => [g.id, g.data.rules])),
  )
}
