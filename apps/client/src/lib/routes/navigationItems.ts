import {NAV_ITEM_IDS, type NavItemId} from '@splito/sync'

/**
 * Ask Splito's chat is built (F-2301), so its item shows in the sidebar, the
 * drawer, the bottom bar and Settings > Navigation (ARCHITECTURE 26.3, 26.19).
 */
export const IS_ASK_SPLITO_AVAILABLE = true

/** The route each item opens; Ask Splito opens the Search & Ask drawer instead. */
export const NAV_ITEM_ROUTE = {
  home: 'Home',
  people: 'People',
  groups: 'Groups',
  analytics: 'Analytics',
  ask: undefined,
  activity: 'Activity',
  settings: 'Settings',
} as const satisfies Record<NavItemId, string | undefined>

export type NavItemRoute = NonNullable<
  (typeof NAV_ITEM_ROUTE)[keyof typeof NAV_ITEM_ROUTE]
>

/** Each item's path, for web links (Ask Splito has none). */
export const NAV_ITEM_HREF = {
  home: '/',
  people: '/people',
  groups: '/groups',
  analytics: '/analytics',
  ask: undefined,
  activity: '/activity',
  settings: '/settings',
} as const satisfies Record<NavItemId, string | undefined>

export function isNavItemAvailable(
  id: NavItemId,
  isAskAvailable: boolean = IS_ASK_SPLITO_AVAILABLE,
) {
  return id !== 'ask' || isAskAvailable
}

/**
 * The one list of every item (ARCHITECTURE 26.3, § 3): Home, People,
 * Groups, Analytics, Ask Splito, Activity, Settings. The bottom bar, sidebar and
 * drawer show it ordered by the `tabs` preference (`splitNavigationItems`).
 */
export function navigationItems(
  isAskAvailable: boolean = IS_ASK_SPLITO_AVAILABLE,
): NavItemId[] {
  return NAV_ITEM_IDS.filter(id => isNavItemAvailable(id, isAskAvailable))
}

/**
 * What Settings > Navigation sets for every width (ARCHITECTURE 26.3): the
 * items that are on, in the user's order, then the ones that are off in the
 * shared order. The sidebar and rail list `on` then `off` (no "More", owner 155); the
 * drawer lists both, in this order.
 */
export function splitNavigationItems(
  tabs: readonly NavItemId[],
  isAskAvailable: boolean = IS_ASK_SPLITO_AVAILABLE,
): {on: NavItemId[]; off: NavItemId[]} {
  const on = bottomBarItems(tabs, isAskAvailable)
  return {on, off: navigationItems(isAskAvailable).filter(id => !on.includes(id))}
}

/** The bottom bar: the `tabs` preference, less any item not built yet. */
export function bottomBarItems(
  tabs: readonly NavItemId[],
  isAskAvailable: boolean = IS_ASK_SPLITO_AVAILABLE,
): NavItemId[] {
  return tabs.filter(id => isNavItemAvailable(id, isAskAvailable))
}
