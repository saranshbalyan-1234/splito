import {
  createContext,
  startTransition,
  useContext,
  useDeferredValue,
  useEffect,
  useState,
} from 'react'
/**
 * Whether what the body sits in has finished opening: a sheet's rise, a popup's scale-in, the drawer's slide.
 * `false` while it moves, `true` once it stopped; `undefined` outside anything that opens (a tab, a page), where
 * the hook falls back to the screen's own transition or two frames. Dialogs and the drawer provide it from their
 * real end-of-motion signal (ARCHITECTURE 26.9, owner 168), so a heavy body never mounts under the motion.
 */
export const OpenedContext = createContext<boolean | undefined>(undefined)
OpenedContext.displayName = 'OpenedContext'

/** A safety for a platform that never reports the end of the motion: the body still mounts. */
export const OPENED_FALLBACK_MS = 700

/**
 * False until the thing this is in has opened, then true (ARCHITECTURE 26.9
 * owners 151/152/168: shell first, content later). The header, bar or sheet
 * shell paints and moves at once; a heavy body waits for this and fills in as
 * a React transition, so it yields to taps instead of queuing them. Stays true
 * once set (a tab that stays mounted does not defer again). Use `<Deferred>`
 * rather than calling this in each screen.
 *
 * The signal, in order: an `opened` argument or the nearest `OpenedContext`
 * (sheets, popups, the drawer, and on native every screen: `Layout.Screen`
 * provides the navigator's `transitionEnd`); otherwise two animation frames
 * (web tabs and pages do not animate, so there is no motion to wait for).
 */
export function useAfterTransition(opened?: boolean) {
  const [ready, setReady] = useState(false)
  const fromContext = useContext(OpenedContext)
  const signal = opened ?? fromContext
  const go = signal ?? true
  useEffect(() => {
    if (!go) return
    let second = 0
    // With a real end-of-motion signal one frame is enough: the motion's last frame paints first.
    const frames = signal === undefined ? 2 : 1
    const first = requestAnimationFrame(() => {
      if (frames === 1) startTransition(() => setReady(true))
      else
        second = requestAnimationFrame(() =>
          startTransition(() => setReady(true)),
        )
    })
    return () => {
      cancelAnimationFrame(first)
      cancelAnimationFrame(second)
    }
  }, [go, signal])
  return ready
}

/**
 * Whether a screen's heavy body may render: `flag` (its data is there) AND the
 * thing it is in has opened. Data that lands later is deferred, so the body
 * mounts as an interruptible transition and a tap in the meantime is handled
 * first; data that goes away is not: `flag` false is false in the same render
 * (a body must never draw rows of data that is gone), so only the rising edge
 * lags. Screens swap their skeleton for the body on this, not on `flag`.
 */
export function useDeferredReady(flag = true, opened?: boolean) {
  const afterFrame = useAfterTransition(opened)
  const deferred = useDeferredValue(flag)
  return afterFrame && flag && deferred
}
