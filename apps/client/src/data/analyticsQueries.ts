import {type DateRange, type ReportExpense, type SpendCell, ZERO} from '@splito/domain'
import {
  cellsOfEntity,
  type Entity,
  type Expense,
  type Key,
  type Page,
  type Repayment,
  type RowSyncStatus,
  type Store,
  toExpenseRecord,
  touches,
  type WriteOff,
} from '@splito/sync'

import {MORE, type Query} from '#/data/projections'

/*
 * What Analytics reads (ARCHITECTURE 9.8, "Analytics and Search never load
 * the ledger"): history-long figures come from the `aggregates` projection
 * (whole months, one row per month, group, category and person); the selected
 * period's edges, and short periods, come from the date indexes
 * (`byDate` ranges); the expense list pages newest first by cursor. Nothing
 * here reads a money store whole.
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

/* -------------------------------------------------------------------------- */
/* The expense list                                                           */
/* -------------------------------------------------------------------------- */

/** Which expenses the list behind the charts shows. */
export type RowsSpec = {
  currency: string
  from: string
  to: string
  scopeKey: string
  isIn: (groupId: string | null) => boolean
  /** A tapped slice or row narrows the list; a tapped bar narrows `from`/`to` instead. */
  selection?: {kind: 'category' | 'person'; key: string}
  me: string
}

/** A page of the list is this many rows read at a time. */
const READ = 100

const keepRow = (e: Entity<Expense>, s: RowsSpec) => {
  const d = e.data
  if (e.deleted || d.currency !== s.currency || !s.isIn(d.groupId)) return false
  if (s.selection?.kind === 'category') return (d.shares[s.me] ?? ZERO) !== ZERO && (d.category ?? 'other') === s.selection.key
  if (s.selection?.kind === 'person') return (d.shares[s.selection.key] ?? ZERO) !== ZERO
  return true
}

/** A row of the list behind the charts; `syncStatus` comes with it so the row is drawn lighter while unsynced, with no store read of its own. */
export type ListedExpense = ReportExpense & {syncStatus?: RowSyncStatus}
const asRow = (e: Entity<Expense>): ListedExpense => ({...toExpenseRecord(e), category: e.data.category, title: e.data.title, syncStatus: e.syncStatus})
const sameParts = (a: Record<string, bigint>, b: Record<string, bigint>) => {
  const ka = Object.keys(a)
  return ka.length === Object.keys(b).length && ka.every(k => a[k] === b[k])
}
const sameRow = (a: ListedExpense, b: ListedExpense) =>
  a.syncStatus === b.syncStatus && a.id === b.id && a.total === b.total && a.date === b.date && a.title === b.title && a.category === b.category && a.groupId === b.groupId && a.currency === b.currency && sameParts(a.payers, b.payers) && sameParts(a.shares, b.shares)
const byDateDesc = (x: ReportExpense, y: ReportExpense) => (x.date === y.date ? (x.id < y.id ? -1 : 1) : x.date > y.date ? -1 : 1)

/**
 * The first `want` rows of the list, newest first, read by cursor from the
 * `byDate` index (Infinity: all of them, for the CSV export only).
 * ponytail: a rare currency or a narrow scope reads past rows it drops;
 * `byGroupDate` per chosen group would skip them. Ties on one date are
 * ordered within the rows read.
 */
export async function readRows(store: Store, spec: RowsSpec, want: number): Promise<{rows: ListedExpense[]; isDone: boolean}> {
  const rows: ListedExpense[] = []
  let after: Key | null = null
  let isDone = false
  while (rows.length < want && !isDone) {
    const page: Page<Entity<Expense>> = await store.page<Expense>('expense', {index: 'byDate', min: spec.from, max: spec.to, dir: 'prev', after, limit: READ})
    after = page.next
    isDone = !page.next
    for (const e of page.items) if (keepRow(e, spec)) rows.push(asRow(e))
  }
  return {rows: rows.sort(byDateDesc), isDone}
}

export type RowsPager = {rows: ListedExpense[]; isDone: boolean; loadMore: () => void}

const rowQueries = new Map<string, Query<RowsPager>>()

/** The list behind the charts: a first screenful, `loadMore` for the next. */
export function rowsQuery(spec: RowsSpec): Query<RowsPager> {
  const key = `analytics:rows:${JSON.stringify([spec.currency, spec.from, spec.to, spec.scopeKey, spec.selection, spec.me])}`
  let q = rowQueries.get(key)
  if (!q) {
    q = {
      key,
      isTouchedBy: c => touches(c, 'expense'),
      loader: (store, controls) => {
        let want = 2 * READ
        const loadMore = () => {
          want += READ
          controls.reload(MORE)
        }
        return async (_c, prev) => {
          const {rows, isDone} = await readRows(store, spec, want)
          const same = prev && prev.isDone === isDone && prev.rows.length === rows.length && prev.rows.every((r, i) => sameRow(r, rows[i]!))
          return same ? prev : {rows, isDone, loadMore}
        }
      },
    }
    rowQueries.set(key, q)
  }
  return q
}
