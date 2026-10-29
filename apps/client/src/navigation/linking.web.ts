import {findFocusedRoute, type LinkingOptions} from '@react-navigation/native'

import {ownLinkHost} from '#/lib/links/hosts'
import {captureInitialPath} from '#/lib/links/incoming'
import {resolveLink} from '#/lib/links/resolve'
import {pathForRoute, webState} from '#/lib/links/state'
import {tabHref} from '#/lib/routes/tabs'
import {type FlatNavigatorParams} from '#/lib/routes/types'
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
 * Web uses one flat stack (see `FlatNavigator`), so every path maps to a top-level route. The one resolver reads
 * the URL (F-241, F-254): the page, its tab and list state, and the sheets or pickers over it, each a `Sheet`
 * marker route so the browser's Back closes the top one. A deep link or refresh has no history, so the state
 * puts the page's parents under it (`backChain`: Settle -> Group -> Groups -> People). Unknown paths open Home
 * and the address bar is rewritten to "/".
 */
export const linking: LinkingOptions<FlatNavigatorParams> = {
  prefixes: [`https://${ownLinkHost()}`],
  getStateFromPath: path => {
    /* The first call is the page load: `LinkHost` checks it (dead link, demo mode, signed out) once it knows the mode. */
    captureInitialPath(path)
    return webState(resolveLink(path).target) as ReturnType<NonNullable<LinkingOptions<FlatNavigatorParams>['getStateFromPath']>>
  },
  getPathFromState: state => {
    const leaf = findFocusedRoute(state as Parameters<typeof findFocusedRoute>[0])
    return leaf ? pathForRoute(leaf) : '/'
  },
}
