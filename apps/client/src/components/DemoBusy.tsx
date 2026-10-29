import {lazy, Suspense} from 'react'

import {useDemoMode} from '#/state/demo'

/*
 * Dev and e2e builds only (ARCHITECTURE 26.1): the blocking "Setting up the demo" cover is loaded on demand
 * under a condition Metro folds at build time, so a production bundle holds no part of it. There is no demo
 * banner (owner 133): demo mode shows in the Settings switch and the avatar's "Demo" dot.
 */
const Busy =
  __DEV__ || process.env.EXPO_PUBLIC_ENV === 'e2e'
    ? lazy(() => import('#/components/DemoBusyCover'))
    : null

/** The blocking "Setting up the demo" cover, drawn after the sheet and dialog outlets so nothing is above it. */
export function DemoBusy() {
  const {busy} = useDemoMode()
  if (!Busy || !busy) return null
  return (
    <Suspense fallback={null}>
      <Busy />
    </Suspense>
  )
}
