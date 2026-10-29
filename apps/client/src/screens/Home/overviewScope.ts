import {type SummaryScope} from '@splito/domain'

import {oneOf, type Params, param} from '#/lib/links/listState'

export const OVERVIEW_SCOPES = ['all', 'groups', 'direct'] as const satisfies readonly SummaryScope[]

/** `/?overview=groups`: a param that is present wins over the saved preference (F-1413). */
export function readOverviewScope(params: Params): SummaryScope | undefined {
  return oneOf(params?.overview, OVERVIEW_SCOPES)
}

/** What a choice writes to the address: left out only when it is the stock one and so is the saved preference. */
export function overviewParam(scope: SummaryScope, saved: SummaryScope): string | undefined {
  return param(scope, 'all', saved)
}

/**
 * The same choice as Analytics' scope (`scope=` of its address, owner 176): everything, non-group only, or all groups.
 * Always written, All too: left out, Analytics would fall back to the scope it saved last and not show what All counted.
 */
export function analyticsScopeParam(scope: SummaryScope): string {
  return scope === 'groups' ? '0:all' : scope === 'direct' ? '1:' : '1:all'
}

/** `/analytics` for a currency (or none) carrying the Overview's scope. */
export function analyticsHref(scope: SummaryScope, currency?: string): string {
  const q = new URLSearchParams()
  if (currency) q.set('currency', currency)
  q.set('scope', analyticsScopeParam(scope))
  return `/analytics?${q}`
}
