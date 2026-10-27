import {useRef} from 'react'

/**
 * Single flight from the first tap (ARCHITECTURE section 10): while `fn` is
 * running a second call is ignored. A ref closes synchronously, unlike a
 * `disabled` prop, which only applies after a render (audit m30d: Enter twice
 * made two friends).
 */
export function useSingleFlight() {
  const isBusy = useRef(false)
  return async function runOnce(fn: () => Promise<void>) {
    if (isBusy.current) return
    isBusy.current = true
    try {
      await fn()
    } finally {
      isBusy.current = false
    }
  }
}
