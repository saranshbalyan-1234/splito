import {useContext, useEffect, useState} from 'react'
import {NavigationContext} from '@react-navigation/native'

import {OPENED_FALLBACK_MS} from '#/lib/hooks/useAfterTransition'
import {IS_NATIVE} from '#/env'

/**
 * Whether this screen's open transition (a push, a tab switch with animation) has ended, for `OpenedContext`
 * (ARCHITECTURE 26.9, owner 168). `undefined` on web, where pages and tabs do not animate, so deferred bodies
 * wait two frames instead. Native: the navigator's `transitionEnd` (not closing), or a timer where a tab opens
 * without animation and the event never comes.
 */
export function useScreenOpened(): boolean | undefined {
  const navigation = useContext(NavigationContext)
  const [opened, setOpened] = useState(false)
  useEffect(() => {
    if (!IS_NATIVE || !navigation || opened) return
    // The stack and tab navigators emit `transitionEnd` ({closing}); the base event map does not type it.
    const nav = navigation as unknown as {
      addListener(type: string, cb: (e: {data?: {closing?: boolean}}) => void): () => void
    }
    const done = () => setOpened(true)
    const off = nav.addListener('transitionEnd', e => {
      if (!e.data?.closing) done()
    })
    const timer = setTimeout(done, OPENED_FALLBACK_MS)
    return () => {
      off()
      clearTimeout(timer)
    }
  }, [navigation, opened])
  return IS_NATIVE && navigation ? opened : undefined
}
