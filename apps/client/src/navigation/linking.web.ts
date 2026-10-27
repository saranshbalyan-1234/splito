import {getStateFromPath, type LinkingOptions} from '@react-navigation/native'

import {backChain} from '#/navigation/goBack'
import {tabHref} from '#/lib/routes/tabs'
import {type FlatNavigatorParams} from '#/lib/routes/types'
import {redirectOldPath, ROUTE_PATHS} from '#/routes'
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
 * top-level route. A deep link or refresh has no history, so the state puts
 * the page's parents under it (`backChain`: Settle -> Group -> Groups -> People),
 * which makes Back go up instead of leaving; People under Add expense is what
 * its dialog dims.
 */
export const linking: LinkingOptions<FlatNavigatorParams> = {
  prefixes: ['https://splito.app'],
  getStateFromPath: (path, options) => {
    const state = getStateFromPath(redirectOldPath(path), options)
    const leaf = state?.routes.at(-1)
    if (!state || !leaf) return state
    return {...state, routes: backChain(leaf) as typeof state.routes}
  },
  config: {
    initialRouteName: 'People',
    screens: Object.fromEntries(
      Object.entries(ROUTE_PATHS).map(([name, path]) => [name, path.slice(1)]),
    ),
  },
}
