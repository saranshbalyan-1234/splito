// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/lib/hooks/useDedupe.ts
import {useCallback, useRef} from 'react'

export function useDedupe(timeout = 250) {
  const canDo = useRef(true)

  return useCallback(
    (cb: () => unknown) => {
      if (canDo.current) {
        canDo.current = false
        setTimeout(() => {
          canDo.current = true
        }, timeout)
        cb()
        return true
      }
      return false
    },
    [timeout],
  )
}
