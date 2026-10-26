/** Owner rule (ARCHITECTURE 26.8): a sheet closes past ~30% of its height... */
const DISMISS_FRACTION = 0.3
/** ...or on a downward flick (px per ms, about 1000 px/s, as iOS sheets judge it)... */
const FLICK_VELOCITY = 0.8
/** ...but never from a twitch shorter than this. */
const MIN_FLICK_DY = 24

/**
 * Whether a drag that moved the sheet down by `dy` px (of `height`) and
 * ended at `velocity` px/ms should close it. Native sheets get this from the
 * bottom-sheet module; phone-width web uses it for its own drag.
 */
export function shouldDismissSheet({
  dy,
  height,
  velocity,
}: {
  dy: number
  height: number
  velocity: number
}) {
  if (dy <= 0 || height <= 0) return false
  if (dy > height * DISMISS_FRACTION) return true
  return dy >= MIN_FLICK_DY && velocity >= FLICK_VELOCITY
}
