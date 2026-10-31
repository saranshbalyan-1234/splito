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
  /** A directory answers (demo mode today, the backend later); false offline, where invite links fail closed. Read here, never from a module variable during render. */
  hasDirectory: boolean
  /** A switch is running: the first seeding behind a progress pill (the app stays usable), then the swap under a cover (`useIsStoreCovered`). */
  busy: boolean
  /** Turns demo mode on (seeding a fresh dataset) or off (erasing the demo database and everything it kept); resolves when the other store is showing. */
  setDemo: (on: boolean, onProgress?: (done: number) => void) => Promise<void>
}

export const DEMO_OFF: DemoModeValue = {demo: false, hasDirectory: false, busy: false, setDemo: async () => {}}

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

const isCovered = () => progress === null
/**
 * The app is covered while a switch swaps the store (busy, and no seeding is running behind the pill). Only the cover
 * may drop a dirty sheet without asking: while the seeding runs the person can still type, and Back must ask as usual.
 */
export function useIsStoreCovered() {
  const {busy} = useDemoMode()
  const notSeeding = useSyncExternalStore(subscribe, isCovered)
  return busy && notSeeding
}
