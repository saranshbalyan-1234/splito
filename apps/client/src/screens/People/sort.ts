import {
  balanceSides,
  isSettledBalance,
  magnitude,
  type PersonSummary,
  SETTLED_BALANCE,
  ZERO,
} from '@splito/domain'

/** One friend on People: their balance with me, if any. */
export type FriendRow = {id: string; name: string; summary?: PersonSummary}

/**
 * The `peopleSort` preference applied. `amount`: biggest balance in the
 * default currency first (balances in other currencies can't be ranked
 * against it, so those friends follow, open balances before settled ones).
 * `recent`: the friend with the newest change to a record they are on first (`people.lastActivityAt`). Ties, and `name`, go by name.
 */
export function sortFriends<T extends FriendRow>(
  rows: T[],
  sort: 'amount' | 'name' | 'recent',
  {currency, activity}: {currency: string; activity: Map<string, number>},
): T[] {
  const size = (row: FriendRow) =>
    magnitude(row.summary?.byCurrency[currency]?.total ?? ZERO)
  const isOpen = (row: FriendRow) =>
    Object.values(row.summary?.byCurrency ?? {}).some(c => !isSettledBalance(c))
  const byName = (x: FriendRow, y: FriendRow) => x.name.localeCompare(y.name)
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
    return byName(x, y)
  })
}

/** What the People filter keeps: one currency or all, and which way the balance goes. */
export type FriendFilter = {
  currency: string | 'all'
  show: 'all' | 'owesYou' | 'youOwe' | 'settled'
}

/**
 * The People filter applied. A single currency also trims each summary to
 * that currency, so the rows and the totals above them show only it.
 * `owesYou` / `youOwe` keep a friend with any balance that way (a friend can
 * be both, in different currencies, or directly and in a group); `settled`
 * keeps those with every part zero. `seen` lists each friend's currencies
 * that are square now: a settled currency still filters, and shows as zero
 * (audit m3).
 */
export function filterFriends<T extends FriendRow>(
  rows: T[],
  {currency, show}: FriendFilter,
  seen?: ReadonlyMap<string, ReadonlySet<string>>,
): T[] {
  return rows.flatMap(row => {
    const all = row.summary?.byCurrency ?? {}
    let summary = row.summary
    if (currency !== 'all') {
      const balance =
        all[currency] ??
        (seen?.get(row.id)?.has(currency) ? SETTLED_BALANCE : undefined)
      if (!balance) return []
      summary = {
        person: row.id,
        ...row.summary,
        byCurrency: {[currency]: balance},
      }
    }
    // Each way part by part, never netted across direct and groups (audit M10).
    const sides = Object.values(summary?.byCurrency ?? {}).map(balanceSides)
    const keep =
      show === 'all' ||
      (show === 'owesYou' && sides.some(v => v.owed > ZERO)) ||
      (show === 'youOwe' && sides.some(v => v.owe > ZERO)) ||
      (show === 'settled' &&
        sides.every(v => v.owed === ZERO && v.owe === ZERO))
    return keep ? [{...row, summary}] : []
  })
}

/**
 * Each friend's settled-or-open currencies as the filter reads them. With
 * Include groups off, a currency a friend only has in groups is left out, so
 * it is neither offered nor matched (audit m3).
 */
export function seenByPerson(
  seen: Record<string, {currency: string; groupId: string | null}[]>,
  includeGroups: boolean,
): Map<string, Set<string>> {
  return new Map(
    Object.entries(seen).map(([id, entries]) => [
      id,
      new Set(
        entries
          .filter(e => includeGroups || e.groupId === null)
          .map(e => e.currency),
      ),
    ]),
  )
}
