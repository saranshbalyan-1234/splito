import {useEffect} from 'react'
import {useLingui} from '@lingui/react/macro'

import {IS_E2E, IS_WEB} from '#/env'
import {useStore} from '#/data/hooks'
import {isInStore} from '#/lib/links/inStore'
import {type LinkTarget} from '#/lib/links/resolve'
import {device} from '#/storage'
import {readDeferredLink} from '#/lib/links/deferred'
import {releaseDemoSwitch, takeWaitingLink, useLinkWaitingForDemo} from '#/lib/links/gate'
import {takeIncoming, takeInitialPath, useIncomingLink} from '#/lib/links/incoming'
import {takeLinkIntent} from '#/lib/links/intent'
import {checkInitialLink, openLink, openLinkWhenReady} from '#/lib/links/open'
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
  const store = useStore()
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
    if (held) openLink(held, {isDemo: demo, isInStore: (target: LinkTarget) => isInStore(store, target)})
  }, [hasSession, demo, store])

  /* E2E builds only: `window.__splitoTest.openLink(url)` opens a link as a push tap or a shared link would (warm). */
  useEffect(() => {
    if (!IS_E2E || !IS_WEB) return
    const w = window as unknown as {__splitoTest?: Record<string, unknown>}
    w.__splitoTest = {...w.__splitoTest, openLink: (url: string) => openLink(url, {isDemo: demo, isInStore: (target: LinkTarget) => isInStore(store, target)})}
  }, [demo, store])

  /* Links from outside (a tap on a link, a push, a share) wait in `incoming`; they open through `openLink` now that the mode is known. */
  const incoming = useIncomingLink()
  useEffect(() => {
    const url = incoming && takeIncoming()
    if (url) openLinkWhenReady(url, {isDemo: demo, isInStore: (target: LinkTarget) => isInStore(store, target)})
  }, [incoming, demo, store])

  /* The address the web page loaded with: dead link, demo mode, signed out (the navigator showed it before the mode was known). */
  useEffect(() => {
    const path = takeInitialPath()
    if (path) checkInitialLink(path, {isDemo: demo, isInStore: (target: LinkTarget) => isInStore(store, target)})
  }, [demo, store])

  /* The first open after an install from a link (the server hand-over is a stub until the backend), on the first launch only. */
  useEffect(() => {
    if (device.get(['deferredLinkChecked'])) return
    device.set(['deferredLinkChecked'], true)
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
