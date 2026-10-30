import {createNavigationContainerRef} from '@react-navigation/native'

import {type RootStackParams} from '#/lib/routes/types'
import {IS_WEB} from '#/env'

/** The root navigation container, for code that lives above or beside it (feedback, the dev tour, a store swap). */
export const navigationRef = createNavigationContainerRef<RootStackParams>()

/**
 * Back to the first tab with nothing above it: the app's own state (pages, sheets'
 * routes) belongs to the store that just went away. Web's navigator is flat; native's
 * has the tabs as one route.
 */
export function resetToRoot() {
  if (!navigationRef.isReady()) return
  navigationRef.resetRoot(
    IS_WEB
      ? {index: 0, routes: [{name: 'Home'}]}
      : {index: 0, routes: [{name: 'Tabs', state: {index: 0, routes: [{name: 'Home'}]}}]},
  )
}
