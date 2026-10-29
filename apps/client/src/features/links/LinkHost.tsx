import {useEffect} from 'react'
import {useLingui} from '@lingui/react/macro'

import {readDeferredLink} from '#/lib/links/deferred'
import {releaseDemoSwitch, takeWaitingLink, useLinkWaitingForDemo} from '#/lib/links/gate'
import {takeLinkIntent} from '#/lib/links/intent'
import {openLink} from '#/lib/links/open'
import {useDemoMode} from '#/state/demo'
import {useSession} from '#/state/session'
import * as Prompt from '#/components/Prompt'

/**
 * Mounted once (F-254): the demo-mode question for a link to real data, the resume of a link held before sign-in
 * and the first-open hand-over of a deferred link. Renders nothing otherwise.
 */
export function LinkHost() {
  const {t: l} = useLingui()
  const {demo, setDemo} = useDemoMode()
  const {hasSession} = useSession()
  const waiting = useLinkWaitingForDemo()
  const prompt = Prompt.usePromptControl()

  useEffect(() => {
    if (waiting) prompt.open()
  }, [waiting, prompt])

  /* Signed in with a link held from before (F-250): continue to it. */
  useEffect(() => {
    if (!hasSession) return
    const held = takeLinkIntent()
    if (held) openLink(held, {isDemo: demo})
  }, [hasSession, demo])

  /* The first open after an install from a link (the server hand-over is a stub until the backend). */
  useEffect(() => {
    void readDeferredLink().then(link => link && openLink(link, {isDemo: false}))
  }, [])

  return (
    <Prompt.Basic
      control={prompt}
      title={l`Switch back to your data?`}
      description={l`This link is for your own groups and friends, and demo mode shows sample data. Switch demo mode off to open it.`}
      confirmButtonCta={l`Switch back`}
      cancelButtonCta={l`Stay in demo`}
      /* After Switch back has taken it (its callback is queued first): a dismissed prompt forgets the link. */
      onClose={() => setTimeout(releaseDemoSwitch)}
      onConfirm={() => {
        const path = takeWaitingLink()
        if (path) void setDemo(false).then(() => openLink(path, {isDemo: false}))
      }}
    />
  )
}
