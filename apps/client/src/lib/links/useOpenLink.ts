import {useStore} from '#/data/hooks'
import {useDemoMode} from '#/state/demo'
import {isInStore} from './inStore'
import {openLink, openLinkWhenReady} from './open'
import {type LinkTarget} from './resolve'

/**
 * `openLink` that knows whether demo mode is on. `open` is for a link that came from outside (a push, a QR code, an
 * invite, a share): to real data it asks to switch back first. `go` is for a screen's own button (a Search result,
 * an Ask action), whose target is in the store now showing, so it never asks.
 */
export function useOpenLink() {
  const {demo} = useDemoMode()
  const store = useStore()
  const options = {isDemo: demo, isInStore: (target: LinkTarget) => isInStore(store, target)}
  return {
    open: (input: string) => openLink(input, options),
    go: (input: string) => openLink(input),
    openWhenReady: (input: string) => openLinkWhenReady(input, options),
  }
}
