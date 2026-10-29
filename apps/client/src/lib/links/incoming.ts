import {useSyncExternalStore} from 'react'

/**
 * Links that arrive from outside (F-254): a tap on a Universal / App Link or `splito://`, a push, a share. They
 * are never handed to the navigator directly: they wait here for `LinkHost`, which opens them through `openLink`
 * once it knows whether demo mode is on and whether anyone is signed in, so the demo question and the sign-in
 * hold apply to every one. One slot; a newer link replaces an unopened older one.
 */
let incoming: string | null = null
let initialPath: string | null = null
const listeners = new Set<() => void>()
const emit = () => listeners.forEach(l => l())

/** Not ours: Expo's dev client launches the app with `exp+splito://expo-development-client/...`. */
export const isAppUrl = (url: string) => !/^exp(\+|:)/i.test(url)

export function holdIncoming(url: string) {
  if (!isAppUrl(url)) return
  incoming = url
  emit()
}

export function takeIncoming() {
  const url = incoming
  incoming = null
  return url
}

export function useIncomingLink() {
  return useSyncExternalStore(
    l => (listeners.add(l), () => void listeners.delete(l)),
    () => incoming,
  )
}

/** Web: the address the page was loaded with, kept so it can be checked once the app knows its mode. */
export function captureInitialPath(path: string) {
  if (initialPath === null) initialPath = path
}

export function takeInitialPath() {
  const path = initialPath
  initialPath = null
  return path
}
