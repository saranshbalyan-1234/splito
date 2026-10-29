import {type NavItemId, PREFS, type TabId} from '@splito/sync'

import {bottomBarItems} from '#/lib/routes/navigationItems'
import {type TabParams} from '#/lib/routes/types'
import {usePref} from '#/data/hooks'
import {ROUTE_PATHS} from '#/routes'

/** Each tab's route name. */
export const TAB_ROUTE = {
  people: 'People',
  groups: 'Groups',
  analytics: 'Analytics',
  activity: 'Activity',
} as const satisfies Record<TabId, keyof TabParams>

/** The tab routes, in display order (native nests them under `Tabs`). */
export const TAB_NAMES = Object.values(TAB_ROUTE)

/** Each tab's path. */
export function tabHref(tab: TabId) {
  return ROUTE_PATHS[TAB_ROUTE[tab]]
}

/**
 * The items that are on, in the user's order (the `tabs` preference,
 * Settings > Navigation): the phone bottom bar, and the desktop / rail
 * sidebar too. Items that are off sit in the drawer and under the sidebar's
 * "More" (ARCHITECTURE 26.3).
 */
export function useTabs(): NavItemId[] {
  const [tabs] = usePref('tabs')
  return bottomBarItems(tabs ?? PREFS.tabs.default)
}
