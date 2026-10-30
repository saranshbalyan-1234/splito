// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/screens/Notifications/components/PageList.tsx (SectionHeader, getBorderColor)
import {View} from 'react-native'
import {type LocalDate} from '@splito/domain'

import {atoms as a, type Theme, useTheme} from '#/alf'
import {Text} from '#/components/Typography'
import {useDayLabel} from '#/locale/useDates'

/**
 * The colour of a border between rows: Bluesky's unread colour when it
 * borders an unread row. `side` picks one border of a view with two.
 */
export function getBorderColor(
  t: Theme,
  isUnread: boolean,
  side?: 'top' | 'bottom',
) {
  const borderColor = isUnread
    ? t.palette.primary_100
    : t.atoms.border_contrast_low.borderColor
  switch (side) {
    case 'top':
      return {borderTopColor: borderColor}
    case 'bottom':
      return {borderBottomColor: borderColor}
    default:
      return {borderColor}
  }
}

/**
 * A day's header, as Bluesky heads its notifications with "Today" and
 * "Earlier": Today, Yesterday, the weekday within the week, then the date.
 */
export function SectionHeader({
  day,
  isFirst,
  isUnreadAbove,
  isUnreadBelow,
}: {
  /** The calendar day (`YYYY-MM-DD`, in the Timezone preference). */
  day: LocalDate
  isFirst: boolean
  isUnreadAbove: boolean
  isUnreadBelow: boolean
}) {
  const t = useTheme()
  const dayLabel = useDayLabel()

  return (
    <View
      style={[
        a.px_lg,
        isFirst
          ? a.py_sm
          : [
              a.border_t,
              a.pt_md,
              a.pb_sm,
              getBorderColor(t, isUnreadAbove, 'top'),
            ],
        a.border_b,
        getBorderColor(t, isUnreadBelow, 'bottom'),
      ]}>
      <Text
        testID="activity-day-header"
        accessibilityRole="header"
        style={[a.text_sm, a.font_semi_bold, t.atoms.text_contrast_medium]}>
        {dayLabel(day)}
      </Text>
    </View>
  )
}
