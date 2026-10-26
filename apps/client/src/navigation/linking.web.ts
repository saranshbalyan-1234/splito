import {getStateFromPath, type LinkingOptions} from '@react-navigation/native'

import {type FlatNavigatorParams} from '#/lib/routes/types'
import {redirectOldPath, ROUTE_PATHS} from '#/routes'

/*
 * Web uses one flat stack (see `FlatNavigator`), so every path maps to a
 * top-level route. `initialRouteName` keeps People under a deep-linked page,
 * which is what Add expense's dialog dims when /expense/new is opened directly.
 */
export const linking: LinkingOptions<FlatNavigatorParams> = {
  prefixes: ['https://splito.app'],
  getStateFromPath: (path, options) =>
    getStateFromPath(redirectOldPath(path), options),
  config: {
    initialRouteName: 'People',
    screens: Object.fromEntries(
      Object.entries(ROUTE_PATHS).map(([name, path]) => [name, path.slice(1)]),
    ),
  },
}
