import {View} from 'react-native'

import {type DisputeStatus} from '@splito/sync'

import {atoms as a, useTheme, utils} from '#/alf'
import {Text} from '#/components/Typography'
import {AcceptedIcon, DisputedIcon, GoneIcon, HoldIcon, RejectedIcon, ReleaseIcon, WithdrawnIcon} from './icons'
import {useDisputeWords} from './words'

/**
 * The amber "Disputed" / "On hold" mark on a row, a detail page or a bill item (26.20): an icon and the word, never
 * colour alone. A closed state (`status` other than open) uses the quiet grey form, for the record's dispute list.
 */
export function DisputeBadge({
  kind,
  status = 'open',
  testID,
  compact = false,
}: {
  kind: 'dispute' | 'hold'
  status?: DisputeStatus
  testID?: string
  /** Smaller type, for a row's byline. */
  compact?: boolean
}) {
  const t = useTheme()
  const words = useDisputeWords()
  const isOpen = status === 'open'
  const Icon = isOpen
    ? kind === 'hold'
      ? HoldIcon
      : DisputedIcon
    : { accepted: AcceptedIcon, rejected: RejectedIcon, withdrawn: WithdrawnIcon, released: ReleaseIcon, gone: GoneIcon, open: DisputedIcon }[status]
  const label = words.status(status, kind)
  const tint = isOpen ? t.palette.yellow : t.atoms.text_contrast_medium.color
  return (
    <View
      testID={testID}
      accessibilityLabel={label}
      style={[
        a.flex_row,
        a.align_center,
        a.self_start,
        a.flex_shrink_0,
        a.rounded_full,
        {
          gap: 4,
          paddingHorizontal: compact ? 6 : 8,
          paddingVertical: compact ? 1 : 3,
          backgroundColor: isOpen ? utils.alpha(t.palette.yellow, t.scheme === 'light' ? 0.22 : 0.2) : t.atoms.bg_contrast_50.backgroundColor,
        },
      ]}>
      <Icon size="xs" fill={tint} />
      {/* The word stays in the normal text colour so it keeps its contrast on the amber wash in every theme. */}
      <Text style={[compact ? a.text_xs : a.text_sm, a.font_semi_bold, a.leading_tight]}>{label}</Text>
    </View>
  )
}
