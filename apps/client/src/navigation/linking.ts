import {type LinkingOptions} from '@react-navigation/native'

import {LINK_SCHEME, ownLinkHost} from '#/lib/links/hosts'
import {resolveLink} from '#/lib/links/resolve'
import {nativeState} from '#/lib/links/state'
import {type RootStackParams} from '#/lib/routes/types'
import {queueSheets} from '#/navigation/sheets'

/*
 * Native: iOS Universal Links and Android App Links claim this build's tier host (app.config.ts, one JSON), and
 * `splito://` is the custom scheme. Every URL goes through the one resolver (F-254): the page, its params and
 * the sheet over it. A sheet cannot be a stack route on a phone (the native sheet has its own dismiss), so it is
 * held until its page mounts (`queueSheets`). Unknown links open Home.
 */
export const linking: LinkingOptions<RootStackParams> = {
  prefixes: [`${LINK_SCHEME}://`, `https://${ownLinkHost()}`],
  getStateFromPath: path => {
    const {target} = resolveLink(path)
    queueSheets(target)
    return nativeState(target) as ReturnType<NonNullable<LinkingOptions<RootStackParams>['getStateFromPath']>>
  },
}
