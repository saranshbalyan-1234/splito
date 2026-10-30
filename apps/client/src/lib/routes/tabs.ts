import {type NavItemId, PREFS, type TabId} from '@splito/sync'

import {bottomBarItems} from '#/lib/routes/navigationItems'
import {type TabParams} from '#/lib/routes/types'
import {usePref} from '#/data/hooks'
import {resolveStartTab} from '#/lib/routes/startTab'
import {device} from '#/storage'
import {ROUTE_PATHS} from '#/routes'

/** Each tab's route name. */
export const TAB_ROUTE = {
  home: 'Home',
  people: 'People',
  groups: 'Groups',
  analytics: 'Analytics',
  activity: 'Activity',
} as const satisfies Record<TabId, keyof TabParams>

/** The tab routes, in display order (native nests them under `Tabs`). */
export const TAB_NAMES = Object.values(TAB_ROUTE)

/** The tab the app opens on, read synchronously at launch from the device mirror (with the pre-F-256 `homeTab` key as a fallback). */
export function bootStartTab(): TabId {
  return resolveStartTab(device.get(['startTab']), device.get(['homeTab']))
}

/** Each tab's path. */
export function tabHref(tab: TabId) {
  return ROUTE_PATHS[TAB_ROUTE[tab]]
}

/**
 * The items that are on, in the user's order (the `tabs` preference,
 * Settings > Navigation): the phone bottom bar. Off items sit in the phone
 * drawer; the desktop / rail sidebar lists every item, with no "More" (owner
 * 155, ARCHITECTURE 26.3).
 */
export function useTabs(): NavItemId[] {
  const [tabs] = usePref('tabs')
  return bottomBarItems(tabs ?? PREFS.tabs.default)
}
