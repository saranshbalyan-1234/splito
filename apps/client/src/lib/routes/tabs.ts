import {PREFS, type TabId} from '@splito/sync'

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
 * The tabs the bottom bar and sidebar show, in the user's order (the `tabs`
 * preference). Hidden tabs keep their routes, so links to them still work;
 * Profile and Settings open from the avatar's drawer on every tab.
 */
export function useTabs(): TabId[] {
  const [tabs] = usePref('tabs')
  return tabs ?? PREFS.tabs.default
}
