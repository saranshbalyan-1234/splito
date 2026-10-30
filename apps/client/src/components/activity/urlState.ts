import {ACTIVITY_TYPE_IDS, type ActivityTypeId} from '@splito/sync'

import {oneOf, type Params, param} from '#/lib/links/listState'
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

/** What the address sets of Activity: its tab (`/activity/me`), types and one group (`/activity?type=transactions&group=<id>`). */
export function readActivityParams(params: Params): {tab?: ActivityTab; types?: ActivityTypeId[]; group?: string; person?: string} {
  const tab = oneOf(params?.tab, ACTIVITY_TABS)
  const types = parseTypes(params?.type)
  return {...(tab && {tab}), ...(types && {types}), ...(params?.group && {group: params.group}), ...(params?.person && {person: params.person})}
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
