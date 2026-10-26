import {type CurrencyCode, getCurrency, toDecimalString} from './currency'
import type {LocalDate} from './date'
import {type ExpenseRecord, type LedgerRecord, pairwiseBalances} from './ledger'

/**
 * Reports over the ledger. Spending means expenses only: repayments move
 * money between people and never count as spending. Every function works on
 * one currency; currencies are never added together or converted here.
 *
 * Dates are the record's own local date (`YYYY-MM-DD`), which never shifts.
 * Only "today" depends on a timezone: the viewer's chosen one, which decides
 * which week, month or year is the current one.
 */

/** An expense as reports see it: the ledger record plus the labels a report shows. */
export type ReportExpense = ExpenseRecord & {category?: string; title?: string}
export type ReportRecord = ReportExpense | Exclude<LedgerRecord, ExpenseRecord>

/** Inclusive on both ends. */
export interface DateRange {
  from: LocalDate
  to: LocalDate
}

export type PeriodKind = 'week' | 'month' | 'year'
export type Granularity = 'day' | 'week' | 'month' | 'year'
/** 0 Sunday, 1 Monday, 6 Saturday (the `weekStart` preference). */
export type WeekStart = 0 | 1 | 6

export interface ReportFilter {
  currency: CurrencyCode
  /** All time is `dataRange(...)`. */
  range: DateRange
  /** One group only. Undefined: every group, subject to `includeGroups`. */
  groupId?: string
  /** With no group chosen: false keeps non-group expenses only. */
  includeGroups: boolean
}

const MS_DAY = 86_400_000

const toUtc = (d: LocalDate) => Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10)))
const fromUtc = (ms: number): LocalDate => new Date(ms).toISOString().slice(0, 10)
const ymd = (y: number, m: number, d: number) => fromUtc(Date.UTC(y, m, d))

/** Today's date in an IANA timezone at instant `now` (ms). */
export function todayIn(tz: string, now: number): LocalDate {
  const parts = new Intl.DateTimeFormat('en-US', {timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit'}).formatToParts(now)
  const get = (type: string) => parts.find(p => p.type === type)!.value
  return `${get('year')}-${get('month')}-${get('day')}`
}

export function addDays(d: LocalDate, n: number): LocalDate {
  return fromUtc(toUtc(d) + n * MS_DAY)
}

function daysBetween(a: LocalDate, b: LocalDate) {
  return Math.round((toUtc(b) - toUtc(a)) / MS_DAY)
}

/** First day of the bucket `d` falls in. */
function bucketStart(d: LocalDate, g: Granularity, weekStart: WeekStart): LocalDate {
  const y = Number(d.slice(0, 4))
  const m = Number(d.slice(5, 7)) - 1
  if (g === 'day') return d
  if (g === 'month') return ymd(y, m, 1)
  if (g === 'year') return ymd(y, 0, 1)
  const dow = new Date(toUtc(d)).getUTCDay()
  return addDays(d, -((dow - weekStart + 7) % 7))
}

/** First day of the bucket after the one starting at `start`. */
function nextBucket(start: LocalDate, g: Granularity): LocalDate {
  const y = Number(start.slice(0, 4))
  const m = Number(start.slice(5, 7)) - 1
  if (g === 'day') return addDays(start, 1)
  if (g === 'week') return addDays(start, 7)
  if (g === 'month') return ymd(y, m + 1, 1)
  return ymd(y + 1, 0, 1)
}

/** The week, month or year containing `anchor`, stepped `offset` periods back (negative) or forward. */
export function periodRange(kind: PeriodKind, anchor: LocalDate, weekStart: WeekStart, offset = 0): DateRange {
  const y = Number(anchor.slice(0, 4))
  const m = Number(anchor.slice(5, 7)) - 1
  if (kind === 'week') {
    const from = addDays(bucketStart(anchor, 'week', weekStart), offset * 7)
    return {from, to: addDays(from, 6)}
  }
  if (kind === 'month') return {from: ymd(y, m + offset, 1), to: ymd(y, m + offset + 1, 0)}
  return {from: ymd(y + offset, 0, 1), to: ymd(y + offset, 11, 31)}
}

/** Bar width for a range: about 7 to 31 bars, never hundreds. */
export function granularityFor(range: DateRange): Granularity {
  const days = daysBetween(range.from, range.to) + 1
  if (days <= 31) return 'day'
  if (days <= 183) return 'week'
  if (days <= 3 * 366) return 'month'
  return 'year'
}

export interface Bucket {
  /** Start of the whole bucket (may be before the range). Stable id for a bar. */
  key: LocalDate
  /** The part of the bucket inside the range. */
  from: LocalDate
  to: LocalDate
}

/** Consecutive buckets covering `range` exactly; the first and last are clipped to it. */
export function buckets(range: DateRange, g: Granularity, weekStart: WeekStart): Bucket[] {
  const out: Bucket[] = []
  for (let key = bucketStart(range.from, g, weekStart); key <= range.to; key = nextBucket(key, g)) {
    const end = addDays(nextBucket(key, g), -1)
    out.push({key, from: key < range.from ? range.from : key, to: end > range.to ? range.to : end})
  }
  return out
}

/** From the first live record to the later of today and the last one (future-dated expenses exist). Null when empty. */
export function dataRange(records: ReadonlyArray<ReportRecord>, today: LocalDate): DateRange | null {
  const dates = records.filter(r => !r.deleted).map(r => r.date)
  if (dates.length === 0) return null
  const from = dates.reduce((x, y) => (y < x ? y : x))
  const last = dates.reduce((x, y) => (y > x ? y : x))
  return {from: from < today ? from : today, to: last > today ? last : today}
}

function inScope(r: ReportRecord, f: ReportFilter) {
  if (r.deleted || r.currency !== f.currency) return false
  if (f.groupId !== undefined ? r.groupId !== f.groupId : !f.includeGroups && r.groupId !== null) return false
  return true
}

const byDateDesc = (x: ReportExpense, y: ReportExpense) => (x.date === y.date ? (x.id < y.id ? -1 : 1) : x.date > y.date ? -1 : 1)

/** The live expenses a filter covers, newest first. Repayments are never included. */
export function selectExpenses(records: ReadonlyArray<ReportRecord>, f: ReportFilter): ReportExpense[] {
  return records
    .filter((r): r is ReportExpense => r.kind === 'expense' && inScope(r, f) && r.date >= f.range.from && r.date <= f.range.to)
    .sort(byDateDesc)
}

export interface SpendingTotals {
  /** Your share: what you spent. */
  share: bigint
  /** What you paid for everyone. */
  paid: bigint
  /** Everyone's spending together. */
  total: bigint
  count: number
}

export function spendingTotals(expenses: ReadonlyArray<ReportExpense>, me: string): SpendingTotals {
  const t: SpendingTotals = {share: 0n, paid: 0n, total: 0n, count: 0}
  for (const e of expenses) {
    t.share += e.shares[me] ?? 0n
    t.paid += e.payers[me] ?? 0n
    t.total += e.total
    t.count += 1
  }
  return t
}

export type TimeBucket = Bucket & SpendingTotals

/** Totals per bucket across `range`, empty buckets included so bars line up with the axis. */
export function spendingOverTime(
  expenses: ReadonlyArray<ReportExpense>,
  me: string,
  range: DateRange,
  g: Granularity,
  weekStart: WeekStart,
): TimeBucket[] {
  return buckets(range, g, weekStart).map(b => ({
    ...b,
    ...spendingTotals(
      expenses.filter(e => e.date >= b.from && e.date <= b.to),
      me,
    ),
  }))
}

export interface Slice<K> {
  key: K
  share: bigint
  count: number
}

function slices<K extends string | null>(entries: Iterable<[K, bigint]>): Slice<K>[] {
  const map = new Map<K, Slice<K>>()
  for (const [key, v] of entries) {
    const s = map.get(key) ?? {key, share: 0n, count: 0}
    s.share += v
    s.count += 1
    map.set(key, s)
  }
  const id = (k: K) => k ?? ''
  return [...map.values()]
    .filter(s => s.share !== 0n)
    .sort((x, y) => (x.share === y.share ? (id(x.key) < id(y.key) ? -1 : 1) : x.share > y.share ? -1 : 1))
}

/** Your share per category, largest first. No category counts as `other`. */
export function spendingByCategory(expenses: ReadonlyArray<ReportExpense>, me: string): Slice<string>[] {
  return slices(expenses.filter(e => me in e.shares).map(e => [e.category ?? 'other', e.shares[me]!]))
}

/** Each participant's share of the same expenses (you included), largest first. Adds up to their total. */
export function spendingByPerson(expenses: ReadonlyArray<ReportExpense>): Slice<string>[] {
  return slices(expenses.flatMap(e => Object.entries(e.shares)))
}

/** Your share per group, largest first; non-group expenses under `null`. */
export function spendingByGroup(expenses: ReadonlyArray<ReportExpense>, me: string): Slice<string | null>[] {
  return slices(expenses.filter(e => me in e.shares).map(e => [e.groupId, e.shares[me]!]))
}

export type TrendPoint = Bucket & {
  /** Your net balance at the end of the bucket: > 0 others owe you. Same rules as People. */
  balance: bigint
}

/**
 * Your running net balance across `f.range`, counting
 * every earlier record too, so the line starts where you actually stood.
 * Expenses and repayments both move it.
 */
export function balanceTrend(records: ReadonlyArray<ReportRecord>, me: string, f: ReportFilter, g: Granularity, weekStart: WeekStart): TrendPoint[] {
  const scoped = records.filter(r => inScope(r, f))
  /* Each record's effect, from the same pairwise rule People uses, so rounding matches to the minor unit. */
  const effects = scoped
    .map(r => ({date: r.date, net: pairwiseBalances([r], me).reduce((s, row) => s + row.amount, 0n)}))
    .sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : 0))
  let i = 0
  let balance = 0n
  return buckets(f.range, g, weekStart).map(b => {
    while (i < effects.length && effects[i]!.date <= b.to) balance += effects[i++]!.net
    return {...b, balance}
  })
}

const NUMBER = /^-?\d+(\.\d+)?$/
const FORMULA = /^[=+\-@\t\r]/

/**
 * One CSV cell. Text a spreadsheet would run as a formula (leading `=`, `+`,
 * `-`, `@`, tab or CR) gets a leading apostrophe; plain numbers are left alone.
 * Then RFC 4180 quoting.
 */
export function csvCell(value: string): string {
  const safe = FORMULA.test(value) && !NUMBER.test(value) ? "'" + value : value
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

/** RFC 4180: comma-separated, CRLF after every row. */
export function toCsv(rows: ReadonlyArray<ReadonlyArray<string>>): string {
  return rows.map(r => r.map(csvCell).join(',') + '\r\n').join('')
}

/**
 * The expenses behind a report as CSV: date, description, category, group,
 * currency, total, you paid, your share. Amounts are exact decimals in the
 * currency's own scale, never floats. Names come from the caller (they are
 * user data and translated labels).
 */
export function reportCsv(
  expenses: ReadonlyArray<ReportExpense>,
  me: string,
  labels: {header: string[]; categoryName: (id: string) => string; groupName: (id: string | null) => string},
): string {
  const rows = expenses.map(e => {
    const amount = (v: bigint) => toDecimalString(v, getCurrency(e.currency).scale)
    return [
      e.date,
      e.title ?? '',
      labels.categoryName(e.category ?? 'other'),
      labels.groupName(e.groupId),
      e.currency,
      amount(e.total),
      amount(e.payers[me] ?? 0n),
      amount(e.shares[me] ?? 0n),
    ]
  })
  return toCsv([labels.header, ...rows])
}
