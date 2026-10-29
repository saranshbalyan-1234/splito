// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/components/Lightbox/pager/ImagePager.tsx (dismiss swipe: distance or flick decides, DISMISS_CANCEL_SPRING) and src/components/Dialog/index.tsx (Handle)
import {createContext, useContext, useEffect, useRef, useState} from 'react'
import {useWindowDimensions, View} from 'react-native'
import Animated, {
  cancelAnimation,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
  type WithSpringConfig,
} from 'react-native-reanimated'
import {useSafeAreaInsets} from 'react-native-safe-area-context'
import {scheduleOnRN} from 'react-native-worklets'

import {useShouldReduceMotion} from '#/motion/useShouldReduceMotion'
import {shouldDismissDrawer} from './drawerDismiss'
import {atoms as a, tokens, useBreakpoints, useTheme, web} from '#/alf'

/*
 * Owner rule: every modal on a phone is a drawer. Web below 800px shows
 * dialogs, prompts, form sheets, menus and the composer route as a sheet
 * from the bottom edge (native already uses Bluesky's bottom sheet), with
 * the native sheet's handle, a drag down to close and the scrim following
 * the sheet. Wider web keeps Bluesky's centred popup.
 */

/** Bluesky's snap-back spring for a cancelled dismiss swipe (ImagePager). */
export const SHEET_SPRING: WithSpringConfig = {
  stiffness: 700,
  damping: 50,
  mass: 1,
}
const EXIT_MS = 200
/** Scrim kept visible above the tallest sheet, as the native page sheet. */
export const DRAWER_TOP_GAP = 48
const SCRIM_OPACITY = 0.8

/** True where a web modal is a bottom drawer (below Bluesky's `mobile` breakpoint). */
export function useIsWebDrawer() {
  return !useBreakpoints().gtMobile
}

/** Dialog.Outer -> Dialog.Inner: whether to draw a drawer, and its exit. */
export const DrawerContext = createContext<{
  isDrawer: boolean
  isClosing: boolean
  onExited: () => void
}>({isDrawer: false, isClosing: false, onExited: () => {}})
DrawerContext.displayName = 'DialogDrawerContext'

export function useDrawerContext() {
  return useContext(DrawerContext)
}

/**
 * The browser keyboard: how far it pushes up from the layout viewport's
 * bottom, and the height left above it (iOS Safari leaves the layout
 * viewport alone and shrinks only the visual one).
 */
function useVisualViewport() {
  const [state, setState] = useState(() => ({
    bottom: 0,
    height: typeof window === 'undefined' ? 0 : window.innerHeight,
  }))
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    // The same numbers keep the same object: a viewport event that moved nothing renders nothing (owner 108).
    const update = () =>
      setState(s => {
        const bottom = Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
        return s.bottom === bottom && s.height === vv.height ? s : {bottom, height: vv.height}
      })
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])
  return state
}

type PointerLike = {
  nativeEvent: {clientY: number; pointerId: number; timeStamp: number}
  currentTarget: unknown
}

/**
 * One drawer: rises on Bluesky's spring, follows a drag on its handle
 * (Reanimated shared values, no React render per frame), and on release
 * closes past 30% of its height or on a downward flick, else springs back.
 * Closing goes through `onRequestClose`, so a form's "Discard changes?"
 * still asks; while it asks the sheet springs back under the prompt.
 * Reduced motion: no slide, a fade in and an instant close.
 */
export function useDrawer({
  enabled,
  onRequestClose,
  isClosing = false,
  onExited,
}: {
  enabled: boolean
  onRequestClose: () => void
  isClosing?: boolean
  onExited?: () => void
}) {
  const reduceMotion = useShouldReduceMotion()
  const {height: windowHeight} = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const viewport = useVisualViewport()
  const animate = enabled && !reduceMotion
  const height = useSharedValue(windowHeight)
  const y = useSharedValue(animate ? windowHeight : 0)
  const drag = useRef<{
    start: number
    last: number
    at: number
    v: number
  } | null>(null)

  /* The rise on mount, and back up when a close is undone by reopening during the exit (audit m26). */
  useEffect(() => {
    if (animate && !isClosing) y.set(withSpring(0, SHEET_SPRING))
  }, [animate, isClosing, y])

  useEffect(() => {
    if (!isClosing || !onExited) return
    if (!animate) return onExited()
    y.set(
      withTiming(height.get(), {duration: EXIT_MS}, () => {
        scheduleOnRN(onExited)
      }),
    )
  }, [isClosing, animate, onExited, y, height])

  const onPointerDown = (e: PointerLike) => {
    if (!enabled || isClosing) return
    ;(e.currentTarget as Element).setPointerCapture?.(e.nativeEvent.pointerId)
    cancelAnimation(y)
    const at = e.nativeEvent.timeStamp
    drag.current = {
      start: e.nativeEvent.clientY - y.get(),
      last: e.nativeEvent.clientY,
      at,
      v: 0,
    }
  }
  const onPointerMove = (e: PointerLike) => {
    const d = drag.current
    if (!d) return
    const {clientY, timeStamp} = e.nativeEvent
    const dt = timeStamp - d.at
    if (dt > 0) d.v = ((clientY - d.last) / dt) * 1000
    d.last = clientY
    d.at = timeStamp
    // A pull upwards gives a little, as the native sheet does.
    const dy = clientY - d.start
    y.set(dy >= 0 ? dy : -Math.sqrt(-dy) * 2)
  }
  const onPointerUp = (e: PointerLike) => {
    const d = drag.current
    drag.current = null
    if (!d) return
    // A finger that stopped before letting go is not a flick.
    const v = e.nativeEvent.timeStamp - d.at > 100 ? 0 : d.v
    const dy = y.get()
    const close = shouldDismissDrawer({dy, height: height.get(), velocity: v})
    const back = reduceMotion ? 0 : withSpring(0, SHEET_SPRING)
    if (close) {
      onRequestClose()
      // Closing restarts `y` toward the bottom; otherwise (a prompt asks first) it returns.
      y.set(reduceMotion ? 0 : withDelay(50, withSpring(0, SHEET_SPRING)))
    } else {
      y.set(back)
    }
  }

  const sheetStyle = useAnimatedStyle(() =>
    enabled ? {transform: [{translateY: y.get()}]} : {},
  )
  const scrimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      y.get(),
      [0, height.get()],
      [SCRIM_OPACITY, 0],
      Extrapolation.CLAMP,
    ),
  }))

  return {
    reduceMotion,
    sheetStyle,
    scrimStyle,
    onLayout: (e: {nativeEvent: {layout: {height: number}}}) =>
      height.set(e.nativeEvent.layout.height),
    /** The moving frame: pinned to the bottom edge, above the keyboard. */
    frameStyle: web({
      position: 'fixed',
      left: 0,
      right: 0,
      bottom: viewport.bottom,
      maxHeight: viewport.height - DRAWER_TOP_GAP,
      display: 'flex',
      flexDirection: 'column',
    }),
    /** The sheet in the frame: full width, rounded on top, clear of the home indicator. */
    sheetFrameStyle: web({
      width: '100%',
      maxWidth: '100%',
      margin: 0,
      flexShrink: 1,
      minHeight: 0,
      display: 'flex',
      flexDirection: 'column',
      borderWidth: 0,
      borderTopWidth: 1,
      borderRadius: 0,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingBottom: viewport.bottom > 0 ? 0 : insets.bottom,
    }),
    handleProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
    },
  }
}

/** The native sheet's grabber; dragging it moves the sheet. */
export function DrawerHandle({
  handleProps,
}: {
  handleProps: ReturnType<typeof useDrawer>['handleProps']
}) {
  const t = useTheme()
  return (
    <View
      testID="dialog-handle"
      aria-hidden
      // RN Web passes pointer events through to the DOM.
      {...(handleProps as object)}
      style={[
        a.absolute,
        a.z_10,
        {top: 0, left: '50%', marginLeft: -48, width: 96, height: 24},
        web({touchAction: 'none', cursor: 'grab', userSelect: 'none'}),
      ]}>
      <View
        style={[
          a.rounded_sm,
          {
            top: tokens.space._2xl / 2 - 2.5,
            width: 35,
            height: 5,
            alignSelf: 'center',
            backgroundColor: t.palette.contrast_975,
            opacity: 0.5,
          },
        ]}
      />
    </View>
  )
}

/** The scrim behind a drawer: fades in with the rise and out as it is dragged away. */
export function DrawerScrim({
  scrimStyle,
  reduceMotion,
}: {
  scrimStyle: ReturnType<typeof useDrawer>['scrimStyle']
  reduceMotion: boolean
}) {
  const t = useTheme()
  return (
    <View
      pointerEvents="none"
      style={[a.fixed, a.inset_0, !reduceMotion ? undefined : a.fade_in]}>
      <Animated.View
        style={[
          a.absolute,
          a.inset_0,
          {backgroundColor: t.palette.black},
          scrimStyle,
        ]}
      />
    </View>
  )
}
