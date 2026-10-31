import {START_TAB_IDS, type TabId} from '@splito/sync'

import {type TabParams} from '#/lib/routes/types'

/** Each tab's route name. */
export const TAB_ROUTE = {
  people: 'People',
  groups: 'Groups',
  analytics: 'Analytics',
  activity: 'Activity',
  settings: 'Settings',
} as const satisfies Record<TabId, keyof TabParams>

/** What the app can open on: Settings is a tab (owner 206) but not a place to start. */
const TAB_IDS: readonly string[] = START_TAB_IDS

/**
 * The tab the app opens on, from the device mirror's `startTab`, else the old `homeTab` key of a build before F-256,
 * else People (owner 198: there is no Home; a saved 'home' is People). Pure, so a test pins the fallback.
 */
export function resolveStartTab(start: string | undefined, old: string | undefined): TabId {
  // A mirror that holds any value is the current word: a stale 'home' there is People, never the older key's tab.
  if (start !== undefined) return TAB_IDS.includes(start) ? (start as TabId) : 'people'
  return old && TAB_IDS.includes(old) ? (old as TabId) : 'people'
}

/*
 * The route every "Home" fallback now means (owner 198): the start tab. Set at launch from the device mirror and
 * whenever the preference changes (`bootStartTab`, `PrefsMirror`); People until then. A tab change applies to
 * Back's fallbacks at once, to the launch tab on the next start.
 */
let startTab: TabId = 'people'
export function setStartTab(tab: TabId) {
  startTab = tab
}
/** The start tab's route name: where Back, the logo, an unknown link and sign-in return go. */
export function startPage(): (typeof TAB_ROUTE)[TabId] {
  return TAB_ROUTE[startTab]
}
