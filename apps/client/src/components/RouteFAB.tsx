import {useEffect, useSyncExternalStore} from 'react'
import {useRoute} from '@react-navigation/native'

import {fabParams} from '#/lib/routes/fab'
import {AddExpenseFAB} from '#/components/AddExpenseFAB'

/* The routes whose screen holds its FAB back, by route key: a screen sits above its own scaffold, so a context set under `Layout.Screen` would never reach it. */
const held = new Set<string>()
const listeners = new Set<() => void>()
const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => void listeners.delete(listener)
}
const setHeld = (key: string, isHeld: boolean) => {
  if (held.has(key) === isHeld) return
  if (isHeld) held.add(key)
  else held.delete(key)
  listeners.forEach(l => l())
}

/** Holds the FAB back while `isSuppressed` (an empty Home or People, an inactive group): the screen's own buttons are the actions, a FAB would be a third Add. */
export function useSuppressFab(isSuppressed: boolean) {
  const {key} = useRoute()
  useEffect(() => {
    setHeld(key, isSuppressed)
    return () => setHeld(key, false)
  }, [key, isSuppressed])
}

/**
 * The FAB, decided once (owner 190, § 26.6): the screen scaffold (`Layout.Screen`) renders this under every screen, and
 * the route allow-list in `fabParams` says whether and with what Add expense pre-selects. It is not drawn on wide
 * screens (`FAB`) or while a screen holds it back with `useSuppressFab`.
 */
export function RouteFAB() {
  const route = useRoute()
  const isHeld = useSyncExternalStore(subscribe, () => held.has(route.key))
  const params = fabParams(route)
  return params && !isHeld ? <AddExpenseFAB {...params} /> : null
}
