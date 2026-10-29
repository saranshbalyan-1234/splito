import {useSyncExternalStore} from 'react'

/**
 * The last one-time code the dev AuthClient "sent" (dev and e2e builds only): the Continue flow's dev banner shows it
 * where a real build would have an email or SMS. Nothing writes here in production, so the banner never draws.
 */
export type DevCode = {to: string; code: string; purpose: string}

let last: DevCode | null = null
const listeners = new Set<() => void>()

export function showDevCode(next: DevCode | null) {
  last = next
  listeners.forEach(l => l())
}

export const useDevCode = () =>
  useSyncExternalStore(
    l => (listeners.add(l), () => void listeners.delete(l)),
    () => last,
  )
