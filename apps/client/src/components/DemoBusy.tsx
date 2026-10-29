import {lazy, Suspense} from 'react'

import {useDemoMode} from '#/state/demo'

/*
 * Every build (owner 148): the blocking "Setting up the demo" cover is a lazy chunk loaded on demand. There is no demo
 * banner (owner 133): demo mode shows in the Settings switch and the avatar's "Demo" dot.
 */
const Busy: ReturnType<typeof lazy> | null = lazy(() => import('#/components/DemoBusyCover'))

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
