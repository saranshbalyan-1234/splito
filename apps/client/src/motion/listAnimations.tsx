import {createContext, useContext, useLayoutEffect, useState} from 'react'
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  LinearTransition,
  ReduceMotion,
} from 'react-native-reanimated'

import {native} from '#/alf'
import {useShouldReduceMotion} from '#/motion/useShouldReduceMotion'

/* Bluesky's list idiom: fade rows in and out, and on native let siblings glide into place. */
const EASE_OUT = Easing.out(Easing.cubic)

/** Row appearing (new expense, new person). */
export const LIST_ENTERING = FadeIn.duration(200).easing(EASE_OUT)
/** Row leaving (delete, hide, filter). */
export const LIST_EXITING = FadeOut.duration(150)
/**
 * Siblings moving after an insert, delete or reorder. Native only, as
 * upstream does (`native(LinearTransition)`): layout transitions on web
 * fight the browser's own layout.
 */
export const LIST_LAYOUT = native(
  LinearTransition.duration(250).easing(EASE_OUT),
)

/*
 * A screen that is leaving must not run its rows' exit animations (owner 189). On web Reanimated starts each row's
 * exit when the row unmounts: it clones the node and forces a layout per row, so a page of 60 rows popping cost
 * 130 ms of one blocked frame (a tab switch used to cost 600 ms the same way, F-255). Reanimated's own
 * `LayoutAnimationConfig skipExiting` (which the lists use) is a no-op on web (`JSReanimated.setShouldAnimateExitingForTag`),
 * and on native the exit is configured when the row mounts, so this matters on web only. `ScreenExitScope` wraps every
 * screen (`Layout.Screen`) and every web sheet, popup and composer (`OpenedProvider`) once; their rows read their
 * `exiting` from this context. The config's
 * `reduceMotionV`, which Reanimated reads at unmount (`getReducedMotionFromConfig`), is live: it says "always" once
 * the scope itself is unmounting. A parent's layout-effect cleanup runs before its children's componentWillUnmount, so
 * the flag is set before the first row looks. A row deleted while its screen stays is unaffected.
 */
function makeScreenExiting() {
  let isLeaving = false
  const config = FadeOut.duration(150)
  Object.defineProperty(config, 'reduceMotionV', {
    get: () => (isLeaving ? ReduceMotion.Always : ReduceMotion.System),
    set: () => {},
  })
  return {config, setLeaving: (v: boolean) => void (isLeaving = v)}
}

const ScreenExitingContext = createContext<typeof LIST_EXITING>(LIST_EXITING)

/** Wraps one screen: its rows skip their exit animations when the whole screen goes. */
export function ScreenExitScope({children}: {children: React.ReactNode}) {
  const [exiting] = useState(makeScreenExiting)
  /* The set-up half is for StrictMode, which runs a cleanup and re-runs the effect in development. */
  useLayoutEffect(() => {
    exiting.setLeaving(false)
    return () => exiting.setLeaving(true)
  }, [exiting])
  return (
    <ScreenExitingContext.Provider value={exiting.config}>
      {children}
    </ScreenExitingContext.Provider>
  )
}

/** `exiting` for a row that leaves with its list but not with its screen. */
export function useScreenExiting() {
  return useContext(ScreenExitingContext)
}

/**
 * Props for an `Animated.View` row: `<Animated.View {...useListAnimations()}>`.
 * Every field is undefined under reduce motion (OS or the Animations
 * preference), so rows simply appear and disappear.
 */
export function useListAnimations() {
  const shouldReduceMotion = useShouldReduceMotion()
  const exiting = useScreenExiting()
  if (shouldReduceMotion)
    return {entering: undefined, exiting: undefined, layout: undefined}
  return {entering: LIST_ENTERING, exiting, layout: LIST_LAYOUT}
}

/**
 * A row for code that builds rows in a hook or helper above the screen's own tree (`useInviteLinkRows` runs in the
 * screen component, outside its `ScreenExitScope`): the animation props are read here, inside the scope.
 */
export function AnimatedListRow(props: React.ComponentProps<typeof Animated.View>) {
  return <Animated.View {...useListAnimations()} {...props} />
}
