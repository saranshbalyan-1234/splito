import {magnitude, ZERO} from '@splito/domain'
import {type Group, type ListSort, type RowSyncStatus} from '@splito/sync'

/** One group on the Groups list: my balance in it per currency, and who is in it (for search). */
export type GroupRowData = {
  id: string
  name: string
  /** Epoch ms the group was created, for the Newest order. */
  createdAt?: number
  kind: Group['kind']
  /** Inactive for every member (decision 89). */
  inactive?: boolean
  /** Hidden from my own lists (decision 89). */
  hidden?: boolean
  /** Deleted: it stays in the list, struck through, and opens read-only (decision 103). */
  deleted?: boolean
  balances: Record<string, bigint>
  /** Any member owes any other in this group (not just me): settled means every net is zero (F-1413). */
  isOpen?: boolean
  /** Every currency the group has had, settled ones too (a filter offers them). */
  currencies?: string[]
  /** Member names, so search finds a group by who is in it. */
  members: string[]
  /** Unsynced rows are drawn lighter (owner 111); set where a row view-model is built for a list that shows it. */
  syncStatus?: RowSyncStatus
}

/** Everything the Groups filter sets; applied together with Apply. */
export type GroupFilters = {
  type: Group['kind'] | 'all'
  status: 'active' | 'inactive' | 'all'
  /** The one "Show hidden" switch (decision 105): the groups I hid come back. */
  showHidden: boolean
  /** "Show settled" (decision 90, 112): off, groups with no open balance leave the list; the Overview counts them still. */
  showSettled: boolean
  currency: string | 'all'
  show: 'all' | 'owed' | 'owe' | 'settled'
}

export const DEFAULT_GROUP_FILTERS: GroupFilters = {
  type: 'all',
  status: 'active',
  showHidden: false,
  showSettled: false,
  currency: 'all',
  show: 'all',
}

/**
 * Settled up = the group's debts are all zero (no member owes another) and it has had records (`currencies` lists
 * settled ones too); a group with no expenses yet is new, not settled. My own net being zero is not enough.
 */
export function isGroupSettledUp(row: GroupRowData): boolean {
  const nets = Object.values(row.balances)
  const isOpen = row.isOpen ?? nets.some(v => v !== ZERO)
  return !isOpen && (nets.length > 0 || (row.currencies?.length ?? 0) > 0)
}

/**
 * The Groups filter applied. A single currency also trims each group's
 * balances to that currency, so the rows and the Overview show only it.
 * `owed` / `owe` keep a group with any balance that way (a group can be
 * both, in different currencies); `settled` keeps those with none open.
 */
export function filterGroups(
  rows: GroupRowData[],
  {type, status, showHidden, showSettled, currency, show}: GroupFilters,
): GroupRowData[] {
  return rows.flatMap(row => {
    if (type !== 'all' && row.kind !== type) return []
    // A deleted group is neither active nor inactive any more: it stays in the list whatever the status, unless asked for inactive ones only.
    if (status !== 'all' && !row.deleted && !!row.inactive !== (status === 'inactive')) return []
    if (status === 'inactive' && row.deleted) return []
    if (!showHidden && row.hidden) return []
    let balances = row.balances
    if (currency !== 'all') {
      if (!(currency in balances) && !row.currencies?.includes(currency))
        return []
      balances = {[currency]: balances[currency] ?? ZERO}
    }
    const nets = Object.values(balances)
    const keep =
      show === 'all' ||
      (show === 'owed' && nets.some(v => v > ZERO)) ||
      (show === 'owe' && nets.some(v => v < ZERO)) ||
      (show === 'settled' && nets.every(v => v === ZERO))
    const isSettledUp = isGroupSettledUp(row)
    if (!keep || (isSettledUp && !showSettled && show !== 'settled' && !row.deleted)) return []
    return [{...row, balances}]
  })
}

/**
 * The `groupsSort` order (owner 199). `lastActive`: most recently active group first (the store's `groupActivity`:
 * the newest change to the group or to a record or comment in it, the change time, not the expense date, read by
 * `useGroupActivity` and never computed here). `amount`: biggest balance in `currency` first (other currencies can't
 * be ranked against it, so those groups follow, open before settled). `newest`: the group created last first.
 * Ties, and `name`, go by name.
 */
export function sortGroups(
  rows: GroupRowData[],
  sort: ListSort,
  {currency, activity}: {currency: string; activity: Map<string, number>},
): GroupRowData[] {
  const size = (row: GroupRowData) => magnitude(row.balances[currency] ?? ZERO)
  const isOpen = (row: GroupRowData) =>
    Object.values(row.balances).some(v => v !== ZERO)
  return [...rows].sort((x, y) => {
    if (sort === 'amount') {
      const dx = size(x)
      const dy = size(y)
      if (dx !== dy) return dx > dy ? -1 : 1
      if (isOpen(x) !== isOpen(y)) return isOpen(x) ? -1 : 1
    } else if (sort === 'lastActive') {
      const ax = activity.get(x.id) ?? 0
      const ay = activity.get(y.id) ?? 0
      if (ax !== ay) return ax > ay ? -1 : 1
    } else if (sort === 'newest') {
      const cx = x.createdAt ?? 0
      const cy = y.createdAt ?? 0
      if (cx !== cy) return cx > cy ? -1 : 1
    }
    return x.name.localeCompare(y.name)
  })
}

/** Search by the group's name or any member's name, ignoring case. */
export function matchesGroupSearch(row: GroupRowData, query: string): boolean {
  const needle = query.trim().toLocaleLowerCase()
  if (!needle) return true
  return [row.name, ...row.members].some(name =>
    name.toLocaleLowerCase().includes(needle),
  )
}
