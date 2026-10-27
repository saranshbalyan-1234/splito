import {useState} from 'react'
import {useLingui} from '@lingui/react/macro'
import {
  balanceTrend,
  type DateRange,
  dataRange,
  type Granularity,
  granularityFor,
  periodRange,
  type ReportExpense,
  type ReportFilter,
  type ReportRecord,
  selectExpenses,
  spendingByCategory,
  spendingByGroup,
  spendingByPerson,
  spendingOverTime,
  spendingTotals,
  todayIn,
  type WeekStart,
  ZERO,
} from '@splito/domain'
import {DEFAULT_CATEGORIES, type Group, type Person} from '@splito/sync'

import {
  useEntities,
  useLedgerMirror,
  useMutationCtx,
  usePref,
} from '#/data/hooks'
import {
  inScope,
  type Scope,
  scopeFromPref,
  scopeToPref,
} from '#/screens/Analytics/scope'

export type PeriodChoice = 'week' | 'month' | 'year' | 'all' | 'custom'

/** What a tapped bar, slice or row narrows the expense list to. */
export type Selection =
  | {kind: 'time'; key: string; from: string; to: string; label: string}
  | {kind: 'category'; key: string; label: string}
  | {kind: 'person'; key: string; label: string}

/** The filter bar's own choices; unset fields fall back to the preferences. */
type FilterState = {
  period?: PeriodChoice
  offset: number
  custom?: DateRange
  currency?: string
}

/** A group as the scope sheet lists it. */
export type GroupOption = {
  id: string
  name: string
  kind: Group['kind']
  isArchived: boolean
}

/** `key` for the non-group slice in the by-group chart (group ids are never empty). */
export const DIRECT_KEY = ''

/** `YYYY-MM-DD` as a Date at UTC midnight; always format it with `timeZone: 'UTC'`. */
export function utcDate(d: string) {
  return new Date(Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)))
}

function deviceTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
}

/**
 * Everything Analytics shows, derived from the ledger and one filter state:
 * charts, totals, the expense list and the CSV all read from here, so the
 * numbers agree everywhere. Undefined while the local store loads.
 */
export function useReport() {
  const {t: l, i18n} = useLingui()
  const {actor: me} = useMutationCtx()
  /* Analytics looks at the whole ledger: read by index in pages once, then kept current (data/ledgerQueries). */
  const mirror = useLedgerMirror()
  const groups = useEntities<Group>('group')
  const people = useEntities<Person>('person')
  const [categories = DEFAULT_CATEGORIES] = usePref('categories')
  const [defaultPeriod] = usePref('analyticsPeriod')
  const [scopePref, setScopePref] = usePref('analyticsScope')
  const [defaultCurrency] = usePref('defaultCurrency')
  const [weekStartPref] = usePref('weekStart')
  const [timezonePref] = usePref('timezone')
  const [state, setState] = useState<FilterState>({offset: 0})
  const [picked, setPicked] = useState<{
    filterKey: string
    selection: Selection
  }>()

  if (!mirror || !groups || !people) return undefined
  const {ledger, expenses} = mirror

  const weekStart = (weekStartPref ?? 1) as WeekStart
  const tz =
    !timezonePref || timezonePref === 'device' ? deviceTimezone() : timezonePref
  const today = todayIn(tz, Date.now())

  /* Labels ride along on each expense record; repayments (when they exist) pass through. */
  const labels = new Map(expenses.map(e => [e.id, e.data]))
  const records: ReportRecord[] = ledger.map(r =>
    r.kind === 'expense'
      ? {
          ...r,
          category: labels.get(r.id)?.category,
          title: labels.get(r.id)?.title,
        }
      : r,
  )
  const live = records.filter(
    (r): r is ReportExpense => r.kind === 'expense' && !r.deleted,
  )

  /* Active groups first, then archived; by name within each. Deleted groups are gone from both. */
  const groupOptions: GroupOption[] = groups
    .map(g => ({
      id: g.id,
      name: g.data.name,
      kind: g.data.kind,
      isArchived: g.data.archived,
    }))
    .sort(
      (x, y) =>
        Number(x.isArchived) - Number(y.isArchived) ||
        x.name.localeCompare(y.name),
    )
  const groupIds = groupOptions.map(g => g.id)
  const scope = scopeFromPref(scopePref, groupIds)
  const scoped = records.filter(r => inScope(r.groupId, scope))

  /* Currencies with expenses, most used first; never mixed. */
  const counts = new Map<string, number>()
  for (const r of live)
    counts.set(r.currency, (counts.get(r.currency) ?? 0) + 1)
  const currencies = [...counts.keys()].sort(
    (x, y) => counts.get(y)! - counts.get(x)! || x.localeCompare(y),
  )
  const currency =
    state.currency && counts.has(state.currency)
      ? state.currency
      : defaultCurrency && counts.has(defaultCurrency)
        ? defaultCurrency
        : currencies[0]

  const groupName = new Map(groups.map(g => [g.id, g.data.name]))
  /* "All time" spans what the scope holds, so one group's trip is its own dates. */
  const inCurrency = scoped.filter(r => r.currency === currency)

  const bounds = dataRange(inCurrency, today) ?? {from: today, to: today}
  const period: PeriodChoice =
    state.period === 'custom' && !state.custom
      ? 'year'
      : (state.period ?? defaultPeriod ?? 'year')
  const range: DateRange =
    period === 'all'
      ? bounds
      : period === 'custom'
        ? state.custom!
        : periodRange(period, today, weekStart, state.offset)
  const granularity: Granularity =
    period === 'week' || period === 'month'
      ? 'day'
      : period === 'year'
        ? 'month'
        : granularityFor(range)

  /* The scope is applied to the records first, so the domain filter only picks currency and dates. */
  const filter: ReportFilter = {
    currency: currency ?? '',
    range,
    includeGroups: true,
  }
  const selected = currency ? selectExpenses(scoped, filter) : []
  const totals = spendingTotals(selected, me)
  const overTime = spendingOverTime(selected, me, range, granularity, weekStart)
  const byCategory = spendingByCategory(selected, me)
  const byPerson = spendingByPerson(selected)
  const byGroup = spendingByGroup(selected, me)
  const trend = currency
    ? balanceTrend(scoped, me, filter, granularity, weekStart)
    : []

  /* A selection belongs to the filter it was made under; any filter change clears it. */
  const filterKey = JSON.stringify([currency, range, scope])
  const selection = picked?.filterKey === filterKey ? picked.selection : null
  const select = (s: Selection | null) =>
    setPicked(s ? {filterKey, selection: s} : undefined)

  /* The list behind the current selection, and whose share each row shows. */
  const shareOf = selection?.kind === 'person' ? selection.key : me
  const rows = selected.filter(e => {
    if (!selection) return true
    const myShare = e.shares[me] ?? ZERO
    switch (selection.kind) {
      case 'time':
        return e.date >= selection.from && e.date <= selection.to
      case 'category':
        return myShare !== ZERO && (e.category ?? 'other') === selection.key
      case 'person':
        return (e.shares[selection.key] ?? ZERO) !== ZERO
    }
  })
  const rowsTotal = spendingTotals(rows, shareOf).share

  const date = (d: string, o: Intl.DateTimeFormatOptions) =>
    i18n.date(utcDate(d), {...o, timeZone: 'UTC'})
  const isMultiYear = range.from.slice(0, 4) !== range.to.slice(0, 4)
  const spanLabel = (r: DateRange) =>
    r.from === r.to
      ? date(r.from, {day: 'numeric', month: 'short', year: 'numeric'})
      : `${date(r.from, {day: 'numeric', month: 'short', ...(isMultiYear || r.from.slice(0, 4) !== r.to.slice(0, 4) ? {year: 'numeric'} : {})})} – ${date(r.to, {day: 'numeric', month: 'short', year: 'numeric'})}`
  const bucketLabels = (b: {key: string; from: string; to: string}) => {
    switch (granularity) {
      case 'day':
        return {
          axisLabel:
            period === 'week'
              ? date(b.key, {weekday: 'short'})
              : date(b.key, {day: 'numeric'}),
          label: date(b.key, {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          }),
        }
      case 'week':
        return {
          axisLabel: date(b.key, {day: 'numeric', month: 'short'}),
          label: spanLabel(b),
        }
      case 'month':
        return {
          axisLabel: date(
            b.key,
            isMultiYear ? {month: 'short', year: '2-digit'} : {month: 'short'},
          ),
          ...(isMultiYear
            ? {}
            : {axisLabelNarrow: date(b.key, {month: 'narrow'})}),
          label: date(b.key, {month: 'long', year: 'numeric'}),
        }
      case 'year':
        return {
          axisLabel: date(b.key, {year: 'numeric'}),
          label: date(b.key, {year: 'numeric'}),
        }
    }
  }
  const periodLabel =
    period === 'all'
      ? l`All time`
      : period === 'month'
        ? date(range.from, {month: 'long', year: 'numeric'})
        : period === 'year'
          ? date(range.from, {year: 'numeric'})
          : spanLabel(range)

  const personName = new Map(people.map(p => [p.id, p.data.name]))
  const categoryById = new Map(categories.map(c => [c.id, c]))
  const nameOfPerson = (id: string) =>
    id === me ? l`You` : (personName.get(id) ?? l`Someone`)
  const nameOfGroup = (id: string | null) =>
    id === null ? l`Non-group` : (groupName.get(id) ?? l`Group`)
  /* A category deleted since its expenses were saved shows as Other. */
  const other = categoryById.get('other') ?? DEFAULT_CATEGORIES.at(-1)!
  const category = (id: string) =>
    categoryById.get(id) ?? {...other, id, name: l`Other`}

  return {
    me,
    today,
    hasExpenses: live.length > 0,
    currencies,
    currency: currency ?? '',
    groupOptions,
    groupIds,
    scope,
    period,
    offset: state.offset,
    range,
    customRange: state.custom,
    weekStart,
    granularity,
    periodLabel,
    canGoBack: range.from > bounds.from,
    canGoForward: range.to < bounds.to,
    selected,
    totals,
    overTime: overTime.map(b => ({...b, ...bucketLabels(b)})),
    byCategory,
    byPerson,
    byGroup,
    /* The line stops at the last day anything is recorded for (today, or a later-dated expense). */
    trend: trend
      .filter(b => b.from <= bounds.to)
      .map(b => ({...b, ...bucketLabels(b)})),
    selection,
    select,
    rows,
    rowsTotal,
    shareOf,
    nameOfPerson,
    nameOfGroup,
    category,
    spanLabel,
    setPeriod: (period: Exclude<PeriodChoice, 'custom'>) =>
      setState(s => ({...s, period, offset: 0})),
    setCustom: (custom: DateRange) =>
      setState(s => ({...s, period: 'custom', custom, offset: 0})),
    step: (by: number) => setState(s => ({...s, offset: s.offset + by})),
    setCurrency: (currency: string) => setState(s => ({...s, currency})),
    /** Remembered on this device (`analyticsScope`). */
    setScope: (next: Scope) => void setScopePref(scopeToPref(next)),
  }
}

export type Report = NonNullable<ReturnType<typeof useReport>>
