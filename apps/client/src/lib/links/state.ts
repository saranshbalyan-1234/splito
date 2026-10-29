import {backChain} from '#/navigation/goBack'
import {type SheetMarker} from '#/lib/routes/types'
import {TAB_NAMES} from '#/lib/routes/tabs'
import {buildPath, type LinkTarget} from './resolve'

/** Route params React Navigation takes: strings only, nothing undefined. */
function routeParams(params: Record<string, string>) {
  return Object.keys(params).length > 0 ? params : undefined
}

/** The markers that open `target.sheets`, one per level, so Back closes the top sheet only. */
export function sheetRoutes(target: LinkTarget) {
  return target.sheets.map((_, i) => ({
    name: 'Sheet' as const,
    params: {
      page: target.name,
      pageParams: target.params,
      sheets: target.sheets.slice(0, i + 1),
      ...(i === target.sheets.length - 1 && Object.keys(target.query).length > 0 ? {query: target.query} : {}),
    } satisfies SheetMarker,
  }))
}

/**
 * Web's state for a link: its parents under the page (Back goes up, not out), then the page, then its sheets.
 * The flat stack has every route at the top level.
 */
export function webState(target: LinkTarget) {
  const page = {name: target.name, params: routeParams(target.params)}
  const routes = [...backChain(page), ...sheetRoutes(target)]
  return {index: routes.length - 1, routes}
}

/** Native's state: the tabs are one route, every other page is pushed above them; sheets wait in `queueSheets`. */
export function nativeState(target: LinkTarget) {
  const page = {name: target.name, params: routeParams(target.params)}
  if ((TAB_NAMES as readonly string[]).includes(target.name)) {
    return {routes: [{name: 'Tabs', state: {routes: [page]}}]}
  }
  return {routes: [{name: 'Tabs'}, page]}
}

/** The address bar's text for a navigation state's focused route: a page, or the page and sheet a marker names. */
export function pathForRoute(route: {name: string; params?: object}): string {
  const params = (route.params ?? {}) as Record<string, unknown>
  if (route.name === 'Sheet') {
    const m = params as unknown as SheetMarker
    return buildPath({name: m.page as LinkTarget['name'], params: stringsOf(m.pageParams), sheets: m.sheets, query: m.query ?? {}})
  }
  return buildPath({name: route.name as LinkTarget['name'], params: stringsOf(params), sheets: [], query: {}})
}

function stringsOf(params: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(params).flatMap(([k, v]) => (typeof v === 'string' ? [[k, v]] : typeof v === 'number' ? [[k, String(v)]] : [])),
  )
}
