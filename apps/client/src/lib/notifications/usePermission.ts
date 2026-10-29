import {useCallback, useEffect, useState} from 'react'
import {AppState} from 'react-native'

import {getPermission, requestPermission} from '#/lib/notifications'
import {type PermissionState} from '#/lib/notifications/types'

/**
 * The notification permission, read without asking (undefined while it loads) and re-read when the app
 * returns to the foreground (the person may have changed it in Settings). `ask` shows the OS prompt: call
 * it only from Splito's own primer, at the moment a feature needs it, never at launch (F-216).
 */
export function useNotificationPermission() {
  const [state, setState] = useState<PermissionState | undefined>()
  const refresh = useCallback(() => void getPermission().then(setState), [])
  useEffect(() => {
    refresh()
    const sub = AppState.addEventListener('change', s => s === 'active' && refresh())
    return () => sub.remove()
  }, [refresh])
  const ask = useCallback(async () => {
    const next = await requestPermission()
    setState(next)
    return next
  }, [])
  return {state, ask, refresh}
}
