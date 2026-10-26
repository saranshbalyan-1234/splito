/** A slow release this far down (of the sheet's height) closes it. */
const DISMISS_FRACTION = 0.3
/** Releases faster than this (px/s) are decided by direction instead of distance. */
const DISMISS_VELOCITY = 500

/**
 * Whether a phone drawer released `dy` px below its resting place (of
 * `height`), moving at `velocity` px/s (> 0 downwards), should close.
 */
export function shouldDismissDrawer({
  dy,
  height,
  velocity,
}: {
  dy: number
  height: number
  velocity: number
}) {
  return Math.abs(velocity) > DISMISS_VELOCITY
    ? velocity > 0
    : dy > height * DISMISS_FRACTION
}
