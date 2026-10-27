// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/state/shell/minimal-mode.tsx
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from 'react'
import {
  Reanimated3DefaultSpringConfig,
  type SharedValue,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'
import {useFocusEffect} from '@react-navigation/native'

type StateContext = {
  footerMode: SharedValue<number>
  /**
   * Splito addition (ARCHITECTURE 26.4): how far the focused screen has
   * scrolled the shell away, 0 shown to 1 hidden. The bottom bar and FAB
   * follow it with the header; Bluesky's footer only hides for full-screen
   * pages (`footerMode`).
   */
  scrollMode: SharedValue<number>
}
type SetContext = {
  add: () => void
  subtract: () => void
}

const stateContext = createContext<StateContext | null>(null)
stateContext.displayName = 'MinimalModeStateContext'
const setContext = createContext<SetContext | null>(null)
setContext.displayName = 'MinimalModeSetContext'

export function Provider({children}: React.PropsWithChildren<{}>) {
  const footerMode = useSharedValue(0)
  const scrollMode = useSharedValue(0)

  const setModeWorklet = useCallback(
    (v: boolean) => {
      'worklet'
      footerMode.set(
        withSpring(v ? 1 : 0, {
          ...Reanimated3DefaultSpringConfig,
          overshootClamping: true,
        }),
      )
    },
    [footerMode],
  )

  // defaults to "visible", if the count is >0 it gets hidden
  const countRef = useRef(0)
  const add = useCallback(() => {
    // 0 -> 1 = hide
    if (countRef.current === 0) setModeWorklet(true)

    countRef.current += 1
  }, [setModeWorklet])
  const subtract = useCallback(() => {
    // 1 -> 0 = show
    if (countRef.current === 1) setModeWorklet(false)

    // count must never go below 0
    if (countRef.current > 0) countRef.current -= 1
  }, [setModeWorklet])

  const setters = useMemo(
    () => ({
      add,
      subtract,
    }),
    [add, subtract],
  )

  const value = useMemo(
    () => ({
      footerMode,
      scrollMode,
    }),
    [footerMode, scrollMode],
  )
  return (
    <stateContext.Provider value={value}>
      <setContext.Provider value={setters}>{children}</setContext.Provider>
    </stateContext.Provider>
  )
}

export function useMinimalShellMode() {
  const context = useContext(stateContext)
  if (!context)
    throw new Error(
      'useMinimalShellMode must be used within a MinimalModeProvider',
    )
  return context
}

export function useMinimalShellModeSetters() {
  const context = useContext(setContext)
  if (!context)
    throw new Error(
      'useMinimalShellModeSetters must be used within a MinimalModeProvider',
    )
  return context
}

export function useEnableMinimalShellMode({enabled} = {enabled: true}) {
  const setters = useMinimalShellModeSetters()
  useEffect(() => {
    if (enabled) {
      setters.add()
      return () => setters.subtract()
    }
  }, [enabled, setters])
}

export function useEnableMinimalShellModeForScreen(
  {enabled} = {enabled: true},
) {
  const setters = useMinimalShellModeSetters()
  useFocusEffect(
    useCallback(() => {
      if (enabled) {
        setters.add()
        return () => setters.subtract()
      }
    }, [enabled, setters]),
  )
}

/**
 * Brings the header, bottom bar and FAB back (a sheet opened, a tab was
 * switched). Safe outside the provider, where there is nothing to show.
 */
export function useShowShell() {
  const context = useContext(stateContext)
  return useCallback(() => {
    context?.scrollMode.set(
      withSpring(0, {...Reanimated3DefaultSpringConfig, overshootClamping: true}),
    )
  }, [context])
}
