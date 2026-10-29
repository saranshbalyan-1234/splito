import {useSyncExternalStore} from 'react'

/** A link to real data opened while demo mode is on, waiting for the person to switch back (F-254). */
let waiting: string | null = null
const listeners = new Set<() => void>()
function set(next: string | null) {
  waiting = next
  listeners.forEach(l => l())
}
export const holdForDemoSwitch = (path: string) => set(path)
export const releaseDemoSwitch = () => set(null)
export function useLinkWaitingForDemo() {
  return useSyncExternalStore(
    l => (listeners.add(l), () => void listeners.delete(l)),
    () => waiting,
  )
}

/** The waiting link, once. */
export function takeWaitingLink() {
  const path = waiting
  set(null)
  return path
}
