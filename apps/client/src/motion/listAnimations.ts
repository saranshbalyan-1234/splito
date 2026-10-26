import {
  Easing,
  FadeIn,
  FadeOut,
  LinearTransition,
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

/**
 * Props for an `Animated.View` row: `<Animated.View {...useListAnimations()}>`.
 * Every field is undefined under reduce motion (OS or the Animations
 * preference), so rows simply appear and disappear.
 */
export function useListAnimations() {
  const shouldReduceMotion = useShouldReduceMotion()
  if (shouldReduceMotion)
    return {entering: undefined, exiting: undefined, layout: undefined}
  return {entering: LIST_ENTERING, exiting: LIST_EXITING, layout: LIST_LAYOUT}
}
