import {NAV_ITEM_IDS, type NavItemId} from '@splito/sync'

/** The route each item opens. */
export const NAV_ITEM_ROUTE = {
  people: 'People',
  groups: 'Groups',
  analytics: 'Analytics',
  activity: 'Activity',
  settings: 'Settings',
} as const satisfies Record<NavItemId, string>

export type NavItemRoute = (typeof NAV_ITEM_ROUTE)[keyof typeof NAV_ITEM_ROUTE]

/** Each item's path, for web links. */
export const NAV_ITEM_HREF = {
  people: '/people',
  groups: '/groups',
  analytics: '/analytics',
  activity: '/activity',
  settings: '/settings',
} as const satisfies Record<NavItemId, string>

/**
 * The one list of every item (ARCHITECTURE 26.3, § 3): People, Groups, Analytics, Activity, Settings. No Home (owner
 * 198) and no Ask Splito (owner 200: it lives in the Search & Ask drawer). The bottom bar, sidebar and drawer show
 * it ordered by the `tabs` preference (`splitNavigationItems`).
 */
export function navigationItems(): NavItemId[] {
  return [...NAV_ITEM_IDS]
}

/**
 * What Settings > Navigation sets for every width (ARCHITECTURE 26.3): the
 * items that are on, in the user's order, then the ones that are off in the
 * shared order. The sidebar and rail list `on` then `off` (no "More", owner 155).
 */
export function splitNavigationItems(tabs: readonly NavItemId[]): {on: NavItemId[]; off: NavItemId[]} {
  return {on: [...tabs], off: NAV_ITEM_IDS.filter(id => !tabs.includes(id))}
}

/** The bottom bar: the `tabs` preference as saved (a saved Home or Ask is dropped when it is read, `readRaw`). */
export function bottomBarItems(tabs: readonly NavItemId[]): NavItemId[] {
  return [...tabs]
}
