// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/view/com/util/MainScrollProvider.tsx
import {createContext, useCallback, useContext, useEffect} from 'react'
import {type NativeScrollEvent} from 'react-native'
import Animated, {
  clamp,
  interpolate,
  Reanimated3DefaultSpringConfig,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'
import {useSafeAreaInsets} from 'react-native-safe-area-context'
import {useFocusEffect} from '@react-navigation/native'

import {ScrollProvider} from '#/lib/ScrollContext'
import {useShellHeaderLayout, useShellLayout} from '#/state/shell/shell-layout'
import {atoms as a, platform, useBreakpoints, useTheme} from '#/alf'
import {IS_LIQUID_GLASS, IS_NATIVE, IS_WEB} from '#/env'

const WEB_HIDE_SHELL_THRESHOLD = 200

/**
 * The phone top bar's height: `Layout.Header.Outer`'s minimum (48 native,
 * 52 web). Lists under a `HidingHeader` start this far down, as Bluesky's
 * feeds take `useHeaderOffset`.
 */
export const HIDING_HEADER_HEIGHT = platform({native: 48, default: 52})

const HomeHeaderModeContext = createContext<SharedValue<number> | null>(null)
HomeHeaderModeContext.displayName = 'HomeHeaderModeContext'

export function HomeHeaderModeProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const headerMode = useSharedValue(0)
  return (
    <HomeHeaderModeContext.Provider value={headerMode}>
      {children}
    </HomeHeaderModeContext.Provider>
  )
}

export function useHomeHeaderMode() {
  const headerMode = useContext(HomeHeaderModeContext)
  if (!headerMode) {
    throw new Error(
      'useHomeHeaderMode must be used within a HomeHeaderModeProvider',
    )
  }
  return headerMode
}

export function useHomeHeaderTransform() {
  const headerMode = useHomeHeaderMode()
  const {headerHeight} = useShellLayout()
  const {top: topInset} = useSafeAreaInsets()

  const headerPinnedHeight = IS_LIQUID_GLASS ? topInset : 0

  return useAnimatedStyle(() => {
    const headerModeValue = headerMode.get()
    const hHeight = headerHeight.get()

    return {
      pointerEvents: headerModeValue === 0 ? 'auto' : 'none',
      opacity: Math.pow(1 - headerModeValue, 2),
      transform: [
        {
          translateY: interpolate(
            headerModeValue,
            [0, 1],
            [0, headerPinnedHeight - hHeight],
          ),
        },
      ],
    }
  })
}

/**
 * A top-level screen's header (People, Groups, Analytics). On phones it is
 * fixed to the top and slides away on scroll down and back on scroll up, as
 * Bluesky's home header (`HomeHeaderLayoutMobile`); the list below sits in
 * a `MainScrollProvider` and starts `HIDING_HEADER_HEIGHT` down. Wider
 * windows keep the header in flow (sticky on web).
 */
export function HidingHeader({children}: {children: React.ReactNode}) {
  const t = useTheme()
  const {gtMobile} = useBreakpoints()
  const {onLayout} = useShellHeaderLayout()
  const headerMode = useHomeHeaderMode()
  const transform = useHomeHeaderTransform()

  // As Bluesky's Home: leaving the screen brings its header back.
  useFocusEffect(
    useCallback(() => {
      return () => {
        headerMode.set(
          withSpring(0, {
            ...Reanimated3DefaultSpringConfig,
            overshootClamping: true,
          }),
        )
      }
    }, [headerMode]),
  )

  if (gtMobile) return children
  return (
    <Animated.View
      style={[
        a.fixed,
        a.z_10,
        t.atoms.bg,
        {top: 0, left: 0, right: 0},
        transform,
      ]}
      onLayout={onLayout}>
      {children}
    </Animated.View>
  )
}

export function MainScrollProvider({children}: {children: React.ReactNode}) {
  const {headerHeight} = useShellLayout()
  const headerMode = useHomeHeaderMode()
  const {top: topInset} = useSafeAreaInsets()
  const headerPinnedHeight = IS_LIQUID_GLASS ? topInset : 0
  const startDragOffset = useSharedValue<number | null>(null)
  const startMode = useSharedValue<number | null>(null)
  const didJustRestoreScroll = useSharedValue<boolean>(false)

  const setMode = useCallback(
    (v: boolean) => {
      'worklet'
      headerMode.set(
        withSpring(v ? 1 : 0, {
          ...Reanimated3DefaultSpringConfig,
          overshootClamping: true,
        }),
      )
    },
    [headerMode],
  )

  useEffect(() => {
    if (IS_WEB) {
      return listenToForcedWindowScroll(() => {
        startDragOffset.set(null)
        startMode.set(null)
        didJustRestoreScroll.set(true)
      })
    }
  })

  const snapToClosestState = useCallback(
    (e: NativeScrollEvent) => {
      'worklet'
      const offsetY = Math.max(0, e.contentOffset.y)
      if (IS_NATIVE) {
        const startDragOffsetValue = startDragOffset.get()
        if (startDragOffsetValue === null) {
          return
        }
        const didScrollDown = offsetY > startDragOffsetValue
        startDragOffset.set(null)
        startMode.set(null)
        if (offsetY < headerHeight.get()) {
          // If we're close to the top, show the shell.
          setMode(false)
        } else if (didScrollDown) {
          // Showing the bar again on scroll down feels annoying, so don't.
          setMode(true)
        } else {
          // Snap to whichever state is the closest.
          setMode(Math.round(headerMode.get()) === 1)
        }
      }
    },
    [startDragOffset, startMode, setMode, headerMode, headerHeight],
  )

  const onBeginDrag = useCallback(
    (e: NativeScrollEvent) => {
      'worklet'
      const offsetY = Math.max(0, e.contentOffset.y)
      if (IS_NATIVE) {
        startDragOffset.set(offsetY)
        startMode.set(headerMode.get())
      }
    },
    [headerMode, startDragOffset, startMode],
  )

  const onEndDrag = useCallback(
    (e: NativeScrollEvent) => {
      'worklet'
      if (IS_NATIVE) {
        if (e.velocity && e.velocity.y !== 0) {
          // If we detect a velocity, wait for onMomentumEnd to snap.
          return
        }
        snapToClosestState(e)
      }
    },
    [snapToClosestState],
  )

  const onMomentumEnd = useCallback(
    (e: NativeScrollEvent) => {
      'worklet'
      if (IS_NATIVE) {
        snapToClosestState(e)
      }
    },
    [snapToClosestState],
  )

  const onScroll = useCallback(
    (e: NativeScrollEvent) => {
      'worklet'
      const offsetY = Math.max(0, e.contentOffset.y)
      if (IS_NATIVE) {
        const startDragOffsetValue = startDragOffset.get()
        const startModeValue = startMode.get()
        if (startDragOffsetValue === null || startModeValue === null) {
          if (headerMode.get() !== 0 && offsetY < headerHeight.get()) {
            // If we're close enough to the top, always show the shell.
            // Even if we're not dragging.
            setMode(false)
          }
          return
        }

        // The "mode" value is always between 0 and 1.
        // Figure out how much to move it based on the current dragged distance.
        const dy = offsetY - startDragOffsetValue
        const hideDistance = headerHeight.get() - headerPinnedHeight
        const dProgress = interpolate(
          dy,
          [-hideDistance, hideDistance],
          [-1, 1],
        )
        const newValue = clamp(startModeValue + dProgress, 0, 1)
        if (newValue !== headerMode.get()) {
          // Manually adjust the value. This won't be (and shouldn't be) animated.
          headerMode.set(newValue)
        }
      } else {
        if (didJustRestoreScroll.get()) {
          didJustRestoreScroll.set(false)
          // Don't hide/show navbar based on scroll restoratoin.
          return
        }
        // On the web, we don't try to follow the drag because we don't know when it ends.
        // Instead, show/hide immediately based on whether we're scrolling up or down.
        const dy = offsetY - (startDragOffset.get() ?? 0)
        startDragOffset.set(offsetY)

        if (dy < 0 || offsetY < WEB_HIDE_SHELL_THRESHOLD) {
          setMode(false)
        } else if (dy > 0) {
          setMode(true)
        }
      }
    },
    [
      headerHeight,
      headerPinnedHeight,
      headerMode,
      setMode,
      startDragOffset,
      startMode,
      didJustRestoreScroll,
    ],
  )

  return (
    <ScrollProvider
      onBeginDrag={onBeginDrag}
      onEndDrag={onEndDrag}
      onScroll={onScroll}
      onMomentumEnd={onMomentumEnd}>
      {children}
    </ScrollProvider>
  )
}

/* Upstream uses eventemitter3; a listener set does the same here. */
const forcedScrollListeners = new Set<() => void>()

if (IS_WEB) {
  const originalScroll = window.scroll
  window.scroll = function (this: Window, ...args: unknown[]) {
    forcedScrollListeners.forEach(l => l())
    return originalScroll.apply(this, args as Parameters<typeof window.scroll>)
  } as typeof window.scroll

  const originalScrollTo = window.scrollTo
  window.scrollTo = function (this: Window, ...args: unknown[]) {
    forcedScrollListeners.forEach(l => l())
    return originalScrollTo.apply(
      this,
      args as Parameters<typeof window.scrollTo>,
    )
  } as typeof window.scrollTo
}

function listenToForcedWindowScroll(listener: () => void) {
  forcedScrollListeners.add(listener)
  return () => {
    forcedScrollListeners.delete(listener)
  }
}
