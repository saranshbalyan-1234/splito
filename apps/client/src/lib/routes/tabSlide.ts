/*
 * The main-tab slide (owner 174, § 26.9): a bar tap notes which way it moves (along the bar's own order), and the
 * screen that gains focus next takes it once. The slide itself is CSS on web (index.html, `data-tab-in`), run by the
 * compositor: no JS per frame, no React render (owner 166), and a newer tap shows its screen at once with its own slide
 * (owner 150). Native uses the bottom tabs' 'shift' animation instead.
 */

export type SlideDirection = 'l' | 'r'

/** A note older than this is a tap whose screen never focused (the same tab, a dropped navigation). */
const FRESH_MS = 600

/* A press is noted even without a direction (reduced motion, a tab outside the bar order), so the stack slide
 * (stackSlide.ts) knows a tab switch is not a push or a Back. */
let pending: {direction: SlideDirection | undefined; at: number} | undefined

/** From the tab shown to the tab pressed, in the bar's order: which side the new screen comes in from. */
export function slideDirection(order: readonly string[], from: string | undefined, to: string): SlideDirection | undefined {
  const a = from === undefined ? -1 : order.indexOf(from)
  const b = order.indexOf(to)
  if (a < 0 || b < 0 || a === b) return undefined
  return b > a ? 'r' : 'l'
}

/** Called by the bar on a tab press. */
export function noteTabSlide(direction: SlideDirection | undefined, now = Date.now()) {
  pending = {direction, at: now}
}

/** Called by the screen that gains focus: the bar press that brought it, once (undefined: no fresh press). */
export function takeTabPress(now = Date.now()): {direction: SlideDirection | undefined} | undefined {
  const p = pending
  pending = undefined
  return p && now - p.at <= FRESH_MS ? {direction: p.direction} : undefined
}

/** The slide a focusing screen should play, once. */
export function takeTabSlide(now = Date.now()): SlideDirection | undefined {
  return takeTabPress(now)?.direction
}
