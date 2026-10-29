import {useDemoMode} from '#/state/demo'
import {openLink, openLinkWhenReady} from './open'

/** `openLink` that knows whether demo mode is on (a link to real data then asks to switch back first). */
export function useOpenLink() {
  const {demo} = useDemoMode()
  return {
    open: (input: string) => openLink(input, {isDemo: demo}),
    openWhenReady: (input: string) => openLinkWhenReady(input, {isDemo: demo}),
  }
}
