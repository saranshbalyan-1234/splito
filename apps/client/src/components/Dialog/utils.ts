// Adapted from bluesky-social/social-app@4e4ad9c (MIT) — src/components/Dialog/utils.ts
import {useEffect} from 'react'

import {type DialogControlProps} from '#/components/Dialog/types'

export function useAutoOpen(control: DialogControlProps, showTimeout?: number) {
  useEffect(() => {
    if (showTimeout) {
      const timeout = setTimeout(() => {
        control.open()
      }, showTimeout)
      return () => {
        clearTimeout(timeout)
      }
    } else {
      control.open()
    }
  }, [control, showTimeout])
}
