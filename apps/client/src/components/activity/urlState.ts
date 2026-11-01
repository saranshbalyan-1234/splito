import {ACTIVITY_TYPE_IDS, type ActivityTypeId} from '@splito/sync'

import {type LocalDate} from '@splito/domain'

import {oneOf, type Params, param} from '#/lib/links/listState'
import {isEverything, type Scope, scopeFromParam, scopeToParam} from '#/lib/scope'
import {type ActivityTab} from './feed'

export const ACTIVITY_TABS = ['all', 'me', 'others'] as const satisfies readonly ActivityTab[]

/**
 * `?type=transactions` is expenses and payments together (the owner's word for what every "See all" of Recent
 * transactions means); the other values name one type each (`type=comments,groups`); `type=all` clears the saved choice.
 */
function parseTypes(value: string | undefined): ActivityTypeId[] | undefined {
  if (value === undefined) return undefined
  if (value === 'all') return []
  const out = new Set<ActivityTypeId>()
  for (const token of value.split(',')) {
    if (token === 'transactions') {
      out.add('expenses')
      out.add('payments')
    } else if ((ACTIVITY_TYPE_IDS as readonly string[]).includes(token)) out.add(token as ActivityTypeId)
  }
  return out.size > 0 ? ACTIVITY_TYPE_IDS.filter(id => out.has(id)) : undefined
}

/** The type list as the address writes it: expenses with payments read as `transactions`; empty is `all`. */
export function typesToParam(types: readonly ActivityTypeId[]): string {
  if (types.length === 0) return 'all'
  const rest: string[] = types.filter(id => id !== 'expenses' && id !== 'payments')
  const both = types.includes('expenses') && types.includes('payments')
  const singles = both ? [] : types.filter(id => id === 'expenses' || id === 'payments')
  return [...(both ? ['transactions'] : []), ...singles, ...rest].join(',')
}

const DAY = /^\d{4}-\d{2}-\d{2}$/
const CURRENCY = /^[A-Z]{3}$/
/* A category id is a built-in name or a minted UUID: word characters and dashes, short. */
const CATEGORY = /^[\w-]{1,64}$/

/**
 * The address keys of the record filters (owner 226). The dates are `since` / `until`, not `from` / `to`: on a pushed copy
 * of a main screen `from` already names the tab it was opened from (owners 179, 184), so a date there would be overwritten.
 */
export const RECORD_PARAMS = ['since', 'until', 'currency', 'category', 'scope'] as const

/** The record filters an address sets (a bad value is no filter). A scope of Everything is no scope: it narrows nothing. */
export type RecordParams = {from?: LocalDate; to?: LocalDate; currency?: string; category?: string; scope?: Scope}

/** What the address sets of Activity: its tab (`/activity/me`), types, one group or friend and the record filters (`?type=expenses&since=2026-01-01&until=2026-03-31&currency=EUR`). */
export function readActivityParams(params: Params): {tab?: ActivityTab; types?: ActivityTypeId[]; group?: string; person?: string} & RecordParams {
  const tab = oneOf(params?.tab, ACTIVITY_TABS)
  const types = parseTypes(params?.type)
  const scope = params?.scope ? scopeFromParam(params.scope) : undefined
  /* A day or a range the calendar has no room for (a swapped pair) is no date filter at all, as Analytics' custom range. */
  const since = params?.since && DAY.test(params.since) ? params.since : undefined
  const until = params?.until && DAY.test(params.until) ? params.until : undefined
  const isSwapped = !!since && !!until && since > until
  return {
    ...(tab && {tab}),
    ...(types && {types}),
    ...(params?.group && {group: params.group}),
    ...(params?.person && {person: params.person}),
    ...(since && !isSwapped && {from: since}),
    ...(until && !isSwapped && {to: until}),
    ...(params?.currency && CURRENCY.test(params.currency) && {currency: params.currency}),
    ...(params?.category && CATEGORY.test(params.category) && {category: params.category}),
    ...(scope && !isEverything(scope) && {scope}),
  }
}

/** The record filters as address params (the inverse of `readActivityParams`): also a stable key for a list built from them. */
export function recordToParams(r: RecordParams): Record<(typeof RECORD_PARAMS)[number], string | undefined> {
  return {since: r.from, until: r.to, currency: r.currency, category: r.category, scope: r.scope ? scopeToParam(r.scope) : undefined}
}

/** The params a tap on a tab or an Apply writes, by the one list-state rule (`param`): stock values drop out only when the saved choice is stock too. */
export function activityParams(
  f: {tab: ActivityTab; types: readonly ActivityTypeId[]},
  saved: {tab: ActivityTab; types: readonly ActivityTypeId[]},
): Record<string, string | undefined> {
  return {
    tab: param(f.tab, 'all', saved.tab),
    type: param(f.types.length === 0 ? 'all' : typesToParam(f.types), 'all', saved.types.length === 0 ? 'all' : typesToParam(saved.types)),
  }
}
