import {type LinkingOptions} from '@react-navigation/native'

import {type RootStackParams, type TabParams} from '#/lib/routes/types'
import {ROUTE_PATHS, type RouteName} from '#/routes'

const TABS: RouteName[] = [
  'People',
  'Groups',
  'Analytics',
] satisfies (keyof TabParams)[]

function pathsFor(names: RouteName[]) {
  return Object.fromEntries(names.map(name => [name, ROUTE_PATHS[name].slice(1)]))
}

/*
 * Native nests the tab routes in `Tabs`. `initialRouteName` puts the tabs
 * under a deep-linked screen, so its back button returns into the app.
 */
export const linking: LinkingOptions<RootStackParams> = {
  prefixes: ['splito://', 'https://splito.app'],
  config: {
    initialRouteName: 'Tabs',
    screens: {
      Tabs: {screens: pathsFor(TABS)},
      ...pathsFor(
        (Object.keys(ROUTE_PATHS) as RouteName[]).filter(
          name => !TABS.includes(name),
        ),
      ),
      // Activity became Notifications; old links still land.
      Notifications: {path: 'notifications', alias: ['activity']},
    },
  },
}
