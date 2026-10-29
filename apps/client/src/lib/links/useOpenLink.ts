import {useDemoMode} from '#/state/demo'
import {openLink, openLinkWhenReady} from './open'

/**
 * `openLink` that knows whether demo mode is on. `open` is for a link that came from outside (a push, a QR code, an
 * invite, a share): to real data it asks to switch back first. `go` is for a screen's own button (a Search result,
 * an Ask action), whose target is in the store now showing, so it never asks.
 */
export function useOpenLink() {
  const {demo} = useDemoMode()
  return {
    open: (input: string) => openLink(input, {isDemo: demo}),
    go: (input: string) => openLink(input),
    openWhenReady: (input: string) => openLinkWhenReady(input, {isDemo: demo}),
  }
}
