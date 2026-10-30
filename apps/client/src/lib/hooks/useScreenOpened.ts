import {useContext, useEffect, useState} from 'react'
import {NavigationContext} from '@react-navigation/native'

import {OPENED_FALLBACK_MS} from '#/lib/hooks/useAfterTransition'
import {createOpenedTracker} from '#/lib/hooks/openedTracker'
import {IS_NATIVE} from '#/env'

/** A screen that starts no transition within about a frame of mounting has none to wait for (openedTracker.ts). */
const QUIET_MS = 16

const timers = {
  set: (cb: () => void, ms: number) => setTimeout(cb, ms),
  clear: (handle: unknown) => clearTimeout(handle as ReturnType<typeof setTimeout>),
}

type EventNav = {
  addListener(type: string, cb: (e: {data?: {closing?: boolean}}) => void): () => void
}

/**
 * Whether this screen's open transition (a push, a tab switch with animation) has ended, for `OpenedContext`
 * (ARCHITECTURE 26.9, owner 168). `undefined` on web, where pages and tabs do not animate, so deferred bodies
 * wait two frames instead. Native: the navigator's `transitionEnd` (not closing); a screen that never starts a
 * transition (the first tab on a cold start) opens after a frame; a timer covers a missed event.
 */
export function useScreenOpened(): boolean | undefined {
  const navigation = useContext(NavigationContext)
  const [opened, setOpened] = useState(false)
  useEffect(() => {
    if (!IS_NATIVE || !navigation || opened) return
    // The stack and tab navigators emit these ({closing}); the base event map does not type them.
    const nav = navigation as unknown as EventNav
    const tracker = createOpenedTracker({
      onOpened: () => setOpened(true),
      timers,
      quietMs: QUIET_MS,
      fallbackMs: OPENED_FALLBACK_MS,
    })
    const offStart = nav.addListener('transitionStart', () => tracker.transitionStart())
    const offEnd = nav.addListener('transitionEnd', e => tracker.transitionEnd(!!e.data?.closing))
    return () => {
      offStart()
      offEnd()
      tracker.dispose()
    }
  }, [navigation, opened])
  return IS_NATIVE && navigation ? opened : undefined
}
