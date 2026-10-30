import {useSyncExternalStore} from 'react'
import {Linking} from 'react-native'

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

let didReadInitial = false
/**
 * The URL this process was launched with, once: `Linking.getInitialURL()` answers the same launch URL every time it is
 * asked, so a log out and sign in (or any second reader) would replay a link that was already handled. The first reader
 * (the navigator's `linking.getInitialURL`, or the signed-out app) takes it; everyone after gets null.
 */
export async function takeInitialUrlOnce(): Promise<string | null> {
  if (didReadInitial) return null
  didReadInitial = true
  const url = await Linking.getInitialURL()
  return url && isAppUrl(url) ? url : null
}

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
