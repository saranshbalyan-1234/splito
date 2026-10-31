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
 * and on native the exit is configured when the row mounts, so this matters on web only. The exit scope wraps every
 * screen (`Layout.Screen`) and every web sheet, popup and composer (`OpenedProvider`) once (`useScreenExitScope`); their rows read their
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

/**
 * The exit scope of one screen, sheet, popup or composer: call it in the component that owns the surface and give its
 * tree `<ScreenExitingProvider value={...}>`; the rows inside skip their exit animations when that component unmounts.
 * A hook and a bare provider, not a wrapper component, so a re-render of the surface renders nothing extra.
 */
export function useScreenExitScope() {
  const [exiting] = useState(makeScreenExiting)
  /* The set-up half is for StrictMode, which runs a cleanup and re-runs the effect in development. */
  useLayoutEffect(() => {
    exiting.setLeaving(false)
    return () => exiting.setLeaving(true)
  }, [exiting])
  return exiting.config
}

/** Provides `useScreenExitScope()`'s config to the surface's rows. */
export const ScreenExitingProvider = ScreenExitingContext.Provider

/** `exiting` for a row that leaves with its list but not with its screen. */
export function useScreenExiting() {
  return useContext(ScreenExitingContext)
}

type RowMotion = {entering: typeof LIST_ENTERING; exiting: typeof LIST_EXITING}

/*
 * A list whose rows a search swaps: typing narrows or widens the list, which is not a change to explain (owner 213), and
 * on web every row a keystroke removed ran Reanimated's exit (a clone of the row plus a scroll read of every node in it,
 * a forced layout each): 46 clones over one 16-key search of the friends list. `hush(query)`, called by the handler that
 * changes the query (before React renders it), makes the rows the next commits remove or add skip their exit and enter;
 * `settle(query)`, once the list shows that query, gives them back, so a delete or a filter's Apply still fades. Settling
 * names the query it showed and does nothing when a newer one was hushed since: a commit's effects can run after the
 * next key's handler (React flushes them before rendering that key), and settling then let the next key's rows fade.
 * The flag is read live, at unmount and mount, as the screen exit scope's is; the leaving screen's own scope still wins.
 */
function makeQuietRows(outer: typeof LIST_EXITING) {
  let isQuiet = false
  let hushedFor: unknown
  const live = (fallback: () => ReduceMotion | undefined) => ({
    get: () => (isQuiet ? ReduceMotion.Always : fallback()),
    set: () => {},
  })
  const entering = FadeIn.duration(200).easing(EASE_OUT)
  const exiting = FadeOut.duration(150)
  Object.defineProperty(entering, 'reduceMotionV', live(() => ReduceMotion.System))
  Object.defineProperty(exiting, 'reduceMotionV', live(() => (outer as {reduceMotionV?: ReduceMotion}).reduceMotionV))
  return {
    entering,
    exiting,
    hush(query: unknown) {
      isQuiet = true
      hushedFor = query
    },
    settle(query: unknown) {
      if (Object.is(query, hushedFor)) isQuiet = false
    },
  }
}

const QuietRowsContext = createContext<RowMotion | null>(null)

/**
 * The quiet-rows scope of one searchable list (`makeQuietRows`): call it in the component that holds the query, hand the
 * result to `<QuietRowsProvider value={...}>` around the list, and call `hush(query)` in the query's change handler and
 * `settle(query)` once the list shows that query.
 */
export function useQuietRows() {
  const outer = useScreenExiting()
  const [rows] = useState(() => makeQuietRows(outer))
  return rows
}

/** Provides `useQuietRows()`'s configs to the list's rows. */
export const QuietRowsProvider = QuietRowsContext.Provider

/**
 * Props for an `Animated.View` row: `<Animated.View {...useListAnimations()}>`.
 * Every field is undefined under reduce motion (OS or the Animations
 * preference), so rows simply appear and disappear.
 */
export function useListAnimations() {
  const shouldReduceMotion = useShouldReduceMotion()
  const exiting = useScreenExiting()
  const quiet = useContext(QuietRowsContext)
  if (shouldReduceMotion)
    return {entering: undefined, exiting: undefined, layout: undefined}
  return {entering: quiet?.entering ?? LIST_ENTERING, exiting: quiet?.exiting ?? exiting, layout: LIST_LAYOUT}
}

/**
 * A row for code that builds rows in a hook or helper above the screen's own tree (`useInviteLinkRows` runs in the
 * screen component, outside its exit scope): the animation props are read here, inside the scope.
 */
export function AnimatedListRow(props: React.ComponentProps<typeof Animated.View>) {
  return <Animated.View {...useListAnimations()} {...props} />
}
