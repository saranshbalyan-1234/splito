// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/view/com/util/MainScrollProvider.tsx
import {createContext, useCallback, useContext, useEffect} from 'react'
import {type NativeScrollEvent} from 'react-native'
import {
  clamp,
  interpolate,
  useAnimatedReaction,
  Reanimated3DefaultSpringConfig,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'

import {ScrollProvider} from '#/lib/ScrollContext'
import {useMinimalShellMode} from '#/state/shell/minimal-mode'
import {useShellLayout} from '#/state/shell/shell-layout'
import {IS_NATIVE, IS_WEB} from '#/env'

const WEB_HIDE_SHELL_THRESHOLD = 200

/*
 * Bluesky keeps one header mode for Home. Every Splito screen has its own
 * header, so `Layout.Screen` mounts a provider per screen and the header
 * comes back whenever a screen is opened fresh.
 */
const HeaderModeContext = createContext<SharedValue<number> | null>(null)
HeaderModeContext.displayName = 'HeaderModeContext'

/** 0 is shown, 1 is hidden; the screen's lists drive it as they scroll. */
export function HeaderModeProvider({children}: {children: React.ReactNode}) {
  const headerMode = useSharedValue(0)
  return (
    <HeaderModeContext.Provider value={headerMode}>
      {children}
    </HeaderModeContext.Provider>
  )
}

/**
 * Bluesky's minimal-shell header transform: slides the header up and fades
 * it as the screen scrolls down. Web translates the sticky header; native
 * pulls the in-flow header up so the list takes its room.
 * ponytail: the native margin re-lays the screen each frame of the slide;
 * Bluesky's fixed header plus a list `headerOffset` avoids that if it shows
 * up in a profile.
 */
export function useHeaderHideTransform(height: SharedValue<number>) {
  const headerMode = useContext(HeaderModeContext)

  return useAnimatedStyle(() => {
    const mode = headerMode?.get() ?? 0
    const offset = interpolate(mode, [0, 1], [0, -height.get()])
    return {
      pointerEvents: mode === 0 ? 'auto' : 'none',
      opacity: Math.pow(1 - mode, 2),
      ...(IS_WEB ? {transform: [{translateY: offset}]} : {marginTop: offset}),
    }
  })
}

export function MainScrollProvider({children}: {children: React.ReactNode}) {
  const {headerHeight} = useShellLayout()
  const fallbackMode = useSharedValue(0)
  const headerMode = useContext(HeaderModeContext) ?? fallbackMode
  /* Shared scroll state: a tab switch or sheet resets it, and the header follows (ARCHITECTURE 26.4). */
  const {scrollMode} = useMinimalShellMode()
  const startDragOffset = useSharedValue<number | null>(null)
  const startMode = useSharedValue<number | null>(null)
  const didJustRestoreScroll = useSharedValue<boolean>(false)

  const setMode = useCallback(
    (v: boolean) => {
      'worklet'
      const config = {...Reanimated3DefaultSpringConfig, overshootClamping: true}
      headerMode.set(withSpring(v ? 1 : 0, config))
      scrollMode.set(withSpring(v ? 1 : 0, config))
    },
    [headerMode, scrollMode],
  )

  /*
   * Something outside the list (a tab switch, a sheet opening) brought the
   * shell back: this screen's header comes with it.
   */
  useAnimatedReaction(
    () => scrollMode.get(),
    mode => {
      if (mode === 0 && headerMode.get() !== 0) {
        headerMode.set(
          withSpring(0, {
            ...Reanimated3DefaultSpringConfig,
            overshootClamping: true,
          }),
        )
      }
    },
  )

  useEffect(() => {
    if (IS_WEB) {
      let timer: ReturnType<typeof setTimeout> | undefined
      const stop = listenToForcedWindowScroll(() => {
        startDragOffset.set(null)
        startMode.set(null)
        didJustRestoreScroll.set(true)
        /*
         * Splito: a programmatic scroll that moves nothing (already at the
         * top) fires no scroll event, which would leave the flag set and
         * swallow the person's first real scroll (owner 81: the header never
         * hid). The restored scroll's own event arrives within a few frames.
         */
        clearTimeout(timer)
        timer = setTimeout(() => didJustRestoreScroll.set(false), 250)
      })
      return () => {
        stop()
        clearTimeout(timer)
        didJustRestoreScroll.set(false)
      }
    }
  }, [startDragOffset, startMode, didJustRestoreScroll])

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
        const hideDistance = headerHeight.get()
        const dProgress = interpolate(
          dy,
          [-hideDistance, hideDistance],
          [-1, 1],
        )
        const newValue = clamp(startModeValue + dProgress, 0, 1)
        if (newValue !== headerMode.get()) {
          // Manually adjust the value. This won't be (and shouldn't be) animated.
          headerMode.set(newValue)
          scrollMode.set(newValue)
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
      headerMode,
      scrollMode,
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

/* Bluesky uses an EventEmitter here; a listener set does the same job. */
const forcedScrollListeners = new Set<() => void>()

if (IS_WEB && typeof window !== 'undefined') {
  for (const name of ['scroll', 'scrollTo'] as const) {
    const original = window[name] as (...args: unknown[]) => void
    window[name] = function (this: Window, ...args: unknown[]) {
      forcedScrollListeners.forEach(listener => listener())
      return original.apply(this, args)
    } as typeof window.scroll
  }
}

function listenToForcedWindowScroll(listener: () => void) {
  forcedScrollListeners.add(listener)
  return () => {
    forcedScrollListeners.delete(listener)
  }
}
