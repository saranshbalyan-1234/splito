import {useEffect, useRef} from 'react'
import {startPage} from '#/lib/routes/startTab'
import {type Group, isGroupInactive} from '@splito/sync'

import {useEntities} from '#/data/hooks'

import {navigationRef} from '#/navigation/ref'
import {useSetDrawerOpen} from '#/state/shell/drawer-open'

const STEP_MS = 8000
/* Module scope: the drawer remounts this component, which must not restart the tour. */
let tourStep = 0
let tourTimer: ReturnType<typeof setInterval> | undefined

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
  /* The busiest active group, read when its step runs (demo data seeds after mount). */
  const groupIdRef = useRef<string>(undefined)
  groupIdRef.current = useEntities<Group>('group')?.find(g => !isGroupInactive(g.data))?.id
  useEffect(() => {
    if (!(__DEV__ && process.env.EXPO_PUBLIC_TOUR === '1')) return
    const go = (name: string, params?: object) => () =>
      (navigationRef.navigate as (n: string, p?: object) => void)(name, params)
    const steps = [
      go('Tabs', {screen: startPage()}),
      () => setDrawerOpenRef.current(true),
      () => setDrawerOpenRef.current(false),
      go('Tabs', {screen: 'Groups'}),
      () => {
        if (groupIdRef.current) go('Group', {groupId: groupIdRef.current, tab: 'balances'})()
      },
      go('Tabs', {screen: 'Analytics'}),
      go('Tabs', {screen: 'Activity'}),
      go('Tabs', {screen: 'Settings'}),
      go('AddExpense', {}),
    ]
    if (tourTimer) return
    tourTimer = setInterval(() => {
      if (!navigationRef.isReady()) return
      steps[tourStep++]?.()
      if (tourStep >= steps.length) clearInterval(tourTimer)
    }, STEP_MS)
  }, [])
  return null
}
