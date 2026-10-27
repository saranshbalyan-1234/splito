import {View} from 'react-native'
import {useLingui} from '@lingui/react/macro'
import {type RowSync} from '@splito/sync'

import {ROW_STATUS_TONE, type RowStatusKind, rowStatusKind} from '#/lib/sync/rowStatus'
import {useSession} from '#/state/session'
import {device, useStorage} from '#/storage'
import {atoms as a, useTheme} from '#/alf'
import {Text} from '#/components/Typography'

type Status = Pick<RowSync, 'syncStatus'>

/** The state's words and the dot's colour, from the one place that decides both (so rows, pages and the avatar never disagree). */
export function useRowStatus(row: Status) {
  const t = useTheme()
  const {t: l} = useLingui()
  const {hasSession} = useSession()
  const kind = rowStatusKind(row.syncStatus, hasSession)
  const labels: Record<RowStatusKind, string> = {
    local: l`On this device only`,
    device: l`Saved on this device`,
    waiting: l`Waiting to sync`,
    syncing: l`Syncing`,
    synced: l`Synced`,
    attention: l`Needs attention`,
  }
  const tone = ROW_STATUS_TONE[kind]
  const color = tone === 'positive' ? t.palette.positive_600 : tone === 'warning' ? t.palette.yellow : t.palette.negative_500
  return {kind, label: labels[kind], color}
}

/**
 * The subtle marker on a list row (ARCHITECTURE 9.8): a small dot in the
 * avatar dot's colours. Colour is never alone: it is announced with the
 * state's words, and "Needs attention" is also written out.
 */
export function SyncDot({row, testID = 'sync-dot'}: {row: Status; testID?: string}) {
  const status = useRowStatus(row)
  const [isShown = true] = useStorage(device, ['showSyncStatus'])
  // A refused row always says so; the preference only quiets the routine dots.
  if (!isShown && status.kind !== 'attention') return null
  const dot = (
    <View
      testID={testID}
      role="img"
      accessibilityLabel={status.label}
      aria-label={status.label}
      // `title` gives web a hover tooltip; native ignores it.
      {...({title: status.label} as object)}
      style={[a.flex_shrink_0, a.rounded_full, {width: 7, height: 7, backgroundColor: status.color, opacity: status.kind === 'synced' ? 0.9 : 0.75}]}
    />
  )
  // A refused row says so in words (ARCHITECTURE 9.5): a one-line tag, never a bare colour.
  return status.kind === 'attention' ? (
    <View style={[a.flex_row, a.align_center, a.gap_xs, a.flex_shrink_0]}>
      {dot}
      <Text style={[a.text_xs, a.font_semi_bold, {color: status.color}]}>{status.label}</Text>
    </View>
  ) : (
    dot
  )
}

/** A dot with the state in words, for a detail page. The line keeps its height, so nothing jumps when the state changes. */
export function SyncStatusLine({row, testID = 'sync-status'}: {row: Status; testID?: string}) {
  const t = useTheme()
  const status = useRowStatus(row)
  return (
    <View testID={testID} style={[a.flex_row, a.align_center, a.gap_xs]}>
      <View style={[a.flex_shrink_0, a.rounded_full, {width: 8, height: 8, backgroundColor: status.color}]} />
      <Text
        testID={`${testID}-label`}
        numberOfLines={1}
        style={[a.text_sm, a.font_semi_bold, a.leading_snug, status.kind === 'attention' ? {color: status.color} : t.atoms.text_contrast_medium]}>
        {status.label}
      </Text>
    </View>
  )
}
