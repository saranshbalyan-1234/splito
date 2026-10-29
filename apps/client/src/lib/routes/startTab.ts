import {type TabId} from '@splito/sync'

const TAB_IDS: readonly string[] = ['home', 'people', 'groups', 'analytics', 'activity']

/**
 * The tab the app opens on, from the device mirror's `startTab`, else the old `homeTab` key of a build before F-256
 * (its 'people' meant Home), else Home. Pure, so a test pins the fallback.
 */
export function resolveStartTab(start: string | undefined, old: string | undefined): TabId {
  if (start && TAB_IDS.includes(start)) return start as TabId
  return old && old !== 'people' && TAB_IDS.includes(old) ? (old as TabId) : 'home'
}
