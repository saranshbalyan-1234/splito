import {useSyncExternalStore} from 'react'

/*
 * Sign-in needs a connection (ARCHITECTURE 26.15). The connectivity store of § 9.2 is not built, so this reads the
 * browser's own signal; a phone reports no signal here and finds out when the request fails.
 * ponytail: web only; upgrade to the § 9.2 store when it lands.
 */
const hasWindow = typeof window !== 'undefined' && typeof window.addEventListener === 'function'

export const isOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false

function subscribe(l: () => void) {
  if (!hasWindow) return () => {}
  window.addEventListener('online', l)
  window.addEventListener('offline', l)
  return () => {
    window.removeEventListener('online', l)
    window.removeEventListener('offline', l)
  }
}

/** True while the device reports no connection. */
export const useIsOffline = () => useSyncExternalStore(subscribe, isOffline, () => false)
