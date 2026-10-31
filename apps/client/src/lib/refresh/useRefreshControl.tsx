import {useState} from 'react'
import {RefreshControl} from 'react-native'

import {useRefreshHandler} from '#/state/refresh/useRefreshHandler'
import {useTheme} from '#/alf'

/**
 * Bluesky's `RefreshControl` for a List or scroll view (iOS bounce, Android material spinner), shared so the two do
 * not each build one. It refreshes through `useRefreshHandler` unless the caller passes its own `onRefresh`, and
 * tracks the spinner itself unless it passes `refreshing`. The header is outside the scroll view, so it never moves.
 * `enabled` is false inside dialogs and sheets, where a pull down closes the sheet instead (ARCHITECTURE 26.8).
 */
export function useRefreshControl({
  enabled = true,
  refreshing,
  onRefresh,
  progressViewOffset,
}: {
  enabled?: boolean
  refreshing?: boolean
  onRefresh?: () => void
  progressViewOffset?: number
}) {
  const t = useTheme()
  const [busy, setBusy] = useState(false)
  const run = useRefreshHandler(onRefresh)
  if (!enabled) return undefined
  return (
    <RefreshControl
      key={t.atoms.text.color}
      refreshing={refreshing ?? busy}
      onRefresh={() => {
        setBusy(true)
        run().finally(() => setBusy(false))
      }}
      tintColor={t.atoms.text.color}
      titleColor={t.atoms.text.color}
      progressViewOffset={progressViewOffset}
    />
  )
}
