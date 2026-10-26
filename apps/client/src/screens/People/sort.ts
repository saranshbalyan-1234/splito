import {
  type LedgerRecord,
  magnitude,
  type PersonSummary,
  ZERO,
} from '@splito/domain'

/** One friend on People: their balance with me, if any. */
export type FriendRow = {id: string; name: string; summary?: PersonSummary}

/** The latest date (`YYYY-MM-DD`) of a live record each person is on. */
export function lastActivity(records: LedgerRecord[]): Map<string, string> {
  const latest = new Map<string, string>()
  for (const r of records) {
    if (r.deleted) continue
    const people =
      r.kind === 'repayment'
        ? [r.from, r.to]
        : [...Object.keys(r.payers), ...Object.keys(r.shares)]
    for (const p of people)
      if ((latest.get(p) ?? '') < r.date) latest.set(p, r.date)
  }
  return latest
}

/**
 * The `peopleSort` preference applied. `amount`: biggest balance in the
 * default currency first (balances in other currencies can't be ranked
 * against it, so those friends follow, open balances before settled ones).
 * `recent`: latest shared record first. Ties, and `name`, go by name.
 */
export function sortFriends<T extends FriendRow>(
  rows: T[],
  sort: 'amount' | 'name' | 'recent',
  {currency, activity}: {currency: string; activity: Map<string, string>},
): T[] {
  const size = (row: FriendRow) =>
    magnitude(row.summary?.byCurrency[currency]?.total ?? ZERO)
  const isOpen = (row: FriendRow) =>
    Object.values(row.summary?.byCurrency ?? {}).some(c => c.total !== ZERO)
  const byName = (x: FriendRow, y: FriendRow) => x.name.localeCompare(y.name)
  return [...rows].sort((x, y) => {
    if (sort === 'amount') {
      const dx = size(x)
      const dy = size(y)
      if (dx !== dy) return dx > dy ? -1 : 1
      if (isOpen(x) !== isOpen(y)) return isOpen(x) ? -1 : 1
    } else if (sort === 'recent') {
      const ax = activity.get(x.id) ?? ''
      const ay = activity.get(y.id) ?? ''
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
 * be both, in different currencies); `settled` keeps those with none open.
 */
export function filterFriends<T extends FriendRow>(
  rows: T[],
  {currency, show}: FriendFilter,
): T[] {
  return rows.flatMap(row => {
    const all = row.summary?.byCurrency ?? {}
    let summary = row.summary
    if (currency !== 'all') {
      if (!all[currency]) return []
      summary = {...row.summary!, byCurrency: {[currency]: all[currency]}}
    }
    const totals = Object.values(summary?.byCurrency ?? {}).map(c => c.total)
    const keep =
      show === 'all' ||
      (show === 'owesYou' && totals.some(v => v > ZERO)) ||
      (show === 'youOwe' && totals.some(v => v < ZERO)) ||
      (show === 'settled' && totals.every(v => v === ZERO))
    return keep ? [{...row, summary}] : []
  })
}
