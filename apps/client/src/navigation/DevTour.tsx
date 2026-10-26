import {useEffect, useRef} from 'react'
import {createNavigationContainerRef} from '@react-navigation/native'

import {type RootStackParams} from '#/lib/routes/types'
import {useSetDrawerOpen} from '#/state/shell/drawer-open'

export const navigationRef = createNavigationContainerRef<RootStackParams>()

const STEP_MS = 8000

/**
 * Dev builds only, with EXPO_PUBLIC_TOUR=1: steps through the main screens on a
 * timer so simulator screenshots can be taken without tapping (no UI driver on
 * headless simulators). Renders nothing.
 */
export function DevTour() {
  const setDrawerOpen = useSetDrawerOpen()
  /* Read through a ref: the setter's identity changes with drawer state, which must not restart the tour. */
  const setDrawerOpenRef = useRef(setDrawerOpen)
  setDrawerOpenRef.current = setDrawerOpen
  useEffect(() => {
    if (!(__DEV__ && process.env.EXPO_PUBLIC_TOUR === '1')) return
    const go = (name: string, params?: object) => () =>
      (navigationRef.navigate as (n: string, p?: object) => void)(name, params)
    const steps = [
      go('Tabs', {screen: 'People'}),
      () => setDrawerOpenRef.current(true),
      () => setDrawerOpenRef.current(false),
      go('Tabs', {screen: 'Groups'}),
      go('Tabs', {screen: 'Analytics'}),
      go('Notifications'),
      go('Settings'),
      go('AddExpense', {}),
    ]
    let i = 0
    const id = setInterval(() => {
      if (!navigationRef.isReady()) return
      steps[i++]?.()
      if (i >= steps.length) clearInterval(id)
    }, STEP_MS)
    return () => clearInterval(id)
  }, [])
  return null
}
