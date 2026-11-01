import {type TabId} from '@splito/sync'

import {usePref} from '#/data/hooks'

/**
 * Whether `tab` is the tab the app opens on (Settings > Navigation "Open on", People by default; owner 218). Undefined
 * while the preferences load. `components/` may not import `data/`, so they come here.
 */
export function useIsStartTab(tab: TabId): boolean | undefined {
  const [start] = usePref('startTab')
  return start === undefined ? undefined : start === tab
}
