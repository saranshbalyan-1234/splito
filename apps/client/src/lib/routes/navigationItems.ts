import {NAV_ITEM_IDS, type NavItemId} from '@splito/sync'

/**
 * Ask Splito's chat is built (F-2301), so its item shows in the sidebar, the
 * drawer, the bottom bar and Settings > Navigation (ARCHITECTURE 26.3, 26.19).
 */
export const IS_ASK_SPLITO_AVAILABLE = true

/** The route each item opens; Ask Splito opens the Search & Ask drawer instead. */
export const NAV_ITEM_ROUTE = {
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
  people: '/',
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
 * The one list the desktop / rail sidebar and the phone drawer both render
 * (ARCHITECTURE 26.3, § 3): Home, Groups, Analytics, Ask Splito, Activity,
 * Settings. It never changes while data loads; only badges do.
 */
export function navigationItems(
  isAskAvailable: boolean = IS_ASK_SPLITO_AVAILABLE,
): NavItemId[] {
  return NAV_ITEM_IDS.filter(id => isNavItemAvailable(id, isAskAvailable))
}

/** The bottom bar: the `tabs` preference, less any item not built yet. */
export function bottomBarItems(
  tabs: readonly NavItemId[],
  isAskAvailable: boolean = IS_ASK_SPLITO_AVAILABLE,
): NavItemId[] {
  return tabs.filter(id => isNavItemAvailable(id, isAskAvailable))
}
