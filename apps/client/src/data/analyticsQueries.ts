import {type DateRange, type SpendCell} from '@splito/domain'
import {cellsOfEntity, type Expense, type Repayment, type Store, touches, type WriteOff} from '@splito/sync'

import {type Query} from '#/data/projections'

/*
 * What Analytics reads (ARCHITECTURE 9.8, "Analytics and Search never load
 * the ledger"): history-long figures come from the `aggregates` projection
 * (whole months, one row per month, group, category and person); the selected
 * period's edges, and short periods, come from the date indexes
 * (`byDate` ranges). Analytics lists no expenses (owner 226: Activity is the list behind it).
 * Nothing here reads a money store whole.
 */

const isMoney = (c: Parameters<typeof touches>[0]) => touches(c, 'expense') || touches(c, 'repayment') || touches(c, 'writeoff')

/** More rows than a date range holds: "all of it" for one range read. */
const ALL = 1_000_000

const month = (d: string) => d.slice(0, 7)
const first = (m: string) => `${m}-01`
const shift = (m: string, by: number) => {
  const t = Date.UTC(+m.slice(0, 4), +m.slice(5, 7) - 1 + by, 1)
  return new Date(t).toISOString().slice(0, 7)
}
const last = (m: string) => new Date(Date.UTC(+m.slice(0, 4), +m.slice(5, 7), 0)).toISOString().slice(0, 10)
const dayBefore = (d: string) => new Date(Date.parse(d) - 86_400_000).toISOString().slice(0, 10)

const sameCells = (a: SpendCell[], b: SpendCell[]) =>
  a.length === b.length &&
  a.every((c, i) => {
    const n = b[i]!
    return c.date === n.date && c.currency === n.currency && c.groupId === n.groupId && c.category === n.category && c.person === n.person && c.kind === n.kind && c.total === n.total && c.paid === n.paid && c.share === n.share && c.net === n.net && c.count === n.count
  })

/* -------------------------------------------------------------------------- */
/* Overview: which currencies have expenses                                   */
/* -------------------------------------------------------------------------- */

/** Currencies with live expenses, most used first, and whether there are any expenses at all. */
export type Overview = {currencies: string[]; hasExpenses: boolean}

export const overviewQuery: Query<Overview> = {
  key: 'analytics:overview',
  isTouchedBy: isMoney,
  loader: store => async (_c, prev) => {
    const counts = new Map<string, number>()
    for (const c of await store.aggregates({personId: ''})) if (c.kind === 'expense') counts.set(c.currency, (counts.get(c.currency) ?? 0) + c.count)
    const currencies = [...counts].filter(([, n]) => n > 0).sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0])).map(([code]) => code)
    const next = {currencies, hasExpenses: currencies.length > 0}
    return prev && prev.hasExpenses === next.hasExpenses && prev.currencies.join() === next.currencies.join() ? prev : next
  },
}

const myExpenseCountQueries = new Map<string, Query<number>>()

/**
 * How many live expenses I have a share in, from the stored per-person cells (no ledger read). An expense I only paid
 * for, with no share of my own, has no counted cell, so it is not in this number (ceiling of the stored projection).
 */
export function myExpenseCountQuery(me: string): Query<number> {
  const key = `analytics:myExpenses:${me}`
  let q = myExpenseCountQueries.get(key)
  if (!q) {
    q = {
      key,
      isTouchedBy: isMoney,
      loader: store => async () => {
        let n = 0
        for (const c of await store.aggregates({personId: me})) if (c.kind === 'expense') n += c.count
        return n
      },
    }
    myExpenseCountQueries.set(key, q)
  }
  return q
}

/* -------------------------------------------------------------------------- */
/* Cells                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * The cells of the live records dated `from` to `to` (inclusive) in one currency, read by the date indexes
 * (`byGroupDate` / `byGroup` for one group, so another group's records are never read).
 */
async function cellsBetween(store: Store, from: string, to: string, currency: string, groupId?: string): Promise<SpendCell[]> {
  if (from > to) return []
  const dated = <T>(type: 'expense' | 'repayment' | 'writeoff') =>
    store.page<T>(type, groupId === undefined ? {index: 'byDate', min: from, max: to, limit: ALL} : {index: type === 'expense' ? 'byGroupDate' : 'byGroup', eq: [groupId], min: from, max: to, limit: ALL})
  const [expenses, repayments, writeOffs] = await Promise.all([dated<Expense>('expense'), dated<Repayment>('repayment'), dated<WriteOff>('writeoff')])
  // The same guard as the stored sums use (deleted rows, rows of a shape this build does not know), so the two agree.
  return [...expenses.items, ...repayments.items, ...writeOffs.items].flatMap(e => cellsOfEntity(e)).filter(c => c.currency === currency)
}

/** What a period's report is made of: the cells inside it, and every earlier cell for the balance line. */
export type CellData = {currency: string; range: DateRange; period: SpendCell[]; before: SpendCell[]}

/**
 * Whole months come from the stored aggregates; the partial months at either
 * end, and the whole range when `exact` (day or week bars), from the date
 * indexes. Everything before `range.from` is read the same way, for the
 * balance line, which counts every earlier record.
 */
export function cellsQuery(currency: string, range: DateRange, exact: boolean, groupId?: string): Query<CellData> {
  const key = `analytics:cells:${currency}:${range.from}:${range.to}:${exact}${groupId === undefined ? '' : `:${groupId}`}`
  let q = cellQueries.get(key)
  if (!q) {
    q = {
      key,
      isTouchedBy: isMoney,
      loader: store => async (_c, prev) => {
        const m0 = month(range.from)
        const m1 = month(range.to)
        const stored = (await store.aggregates({currency})).filter(c => groupId === undefined || c.groupId === groupId)
        const before = [
          ...stored.filter(c => month(c.date) < m0),
          ...(range.from === first(m0) ? [] : await cellsBetween(store, first(m0), dayBefore(range.from), currency, groupId)),
        ]
        let period: SpendCell[]
        if (exact) period = await cellsBetween(store, range.from, range.to, currency, groupId)
        else {
          // Whole months are stored; a month the range only partly covers is read from the records.
          const isHeadPartial = range.from !== first(m0)
          const isTailPartial = range.to !== last(m1)
          const whole0 = isHeadPartial ? shift(m0, 1) : m0
          const whole1 = isTailPartial ? shift(m1, -1) : m1
          period = stored.filter(c => month(c.date) >= whole0 && month(c.date) <= whole1)
          const reads: Array<[string, string]> = []
          if (m0 === m1) {
            if (isHeadPartial || isTailPartial) reads.push([range.from, range.to])
          } else {
            if (isHeadPartial) reads.push([range.from, last(m0)])
            if (isTailPartial) reads.push([first(m1), range.to])
          }
          for (const [from, to] of reads) period.push(...(await cellsBetween(store, from, to, currency, groupId)))
        }
        return prev && sameCells(prev.period, period) && sameCells(prev.before, before) ? prev : {currency, range, period, before}
      },
    }
    cellQueries.set(key, q)
  }
  return q
}
const cellQueries = new Map<string, Query<CellData>>()

/* -------------------------------------------------------------------------- */
/* Bounds                                                                     */
/* -------------------------------------------------------------------------- */

/** First and last dated record in one currency and scope (null: none): months from the aggregates, the two end months read for the exact days. */
export function boundsQuery(currency: string, scopeKey: string, isIn: (groupId: string | null) => boolean): Query<DateRange | null> {
  const key = `analytics:bounds:${currency}:${scopeKey}`
  let q = boundQueries.get(key)
  if (!q) {
    q = {
      key,
      isTouchedBy: isMoney,
      loader: store => async (_c, prev) => {
        const wanted = (c: SpendCell) => c.person === '' && isIn(c.groupId || null)
        const months = (await store.aggregates({personId: '', currency})).filter(wanted).map(c => month(c.date)).sort()
        if (months.length === 0) return null
        const dates = async (m: string) => (await cellsBetween(store, first(m), last(m), currency)).filter(wanted).map(c => c.date).sort()
        const from = (await dates(months[0]!))[0]!
        const to = (await dates(months[months.length - 1]!)).at(-1)!
        return prev && prev.from === from && prev.to === to ? prev : {from, to}
      },
    }
    boundQueries.set(key, q)
  }
  return q
}
const boundQueries = new Map<string, Query<DateRange | null>>()
