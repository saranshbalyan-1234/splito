/**
 * When has a native screen finished opening (owner 168)? Pure, so the rules are unit-tested; `useScreenOpened`
 * drives it with the navigator's events and real timers.
 *
 * - `transitionEnd` (not closing) after a `transitionStart`: opened.
 * - A screen that never starts a transition (the first tab on a cold start, a tab switched to without animation)
 *   has nothing to wait for: no `transitionStart` within `quietMs` of mount means opened, so the first tab does
 *   not wait out the whole fallback.
 * - Whatever happens, `fallbackMs` after mount: opened.
 */
export type Timers = {
  set(cb: () => void, ms: number): unknown
  clear(handle: unknown): void
}

export function createOpenedTracker({
  onOpened,
  timers,
  quietMs,
  fallbackMs,
}: {
  onOpened: () => void
  timers: Timers
  quietMs: number
  fallbackMs: number
}) {
  let done = false
  let started = false
  const open = () => {
    if (done) return
    done = true
    timers.clear(quiet)
    timers.clear(fallback)
    onOpened()
  }
  const quiet = timers.set(() => {
    if (!started) open()
  }, quietMs)
  const fallback = timers.set(open, fallbackMs)
  return {
    transitionStart() {
      started = true
      timers.clear(quiet)
    },
    transitionEnd(closing: boolean) {
      if (!closing) open()
    },
    dispose() {
      done = true
      timers.clear(quiet)
      timers.clear(fallback)
    },
  }
}
