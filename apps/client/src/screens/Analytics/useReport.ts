import {useState} from 'react'
import {useLingui} from '@lingui/react/macro'
import {useNavigation, useRoute} from '@react-navigation/native'
import {
  cellBalanceTrend,
  cellsByCategory,
  cellsByGroup,
  cellsByPerson,
  cellsOverTime,
  cellTotals,
  type DateRange,
  type Granularity,
  granularityFor,
  periodRange,
  type WeekStart,
  ZERO,
} from '@splito/domain'
import {DEFAULT_CATEGORIES, type Group, isGroupInactive, type Person} from '@splito/sync'

import {useFormatDay, useToday} from '#/locale/useDates'
import {type ListedExpense, readRows} from '#/data/analyticsQueries'
import {
  useAnalyticsBounds,
  useAnalyticsCells,
  useAnalyticsOverview,
  useAnalyticsRows,
  useEntities,
  useMutationCtx,
  usePref,
  useStore,
} from '#/data/hooks'
import {
  inScope,
  type Scope,
  scopeFromPref,
  scopeToPref,
} from '#/screens/Analytics/scope'
import {readAnalyticsParams, scopeToParam} from '#/screens/Analytics/urlState'

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
  isInactive: boolean
}

/** `key` for the non-group slice in the by-group chart (group ids are never empty). */
export const DIRECT_KEY = ''

/** `YYYY-MM-DD` as a Date at UTC midnight; always format it with `timeZone: 'UTC'`. */
export function utcDate(d: string) {
  return new Date(Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)))
}

/** What the screen last had an answer for: the report keeps showing it while the next period loads. */
type View = {
  data: NonNullable<ReturnType<typeof useAnalyticsCells>>
  period: PeriodChoice
  granularity: Granularity
  offset: number
}

/**
 * Everything Analytics shows, derived from the stored month sums, the date
 * indexes and one filter state (ARCHITECTURE 9.8: the ledger is never
 * loaded): charts, totals, the expense list and the CSV all read from here,
 * so the numbers agree everywhere. Undefined while the local store loads.
 */
export function useReport() {
  const {t: l, i18n} = useLingui()
  const {actor: me} = useMutationCtx()
  const store = useStore()
  const overview = useAnalyticsOverview()
  const groups = useEntities<Group>('group')
  const people = useEntities<Person>('person')
  const [categories = DEFAULT_CATEGORIES] = usePref('categories')
  const [defaultPeriod, saveDefaultPeriod] = usePref('analyticsPeriod')
  const [scopePref, setScopePref] = usePref('analyticsScope')
  const [defaultCurrency] = usePref('defaultCurrency')
  const [weekStartPref] = usePref('weekStart')
  const today = useToday()
  const formatDay = useFormatDay()
  /*
   * The filter bar's choices live in the address (F-241): `?currency=EUR` (an Overview card opens it so, audit
   * m21), `period`, `offset`, `from`/`to`, `scope`. A param that is present wins over the saved preference.
   * They are written on a tap, never on mount.
   */
  const route = useRoute()
  const navigation = useNavigation()
  const urlState = readAnalyticsParams(route.params as Record<string, string | undefined> | undefined)
  const state: FilterState = urlState
  const setParams = (patch: Record<string, string | undefined>) => navigation.setParams(patch as never)
  const [picked, setPicked] = useState<{
    filterKey: string
    selection: Selection
  }>()
  const [held, setHeld] = useState<View>()

  const weekStart = (weekStartPref ?? 1) as WeekStart

  /* Active groups first, then inactive; by name within each. Deleted groups are gone from both. */
  const groupOptions: GroupOption[] = (groups ?? [])
    .map(g => ({
      id: g.id,
      name: g.data.name,
      kind: g.data.kind,
      isInactive: isGroupInactive(g.data),
    }))
    .sort(
      (x, y) =>
        Number(x.isInactive) - Number(y.isInactive) ||
        x.name.localeCompare(y.name),
    )
  const groupIds = groupOptions.map(g => g.id)
  const scope = urlState.scope ? scopeFromPref(urlState.scope, groupIds) : scopeFromPref(scopePref, groupIds)
  const scopeKey = JSON.stringify(scope)
  const isIn = (groupId: string | null) => inScope(groupId, scope)

  /* Currencies with expenses, most used first; never mixed. */
  const currencies = overview?.currencies ?? []
  const currency =
    state.currency && currencies.includes(state.currency)
      ? state.currency
      : defaultCurrency && currencies.includes(defaultCurrency)
        ? defaultCurrency
        : currencies[0]

  /* "All time" spans what the scope holds, so one group's trip is its own dates. */
  const stored = useAnalyticsBounds(
    currency && groups ? {currency, scopeKey, isIn} : null,
  )
  const bounds: DateRange = stored
    ? {
        from: stored.from < today ? stored.from : today,
        to: stored.to > today ? stored.to : today,
      }
    : {from: today, to: today}

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
  /* Whole months are stored; bars of days or weeks need the days themselves. */
  const isExact = granularity === 'day' || granularity === 'week'

  /* With no expense at all there is nothing to read: an empty period. */
  const isEmpty = overview ? !overview.hasExpenses : false
  const read = useAnalyticsCells(
    currency && groups && !(period === 'all' && stored === undefined)
      ? {currency, from: range.from, to: range.to, exact: isExact}
      : null,
  )
  if (read && read !== held?.data)
    setHeld({data: read, period, granularity, offset: state.offset})
  const view: View | undefined = read
    ? {data: read, period, granularity, offset: state.offset}
    : isEmpty
      ? {
          data: {currency: '', range, period: [], before: []},
          period,
          granularity,
          offset: state.offset,
        }
      : held

  /* A selection belongs to the filter it was made under; any filter change clears it. */
  const shownRange = view?.data.range
  const shownCurrency = view?.data.currency
  const filterKey = JSON.stringify([shownCurrency, shownRange, scope])
  const selection = picked?.filterKey === filterKey ? picked.selection : null
  const shareOf = selection?.kind === 'person' ? selection.key : me

  /* The list behind the current selection: a bar narrows the dates, a slice or row the expenses. */
  const listed = useAnalyticsRows(
    view && shownCurrency
      ? {
          currency: shownCurrency,
          from: selection?.kind === 'time' ? selection.from : view.data.range.from,
          to: selection?.kind === 'time' ? selection.to : view.data.range.to,
          scopeKey,
          isIn,
          selection:
            selection?.kind === 'category' || selection?.kind === 'person'
              ? {kind: selection.kind, key: selection.key}
              : undefined,
          me,
        }
      : null,
  )

  if (!view || !groups || !people || !overview) return undefined
  const {data} = view
  const shownGranularity = view.granularity
  const shownPeriod = view.period
  const shownRangeNow = data.range
  const shownBounds = bounds

  /* The scope applies to the cells; the domain functions pick the currency's dates and kinds. */
  const cells = data.period.filter(c => isIn(c.groupId || null))
  const earlier = data.before.filter(c => isIn(c.groupId || null))
  const totals = cellTotals(cells, me)
  const overTime = cellsOverTime(cells, me, shownRangeNow, shownGranularity, weekStart)
  const byCategory = cellsByCategory(cells, me)
  const byPerson = cellsByPerson(cells)
  const byGroup = cellsByGroup(cells, me)
  const trend = data.currency
    ? cellBalanceTrend([...earlier, ...cells], me, shownRangeNow, shownGranularity, weekStart)
    : []

  const select = (s: Selection | null) =>
    setPicked(s ? {filterKey, selection: s} : undefined)

  /* How many rows the selection holds and whose share they add up to: the cells already say. */
  const sliceOf = (slices: Array<{key: string | null; share: bigint; count: number}>, key: string) =>
    slices.find(x => x.key === key)
  const inBar =
    selection?.kind === 'time'
      ? cellTotals(
          cells.filter(c => c.date >= selection.from && c.date <= selection.to),
          me,
        )
      : undefined
  const slice =
    selection?.kind === 'category'
      ? sliceOf(byCategory, selection.key)
      : selection?.kind === 'person'
        ? sliceOf(byPerson, selection.key)
        : undefined
  const rowCount = !selection ? totals.count : (inBar?.count ?? slice?.count ?? 0)
  const rowsTotal = !selection ? totals.share : (inBar?.share ?? slice?.share ?? ZERO)
  const rows: ListedExpense[] = listed?.rows ?? []

  const date = (d: string, o: Intl.DateTimeFormatOptions) =>
    i18n.date(utcDate(d), {...o, timeZone: 'UTC'})
  const groupName = new Map(groups.map(g => [g.id, g.data.name]))
  const isMultiYear = shownRangeNow.from.slice(0, 4) !== shownRangeNow.to.slice(0, 4)
  const spanLabel = (r: DateRange) =>
    r.from === r.to
      ? formatDay(r.from, {intl: {day: 'numeric', month: 'short', year: 'numeric'}})
      : `${formatDay(r.from, {intl: {day: 'numeric', month: 'short', ...(isMultiYear || r.from.slice(0, 4) !== r.to.slice(0, 4) ? {year: 'numeric'} : {})}})} – ${formatDay(r.to, {intl: {day: 'numeric', month: 'short', year: 'numeric'}})}`
  const bucketLabels = (b: {key: string; from: string; to: string}) => {
    switch (shownGranularity) {
      case 'day':
        return {
          axisLabel:
            shownPeriod === 'week'
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
    shownPeriod === 'all'
      ? l`All time`
      : shownPeriod === 'month'
        ? date(shownRangeNow.from, {month: 'long', year: 'numeric'})
        : shownPeriod === 'year'
          ? date(shownRangeNow.from, {year: 'numeric'})
          : spanLabel(shownRangeNow)

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
    hasExpenses: overview.hasExpenses,
    currencies,
    currency: currency ?? '',
    groupOptions,
    groupIds,
    scope,
    period,
    offset: state.offset,
    range: shownRangeNow,
    customRange: state.custom,
    weekStart,
    granularity: shownGranularity,
    periodLabel,
    canGoBack: shownRangeNow.from > shownBounds.from,
    canGoForward: shownRangeNow.to < shownBounds.to,
    totals,
    overTime: overTime.map(b => ({...b, ...bucketLabels(b)})),
    byCategory,
    byPerson,
    byGroup,
    /* The line stops at the last day anything is recorded for (today, or a later-dated expense). */
    trend: trend
      .filter(b => b.from <= shownBounds.to)
      .map(b => ({...b, ...bucketLabels(b)})),
    selection,
    select,
    /** The rows loaded so far, newest first; `rowCount` is how many there are in all. */
    rows,
    rowCount,
    isRowsDone: listed?.isDone ?? true,
    loadMoreRows: listed?.loadMore ?? (() => {}),
    /** Every row of the list, for the CSV export (a full read of the period by cursor, on request). */
    exportRows: async () =>
      (
        await readRows(
          store,
          {
            currency: data.currency,
            from: selection?.kind === 'time' ? selection.from : data.range.from,
            to: selection?.kind === 'time' ? selection.to : data.range.to,
            scopeKey,
            isIn,
            selection:
              selection?.kind === 'category' || selection?.kind === 'person'
                ? {kind: selection.kind, key: selection.key}
                : undefined,
            me,
          },
          Infinity,
        )
      ).rows,
    rowsTotal,
    shareOf,
    nameOfPerson,
    nameOfGroup,
    category,
    spanLabel,
    /** Remembered as the period Analytics opens with (`analyticsPeriod`, decision 90); a custom range is not. */
    setPeriod: (period: Exclude<PeriodChoice, 'custom'>) => {
      setParams({period, offset: undefined, from: undefined, to: undefined})
      void saveDefaultPeriod(period)
    },
    setCustom: (custom: DateRange) => setParams({period: 'custom', from: custom.from, to: custom.to, offset: undefined}),
    step: (by: number) => setParams({offset: state.offset + by === 0 ? undefined : String(state.offset + by)}),
    setCurrency: (currency: string) => setParams({currency}),
    /** In the address and remembered on this device (`analyticsScope`). */
    setScope: (next: Scope) => {
      setParams({scope: scopeToParam(next)})
      void setScopePref(scopeToPref(next))
    },
  }
}

export type Report = NonNullable<ReturnType<typeof useReport>>
