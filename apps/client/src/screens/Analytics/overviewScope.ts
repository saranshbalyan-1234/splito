import {type SummaryScope} from '@splito/domain'

import {oneOf, type Params} from '#/lib/links/listState'
import {type Scope, scopeFromParam} from '#/lib/scope'

export const OVERVIEW_SCOPES = ['all', 'groups', 'direct'] as const satisfies readonly SummaryScope[]

/**
 * An old `?overview=groups|direct|all` link (owner 176's Overview chips, gone with owner 219: the Overview now follows
 * Analytics' one scope). Read only so such links still land on the same balances, as Analytics' scope.
 */
export function overviewScopeParam(params: Params): Scope | undefined {
  const old = oneOf(params?.overview, OVERVIEW_SCOPES)
  return old ? scopeFromParam(analyticsScopeParam(old)) : undefined
}

/**
 * A balance scope as Analytics' scope (`scope=` of its address): everything, non-group only, or all groups. Always
 * written, All too: left out, Analytics would fall back to the scope it saved last.
 */
export function analyticsScopeParam(scope: SummaryScope): string {
  return scope === 'groups' ? '0:all' : scope === 'direct' ? '1:' : '1:all'
}

/** `/analytics` for a currency carrying a balance scope: what an Overview card on People or Groups opens (owner 219). */
export function analyticsHref(scope: SummaryScope, currency?: string): string {
  const q = new URLSearchParams()
  if (currency) q.set('currency', currency)
  q.set('scope', analyticsScopeParam(scope))
  return `/analytics?${q}`
}
