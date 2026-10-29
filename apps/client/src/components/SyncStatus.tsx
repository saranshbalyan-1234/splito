import {Trans, useLingui} from '@lingui/react/macro'
import {type RowSync, type RowSyncStatus} from '@splito/sync'

import {type RowStatusKind, rowStatusKind} from '#/lib/sync/rowStatus'
import {useSession} from '#/state/session'
import {atoms as a, useTheme} from '#/alf'
import {Text} from '#/components/Typography'

type Status = Pick<RowSync, 'syncStatus'>

/** The state's words, from the one place that decides them (so pages and the avatar never disagree). */
export function useRowStatus(row: Status) {
  const {t: l} = useLingui()
  const {canSync} = useSession()
  const kind = rowStatusKind(row.syncStatus, canSync)
  const labels: Record<RowStatusKind, string> = {
    local: l`On this device only`,
    device: l`Saved on this device`,
    waiting: l`Waiting to sync`,
    syncing: l`Syncing`,
    synced: l`Synced`,
    attention: l`Needs attention`,
  }
  return {kind, label: labels[kind]}
}

/**
 * A refused row says so in words (ARCHITECTURE 9.5, 9.8): the one marker a row
 * still carries. Unsynced rows are drawn lighter instead of dotted (decision
 * 111), so a row that is merely waiting shows nothing here.
 */
export function NeedsAttention({status, testID = 'sync-attention'}: {status: RowSyncStatus | undefined; testID?: string}) {
  const t = useTheme()
  if (status !== 'failed') return null
  return (
    <Text testID={testID} style={[a.text_xs, a.font_semi_bold, a.flex_shrink_0, {color: t.palette.negative_500}]}>
      <Trans>Needs attention</Trans>
    </Text>
  )
}

/** The state in words, for a detail page. The line keeps its height, so nothing jumps when the state changes. */
export function SyncStatusLine({row, testID = 'sync-status'}: {row: Status; testID?: string}) {
  const t = useTheme()
  const status = useRowStatus(row)
  return (
    <Text
      testID={`${testID}-label`}
      numberOfLines={1}
      style={[a.text_sm, a.font_semi_bold, a.leading_snug, status.kind === 'attention' ? {color: t.palette.negative_500} : t.atoms.text_contrast_medium]}>
      {status.label}
    </Text>
  )
}
