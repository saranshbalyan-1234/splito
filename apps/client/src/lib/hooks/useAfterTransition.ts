import {startTransition, useDeferredValue, useEffect, useState} from 'react'

/**
 * False for a screen's, tab's or sheet's first frame, then true (ARCHITECTURE
 * 26.9 owners 151/152: shell first, content later). The header, bar or sheet
 * shell paints at once; a heavy body waits for this and fills in as a React
 * transition, so it yields to taps instead of queuing them. Stays true once
 * set (a tab that stays mounted does not defer again). Use `<Deferred>`
 * rather than calling this in each screen.
 *
 * ponytail: two animation frames, not the native stack's `transitionEnd`: that
 * event never fires for a tab switch, and the native push runs on the UI
 * thread, so mounting under it only costs JS time, which a transition yields.
 */
export function useAfterTransition() {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    let second = 0
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => startTransition(() => setReady(true)))
    })
    return () => {
      cancelAnimationFrame(first)
      cancelAnimationFrame(second)
    }
  }, [])
  return ready
}

/**
 * Whether a screen's heavy body may render: `flag` (its data is there) AND the
 * first frame has painted. Data that lands later is deferred too, so the body
 * mounts as an interruptible transition and a tap in the meantime is handled
 * first. Screens swap their skeleton for the body on this, not on `flag`.
 */
export function useDeferredReady(flag = true) {
  const afterFrame = useAfterTransition()
  const deferred = useDeferredValue(flag)
  return afterFrame && deferred
}
