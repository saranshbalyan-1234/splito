import {groupNet, type LedgerRecord} from '@splito/domain'
import {type Group} from '@splito/sync'

/**
 * `groupNet` per currency with every member listed (zero when they have no
 * records yet), so a settlement plan can route through them.
 */
export function memberNets(
  records: LedgerRecord[],
  groupId: string,
  group: Group,
): Record<string, Record<string, bigint>> {
  const zero = Object.fromEntries(group.members.map(m => [m.personId, 0n]))
  return Object.fromEntries(
    Object.entries(groupNet(records, groupId))
      .sort(([x], [y]) => x.localeCompare(y))
      .map(([currency, net]) => [currency, {...zero, ...net}]),
  )
}
