import {Linking} from 'react-native'
import {type LinkingOptions} from '@react-navigation/native'

import {holdIncoming, isAppUrl} from '#/lib/links/incoming'
import {LINK_SCHEME, ownLinkHost} from '#/lib/links/hosts'
import {resolveLink} from '#/lib/links/resolve'
import {nativeState} from '#/lib/links/state'
import {type RootStackParams} from '#/lib/routes/types'

/*
 * Native: iOS Universal Links and Android App Links claim this build's tier host (app.config.ts, one JSON), and
 * `splito://` is the custom scheme. The navigator never opens an incoming URL itself (F-254): the cold start's
 * and every later one are held (`lib/links/incoming`) and `LinkHost` opens them through `openLink`, which applies
 * the demo question and the signed-out hold. The page opens, then the sheet over it (`navigation/sheets`).
 * `getStateFromPath` stays for hrefs the navigator builds itself; it has no side effects.
 */
export const linking: LinkingOptions<RootStackParams> = {
  prefixes: [`${LINK_SCHEME}://`, `https://${ownLinkHost()}`],
  getInitialURL: async () => {
    const url = await Linking.getInitialURL()
    if (url && isAppUrl(url)) holdIncoming(url)
    return null
  },
  subscribe: () => {
    const sub = Linking.addEventListener('url', ({url}) => holdIncoming(url))
    return () => sub.remove()
  },
  getStateFromPath: path => nativeState(resolveLink(path).target) as ReturnType<NonNullable<LinkingOptions<RootStackParams>['getStateFromPath']>>,
}
