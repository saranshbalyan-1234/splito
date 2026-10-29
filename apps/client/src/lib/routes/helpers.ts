// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/lib/routes/helpers.ts
import {type NavigationProp} from '@react-navigation/native'

import {type RouteParams, type State, type TabParams} from './types'

export function getRootNavigation<T extends {}>(
  nav: NavigationProp<T>,
): NavigationProp<T> {
  while (nav.getParent()) {
    nav = nav.getParent()
  }
  return nav
}

export function getCurrentRoute(state?: State) {
  if (!state) {
    return {name: 'Home', params: undefined}
  }

  /*
   * Nested navigator states may still be partial ("stale") right after a cold
   * start from a deep link, in which case `index` is not set yet. React
   * Navigation focuses the last route when it rehydrates such a state, so
   * mirror that here instead of stopping the descent early and misreporting
   * the tab root as the current route (which e.g. re-enabled the drawer
   * swipe gesture on top of a deep-linked screen).
   */
  let node = state.routes[pageIndex(state.routes, state.index || 0)]!
  while (node.state?.routes) {
    const routes = node.state.routes
    node = routes[pageIndex(routes, node.state.index ?? routes.length - 1)]!
  }
  return node
}

/**
 * The index of the route at `index`, or of the page under it when that is a `Sheet` marker (F-241): a sheet
 * open over a page does not make it a different page, so the sidebar, the drawer and the swipe rule keep
 * reading the page.
 */
function pageIndex(routes: readonly {name: string}[], index: number): number {
  let i = index
  while (i > 0 && routes[i]!.name === 'Sheet') i--
  return i
}

export function isStateAtTabRoot(state: State | undefined) {
  if (!state) {
    // NOTE
    // if state is not defined it's because init is occurring
    // and therefore we can safely assume we're at root
    // -prf
    return true
  }
  const currentRoute = getCurrentRoute(state)
  return (
    isTab(currentRoute.name, 'Home') ||
    isTab(currentRoute.name, 'People') ||
    isTab(currentRoute.name, 'Groups') ||
    isTab(currentRoute.name, 'Analytics') ||
    isTab(currentRoute.name, 'Activity')
  )
}

export function isTab(current: string, route: string) {
  // NOTE
  // our tab routes can be variously referenced by 3 different names
  // this helper deals with that weirdness
  // -prf
  return (
    current === route ||
    current === `${route}Tab` ||
    current === `${route}Inner`
  )
}

export enum TabState {
  InsideAtRoot,
  Inside,
  Outside,
}

export function getTabState(state: State | undefined, tab: string): TabState {
  if (!state) {
    return TabState.Outside
  }

  const currentRoute = getCurrentRoute(state)
  /* A pushed copy of the tab is never "at the tab root": pressing the tab is not a no-op there (owner 179). */
  if (pushedCopyOf(state, tab)) return TabState.Outside
  const activeTabRoute = state.routes[state.index || 0].name
  if (isTab(currentRoute.name, tab)) {
    return TabState.InsideAtRoot
  } else if (isTab(activeTabRoute, tab)) {
    return TabState.Inside
  }
  return TabState.Outside
}

type ExistingState = {
  name: string
  params?: RouteParams
}
export function buildStateObject(
  stack: string,
  route: string,
  params: RouteParams,
  state: ExistingState[] = [],
) {
  if (stack === 'Flat') {
    return {
      index: 0,
      routes: [{name: route, params}],
    }
  }
  /*
   * Set `index` explicitly so consumers of this state (e.g. getCurrentRoute)
   * can tell which route is focused before React Navigation has rehydrated
   * the nested navigator state.
   */
  const routes = [...state, {name: route, params}]
  return {
    index: 0,
    routes: [
      {
        name: stack,
        state: {
          index: routes.length - 1,
          routes,
        },
      },
    ],
  }
}

/* Exhaustive on purpose: a tab added to TabParams (People came with decision 153) fails to compile here until it is listed. */
const TAB_ROUTES: readonly string[] = Object.keys({Home: 1, People: 1, Groups: 1, Analytics: 1, Activity: 1} satisfies Record<keyof TabParams, 1>)

/**
 * When the focused route is a pushed copy of tab `tab` (owner 179), the params the plain tab has: the copy's own
 * without the `pushed` marker. Otherwise null. Pressing the tab replaces the copy with the plain route; popping would
 * land on the page below it, not on the tab that was pressed.
 */
export function pushedCopyOf(state: State | undefined, tab: string): {params: object | undefined} | null {
  if (!state) return null
  const route = getCurrentRoute(state)
  if (!isPushedTabRoute(route) || !isTab(route.name.startsWith(PUSHED_PREFIX) ? route.name.slice(PUSHED_PREFIX.length) : route.name, tab)) return null
  const {[PUSHED_PARAM]: _pushed, ...rest} = (route.params ?? {}) as Record<string, unknown>
  return {params: Object.keys(rest).length > 0 ? rest : undefined}
}

/** The route param that marks a tab screen pushed as a copy on web (never written to the address bar). */
export const PUSHED_PARAM = 'pushed'

/** Native pushes the copy under its own root-stack name (`PushedGroups`), since the tabs live in the nested `Tabs` screen. */
export const PUSHED_PREFIX = 'Pushed'

/** Whether a route is a pushed copy of a tab screen (owner 179). */
export function isPushedTabRoute(route: {name: string; params?: object | undefined}): boolean {
  return route.name.startsWith(PUSHED_PREFIX) || (route.params as Record<string, unknown> | undefined)?.[PUSHED_PARAM] === '1'
}

/**
 * How a pressed link reaches its route (owner 179, § 26.3). A main screen (Home, People, Groups, Analytics,
 * Activity) opened from a link, rather than from its own tab or sidebar item, is a pushed page: a stack copy of the
 * screen carrying its params, with Back in the header (returning to where the link was) and no FAB; the tab itself
 * still gives the plain tab screen with the avatar. On web the tab routes live in the one flat stack, so the copy is
 * the same route pushed with a `pushed` marker (kept out of the address); on native the tabs are nested in `Tabs`,
 * so the root stack holds `Pushed<Tab>` twins of them. Every other route is pushed as it is (Bluesky's behaviour):
 * `null`. Nav items use `navigationAction="navigate"` and never come through here.
 */
export function tabLink(
  routeName: string,
  params: object | undefined,
  isWeb: boolean,
): {kind: 'push'; name: string; params: object | undefined} | null {
  if (!TAB_ROUTES.includes(routeName)) return null
  return isWeb
    ? {kind: 'push', name: routeName, params: {...params, [PUSHED_PARAM]: '1'}}
    : {kind: 'push', name: `${PUSHED_PREFIX}${routeName}`, params}
}
