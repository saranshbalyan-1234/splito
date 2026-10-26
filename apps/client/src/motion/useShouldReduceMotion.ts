import {useSyncExternalStore} from 'react'
import {PREFS, prefFrom, type Store} from '@splito/sync'

import {useA11y} from '#/state/a11y'
import {useStore} from '#/data/hooks'
import {entitiesQuery, projectionFor} from '#/data/projections'

type Source = {
  value: string
  listeners: Set<() => void>
  subscribe: (fn: () => void) => () => void
}

const sources = new WeakMap<Store, Source>()

/*
 * One motion value for the whole app, not one subscription per animated
 * component (a list of PressableScale rows would otherwise multiply it).
 * ponytail: the store subscription lives as long as the store; add an
 * unsubscribe if stores ever get swapped at runtime (account switch).
 */
function motionSource(store: Store): Source {
  const cached = sources.get(store)
  if (cached) return cached
  const listeners = new Set<() => void>()
  const src: Source = {
    value: PREFS.motion.default,
    listeners,
    subscribe: fn => {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
  }
  // Reads the shared preference projection: no store read of its own.
  const prefs = projectionFor(store, entitiesQuery<{value: unknown}>('preference'))
  prefs.subscribe(() => {
    const v = prefFrom(prefs.get() ?? [], 'motion')
    if (v === src.value) return
    src.value = v
    listeners.forEach(fn => fn())
  })
  sources.set(store, src)
  return src
}

/**
 * True when animation should be skipped or replaced by a static frame: the OS
 * reduce-motion setting is on, or the Animations preference is 'reduced' or
 * 'off'. Must be used inside StoreProvider.
 */
export function useShouldReduceMotion(): boolean {
  const {reduceMotionEnabled} = useA11y()
  const src = motionSource(useStore())
  const motion = useSyncExternalStore(src.subscribe, () => src.value)
  return reduceMotionEnabled || motion !== 'full'
}
