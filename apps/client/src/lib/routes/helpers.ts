// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/lib/routes/helpers.ts
import {type NavigationProp} from '@react-navigation/native'

import {type RouteParams, type State} from './types'

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
  return (
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
