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
    return {name: 'People', params: undefined}
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
  /* A main screen pushed from a link shows Back (owner 179): it is a page, not the tab. */
  if (isPushedCopy(currentRoute.params)) return false
  return (
    isTab(currentRoute.name, 'People') ||
    isTab(currentRoute.name, 'Groups') ||
    isTab(currentRoute.name, 'Analytics') ||
    isTab(currentRoute.name, 'Activity')
  )
}

/**
 * Whether a main screen was opened as a pushed copy with Back (owner 179) rather than as its own tab: it carries
 * `back: '1'` (never in the address, `buildPath` leaves it out). The tab screens read this for their header and FAB.
 */
export function isPushedCopy(params: object | undefined): boolean {
  return (params as {back?: string} | undefined)?.back === '1'
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
  const activeTabRoute = state.routes[state.index || 0].name
  /* A pushed copy is not the tab's root: pressing the tab itself still brings up the plain tab. */
  if (isTab(currentRoute.name, tab) && !isPushedCopy(currentRoute.params)) {
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

/* Exhaustive on purpose: a tab added to TabParams (People comes with decision 153) fails to compile here until it is listed. */
const TAB_ROUTES: readonly string[] = Object.keys({People: 1, Groups: 1, Analytics: 1, Activity: 1} satisfies Record<keyof TabParams, 1>)

/**
 * The main screens that can open as a pushed copy with Back (owner 179), and the root-stack route a phone pushes
 * for each (the tabs live inside `Tabs`, so a pushed copy needs a route of its own; web pushes the tab's own route,
 * its flat stack has every route at the top). A screen joins when its header reads `useIsPushedCopy`: Activity
 * first (F-259); Home, People, Groups and Analytics follow with their screens.
 */
const PUSHED_COPY: Readonly<Record<string, string>> = {Activity: 'ActivityPage'}

/**
 * How a pressed link reaches its route. A main screen opened from a link (a "See all", an Overview card, a search or
 * Ask result, a notification, a deep link) is pushed as a page with Back (owner 179, `kind: 'push'`, the params
 * carry `back: '1'`); where its screen cannot yet show Back, a tab is not on the stack the press happens in, so a
 * stack push never finds it ("The action 'PUSH' ... was not handled by any navigator"): on native the stack pops
 * back to `Tabs` and selects the tab with its params (the shape the drawer uses), on web the tab is a route of its
 * own and is navigated to. Every other route is pushed (Bluesky's behaviour): `null`.
 */
export function tabLink(
  routeName: string,
  params: object | undefined,
  isWeb: boolean,
):
  | {kind: 'push' | 'popTo' | 'navigate'; name: string; params: object | undefined}
  | null {
  if (!TAB_ROUTES.includes(routeName)) return null
  const pushed = PUSHED_COPY[routeName]
  if (pushed) return {kind: 'push', name: isWeb ? routeName : pushed, params: {...params, back: '1'}}
  return isWeb
    ? {kind: 'navigate', name: routeName, params}
    : {kind: 'popTo', name: 'Tabs', params: {screen: routeName, params}}
}
