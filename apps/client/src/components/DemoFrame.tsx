import {lazy, Suspense} from 'react'
import {View} from 'react-native'
import {SafeAreaInsetsContext, useSafeAreaInsets} from 'react-native-safe-area-context'

import {useDemoMode} from '#/state/demo'
import {atoms as a} from '#/alf'

/*
 * Dev and e2e builds only (ARCHITECTURE 26.1): the "Demo mode · Switch back"
 * banner and the blocking "Setting up the demo" dialog are loaded on demand
 * under a condition Metro folds at build time, so a production bundle holds no
 * part of them.
 */
const DemoBanner =
  __DEV__ || process.env.EXPO_PUBLIC_ENV === 'e2e'
    ? lazy(() => import('#/components/DemoBanner'))
    : null
const Busy =
  __DEV__ || process.env.EXPO_PUBLIC_ENV === 'e2e'
    ? lazy(() => import('#/components/DemoBanner').then(m => ({default: m.Busy})))
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

/**
 * The shell's frame: the demo banner once, on top of every screen (pages, sheets
 * and composers, sign-in), and everything else below it. While the banner shows
 * it is what clears the status bar, so the screens below see no top inset.
 * Production: renders its children in a plain full-height view.
 */
export function DemoFrame({children}: {children: React.ReactNode}) {
  const {demo} = useDemoMode()
  const insets = useSafeAreaInsets()
  if (!DemoBanner) return children
  return (
    <View style={a.h_full}>
      {demo ? (
        <Suspense fallback={null}>
          <DemoBanner />
        </Suspense>
      ) : null}
      <SafeAreaInsetsContext.Provider value={demo ? {...insets, top: 0} : insets}>
        <View style={a.flex_1}>{children}</View>
      </SafeAreaInsetsContext.Provider>
    </View>
  )
}
