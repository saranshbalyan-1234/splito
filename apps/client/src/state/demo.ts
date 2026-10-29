import {createContext, useContext, useSyncExternalStore} from 'react'

/*
 * Dev and e2e demo mode (ARCHITECTURE 26.1): whether it is showing, the switch,
 * and how far a first-time seeding has got. Defined here, not in `data/`, so
 * `components/` and `lib/` can ask without importing `data/`; `StoreProvider`
 * provides the value. Always off and inert in production builds.
 */

/** What the switch exposes. */
export type DemoModeValue = {
  /** The app is on the separate demo database. */
  demo: boolean
  /** A switch or a reset is running (a blocking dialog covers the app meanwhile). */
  busy: boolean
  /** Turns demo mode on (seeding it the first time) or off; resolves when the other store is showing. */
  setDemo: (on: boolean, onProgress?: (done: number) => void) => Promise<void>
  /** Wipes the demo database and seeds it again. */
  resetDemo: (onProgress?: (done: number) => void) => Promise<void>
}

export const DEMO_OFF: DemoModeValue = {demo: false, busy: false, setDemo: async () => {}, resetDemo: async () => {}}

export const DemoContext = createContext<DemoModeValue>(DEMO_OFF)
DemoContext.displayName = 'SplitoDemoModeContext'

/** Whether demo mode is showing, and the switch. */
export function useDemoMode(): DemoModeValue {
  return useContext(DemoContext)
}

/* How far the first-time seeding (or a reset) has got, 0..1, or null when nothing runs: one tiny module store. */
let progress: number | null = null
const listeners = new Set<() => void>()
export function setDemoProgress(next: number | null) {
  progress = next
  listeners.forEach(l => l())
}
const subscribe = (l: () => void) => (
  listeners.add(l),
  () => void listeners.delete(l)
)
export const useDemoProgress = () => useSyncExternalStore(subscribe, () => progress)
