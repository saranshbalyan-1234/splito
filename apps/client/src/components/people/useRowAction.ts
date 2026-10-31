import {useRef} from 'react'
import {useLingui} from '@lingui/react/macro'

import {useHaptics} from '#/lib/haptics'
import {logger} from '#/logger'
import * as Toast from '#/components/Toast'

/** One write at a time per row, from the first tap; a failure is logged and told. Shared by every request row (friend and group). */
export function useRowAction() {
  const {t: l} = useLingui()
  const haptics = useHaptics()
  const busy = useRef(false)
  return async (where: string, fn: () => Promise<void>) => {
    if (busy.current) return
    busy.current = true
    try {
      await fn()
    } catch (e) {
      haptics.error()
      logger.error(e, {where})
      Toast.show(l`That didn’t work. Please try again.`, {type: 'error'})
    } finally {
      busy.current = false
    }
  }
}
