/*
 * The stack slide on phone-width web (owner 227, ARCHITECTURE 26.3; F-277): a push slides the new page in from the
 * right, a Back slides the page underneath back in from the left. Like the tab slide (tabSlide.ts) it is CSS on the
 * focused screen's root (`data-stack-in`, index.html), run by the compositor: no JS per frame, no React render, and the
 * page that left is never kept for an exit (react-navigation hides it at once, ARCHITECTURE 17.1).
 *
 * Which way the stack moved is read from the root state when a screen gains focus, against the state the last focused
 * screen saw: the focused route is new and the old one is still below it -> push; the focused route was below the old
 * one and the old one is gone -> pop. This covers in-app pushes, `goBack`, `navigate` back down the stack and the
 * browser's Back and Forward (react-navigation resets to the recorded state, same keys), with one rule. Tab switches
 * are not stack moves (a bar press is noted, tabSlide.ts), and overlay routes (the composers, `Sheet` markers: the
 * page stays drawn under them) are neither side of one.
 */
import {type NavigationState} from '@react-navigation/native'

export type StackMotion = 'push' | 'pop'

/** The root stack as a screen saw it when it gained focus. */
export type StackSnapshot = {keys: readonly string[]; index: number}

/** Routes drawn over the page beneath (COMPOSER_WEB in Navigation.tsx): never slid, and leaving one is no Back. */
export const OVERLAY_ROUTES: ReadonlySet<string> = new Set([
  'Sheet',
  'AddExpense',
  'EditExpense',
  'AddFriend',
  'CreateInvite',
  'ShareInvite',
  'CreateGroup',
])

/** The card routes of a root state, in order (overlays left out), and which of them is focused. */
export function snapshotOf(
  state: Pick<NavigationState, 'routes' | 'index'> | undefined,
): StackSnapshot | undefined {
  if (!state) return undefined
  const focused = state.routes[state.index]
  if (!focused || OVERLAY_ROUTES.has(focused.name)) return undefined
  const cards = state.routes
    .slice(0, state.index + 1)
    .filter(r => !OVERLAY_ROUTES.has(r.name))
  return {keys: cards.map(r => r.key), index: cards.length - 1}
}

/** How the stack moved between two snapshots, if it moved like a stack (not a reset, replace or first load). */
export function stackMotion(
  prev: StackSnapshot | undefined,
  now: StackSnapshot | undefined,
): StackMotion | undefined {
  if (!prev || !now) return undefined
  const nowKey = now.keys[now.index]!
  const prevKey = prev.keys[prev.index]!
  if (nowKey === prevKey) return undefined
  const wasAt = prev.keys.indexOf(nowKey)
  if (wasAt < 0) {
    /* New on top, with the page it was opened from still below it. */
    const leftAt = now.keys.indexOf(prevKey)
    return leftAt >= 0 && leftAt < now.index ? 'push' : undefined
  }
  /* Back down to a page that was below, and the page on top went away. */
  return wasAt < prev.index && !now.keys.includes(prevKey) ? 'pop' : undefined
}

/*
 * The browser's own swipe (iOS Safari's left-edge Back, its right-edge Forward) slides its snapshot of the page
 * already, so the Back it makes must not slide again (owner 216). No event says a history move came from a swipe, so:
 * a touch that starts within EDGE_PX of a side and then either is cancelled (the browser took the gesture) or moves
 * more than MOVE_PX away from that side is a browser swipe; a history move during it or within GRACE_MS of its end
 * is not animated. A tap near the edge (the header avatar and Back button sit 16 px in) moves less and keeps its slide.
 * A cancelled touch keeps the mark longer (CANCEL_GRACE_MS): after Safari takes the touch the finger may still be
 * dragging the snapshot. ponytail: a heuristic; a slower drag than that animates once more, never less.
 */
const EDGE_PX = 24
const MOVE_PX = 10
const GRACE_MS = 700
const CANCEL_GRACE_MS = 2000

type EdgeTouch = {
  startX: number
  side: 'l' | 'r'
  isSwipe: boolean
  endedAt?: number
  grace: number
}
let edge: EdgeTouch | undefined

/** Pure parts of the heuristic, for tests. */
export function edgeSide(x: number, width: number): 'l' | 'r' | undefined {
  if (x <= EDGE_PX) return 'l'
  if (x >= width - EDGE_PX) return 'r'
  return undefined
}

export function noteTouchStart(x: number, width: number, touches = 1) {
  const side = touches === 1 ? edgeSide(x, width) : undefined
  edge = side ? {startX: x, side, isSwipe: false, grace: GRACE_MS} : undefined
  if (edge) addMove()
}

export function noteTouchMove(x: number) {
  if (!edge || edge.endedAt !== undefined) return
  const away = edge.side === 'l' ? x - edge.startX : edge.startX - x
  if (away > MOVE_PX) edge.isSwipe = true
}

export function noteTouchEnd(isCancel: boolean, now = Date.now()) {
  removeMove()
  if (!edge || edge.endedAt !== undefined) return
  if (isCancel) {
    edge.isSwipe = true
    edge.grace = CANCEL_GRACE_MS
  }
  edge.endedAt = now
}

/** Is a browser swipe under way, or just over: the history move it made was already animated by the browser. */
export function isBrowserSwipe(now = Date.now()): boolean {
  if (!edge?.isSwipe) return false
  return edge.endedAt === undefined || now - edge.endedAt <= edge.grace
}

/* The move listener is on only while an edge touch is down, so a touch elsewhere runs no code of ours. */
const onMove = (e: TouchEvent) => {
  const t = e.touches[0]
  if (t) noteTouchMove(t.clientX)
}
let isMoveOn = false
function addMove() {
  if (isMoveOn || typeof window === 'undefined') return
  isMoveOn = true
  window.addEventListener('touchmove', onMove, {passive: true, capture: true})
}
function removeMove() {
  if (!isMoveOn) return
  isMoveOn = false
  window.removeEventListener('touchmove', onMove, {capture: true})
}

let isWatching = false
function watchEdgeTouches() {
  if (isWatching || typeof window === 'undefined') return
  isWatching = true
  const opts = {passive: true, capture: true} as const
  window.addEventListener(
    'touchstart',
    e => {
      const t = e.touches[0]
      if (t) noteTouchStart(t.clientX, window.innerWidth, e.touches.length)
    },
    opts,
  )
  window.addEventListener('touchend', () => noteTouchEnd(false), opts)
  window.addEventListener('touchcancel', () => noteTouchEnd(true), opts)
}

let last: StackSnapshot | undefined

/** Resets the module (tests). */
export function resetStackSlide() {
  last = undefined
  edge = undefined
}

/**
 * Called by the screen that gains focus (web), with the root state now: the stack slide it should play, if any.
 * It always records the state, so the next screen compares against this one.
 */
export function takeStackSlide({
  state,
  isTabSwitch,
  isPhoneWidth,
  now = Date.now(),
}: {
  state: Pick<NavigationState, 'routes' | 'index'> | undefined
  isTabSwitch: boolean
  /** Under 800 px: rail and desktop stay instant, as Bluesky (the CSS sits behind the same width). */
  isPhoneWidth: boolean
  now?: number
}): StackMotion | undefined {
  watchEdgeTouches()
  const snap = snapshotOf(state)
  const motion = stackMotion(last, snap)
  if (snap) last = snap
  if (!motion || isTabSwitch || !isPhoneWidth || isBrowserSwipe(now))
    return undefined
  return motion
}
