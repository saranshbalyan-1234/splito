/** Where a pull gesture's numbers come from; pure, so they are unit tested (pullMath.test.ts). */

/** The pull distance (px) at which letting go refreshes. */
export const THRESHOLD = 64
/** The farthest the content follows the finger. */
export const MAX_PULL = 128
/** Where the content rests while refreshing. */
export const HOLD = 56
/** Movement before the direction is decided. */
export const SLOP = 4

/** The content follows the finger at 0.6 and stops at `MAX_PULL`. */
export const pullDistance = (fingerDy: number) => Math.max(0, Math.min(MAX_PULL, fingerDy * 0.6))

/** A gesture pulls only when it starts moving down, more down than sideways; anything else is a normal scroll or swipe. */
export function intent(dx: number, dy: number): 'pending' | 'pull' | 'ignore' {
  if (Math.abs(dx) < SLOP && Math.abs(dy) < SLOP) return 'pending'
  return dy > 0 && dy > Math.abs(dx) ? 'pull' : 'ignore'
}
