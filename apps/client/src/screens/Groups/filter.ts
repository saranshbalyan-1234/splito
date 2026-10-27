import {magnitude, ZERO} from '@splito/domain'
import {type Group} from '@splito/sync'

/** One group on the Groups list: my balance in it per currency, and who is in it (for search). */
export type GroupRowData = {
  id: string
  name: string
  kind: Group['kind']
  /** Inactive for every member (decision 89). */
  inactive?: boolean
  /** Hidden from my own lists (decision 89). */
  hidden?: boolean
  balances: Record<string, bigint>
  /** Member names, so search finds a group by who is in it. */
  members: string[]
}

/** Everything the Groups filter sets; applied together with Apply. */
export type GroupFilters = {
  type: Group['kind'] | 'all'
  status: 'active' | 'inactive' | 'all'
  /** Shown or hidden groups (personal, decision 89). */
  visibility: 'shown' | 'hidden' | 'all'
  currency: string | 'all'
  show: 'all' | 'owed' | 'owe' | 'settled'
  sort: 'recent' | 'name' | 'amount'
}

export const DEFAULT_GROUP_FILTERS: GroupFilters = {
  type: 'all',
  status: 'active',
  visibility: 'shown',
  currency: 'all',
  show: 'all',
  sort: 'recent',
}

/**
 * The Groups filter applied. A single currency also trims each group's
 * balances to that currency, so the rows and the Overview show only it.
 * `owed` / `owe` keep a group with any balance that way (a group can be
 * both, in different currencies); `settled` keeps those with none open.
 */
export function filterGroups(
  rows: GroupRowData[],
  {type, status, visibility, currency, show}: GroupFilters,
): GroupRowData[] {
  return rows.flatMap(row => {
    if (type !== 'all' && row.kind !== type) return []
    if (status !== 'all' && !!row.inactive !== (status === 'inactive')) return []
    if (visibility !== 'all' && !!row.hidden !== (visibility === 'hidden')) return []
    let balances = row.balances
    if (currency !== 'all') {
      if (!(currency in balances)) return []
      balances = {[currency]: balances[currency]!}
    }
    const nets = Object.values(balances)
    const keep =
      show === 'all' ||
      (show === 'owed' && nets.some(v => v > ZERO)) ||
      (show === 'owe' && nets.some(v => v < ZERO)) ||
      (show === 'settled' && nets.every(v => v === ZERO))
    return keep ? [{...row, balances}] : []
  })
}

/**
 * `recent`: most recently active group first (the store's `groupActivity`: the newest change to the group or to a record in it, the change time, not the expense date). `amount`: biggest balance in
 * `currency` first (other currencies can't be ranked against it, so those
 * groups follow, open before settled). Ties, and `name`, go by name.
 */
export function sortGroups(
  rows: GroupRowData[],
  sort: GroupFilters['sort'],
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
    } else if (sort === 'recent') {
      const ax = activity.get(x.id) ?? 0
      const ay = activity.get(y.id) ?? 0
      if (ax !== ay) return ax > ay ? -1 : 1
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
