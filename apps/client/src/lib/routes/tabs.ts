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

/** Each tab's path. */
export function tabHref(tab: TabId) {
  return ROUTE_PATHS[TAB_ROUTE[tab]]
}

/**
 * The phone bottom bar's items, in the user's order (the `tabs` preference,
 * Settings > Navigation). Items not in the bar stay in the drawer, and the
 * sidebar always shows the full list (ARCHITECTURE 26.3).
 */
export function useTabs(): NavItemId[] {
  const [tabs] = usePref('tabs')
  return bottomBarItems(tabs ?? PREFS.tabs.default)
}
