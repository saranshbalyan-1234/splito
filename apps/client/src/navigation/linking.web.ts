import {type LinkingOptions} from '@react-navigation/native'

import {tabHref} from '#/lib/routes/tabs'
import {type FlatNavigatorParams} from '#/lib/routes/types'
import {ROUTE_PATHS} from '#/routes'
import {device} from '#/storage'

/*
 * The Home tab preference (Settings > Defaults): a bare visit to "/" opens
 * that tab. Runs once, before the navigator reads the URL; links to "/" from
 * inside the app (the logo) still open People.
 */
const homeTab = device.get(['homeTab'])
if (homeTab && homeTab !== 'people' && window.location.pathname === '/') {
  window.history.replaceState(
    window.history.state,
    '',
    tabHref(homeTab) + window.location.search,
  )
}

/*
 * Web uses one flat stack (see `FlatNavigator`), so every path maps to a
 * top-level route. `initialRouteName` keeps People under a deep-linked page,
 * which is what Add expense's dialog dims when /expense/new is opened directly.
 */
export const linking: LinkingOptions<FlatNavigatorParams> = {
  prefixes: ['https://splito.app'],
  config: {
    initialRouteName: 'People',
    screens: {
      ...Object.fromEntries(
        Object.entries(ROUTE_PATHS).map(([name, path]) => [name, path.slice(1)]),
      ),
      // Activity became Notifications; old links still land.
      Notifications: {path: 'notifications', alias: ['activity']},
    },
  },
}
