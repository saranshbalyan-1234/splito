/**
 * Press-in activation for idempotent navigation (the bottom bar's tab links, owner 150): the page switches when the
 * finger lands, and the click that follows the same press must not switch it again. Pure, so the rules are tested.
 */

/** A click this soon after a press-in that already acted is that press's own release. */
export const PRESS_IN_CLICK_WINDOW_MS = 1000

type PressLike = {
  metaKey?: boolean
  ctrlKey?: boolean
  shiftKey?: boolean
  altKey?: boolean
  button?: number
}

/**
 * Whether a press may act in place: a plain primary press. A Cmd / Ctrl / Shift / Alt press or a middle or right
 * button keeps the browser's own behaviour (a new tab), which only a click path handles.
 */
export function isPlainPrimaryPress(e: PressLike) {
  return !(e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) && (e.button ?? 0) === 0
}

/**
 * Remembers when a press-in acted. The release's click is swallowed only inside the window, then forgotten, so a
 * click that is not the release of that press (the keyboard's Enter, a screen reader's activate, a press that was
 * cancelled or dragged off) is never swallowed.
 */
export function createPressInGate(now: () => number = () => Date.now()) {
  let at = Number.NEGATIVE_INFINITY
  return {
    acted() {
      at = now()
    },
    swallowsClick() {
      const hit = now() - at < PRESS_IN_CLICK_WINDOW_MS
      at = Number.NEGATIVE_INFINITY
      return hit
    },
  }
}
