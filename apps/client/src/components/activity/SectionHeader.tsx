// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/screens/Notifications/components/PageList.tsx (SectionHeader, getBorderColor)
import {View} from 'react-native'
import {useLingui} from '@lingui/react/macro'

import {atoms as a, type Theme, useTheme} from '#/alf'
import {Text} from '#/components/Typography'
import {daysAgo} from './feed'

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
  /** Local midnight of the day. */
  day: number
  isFirst: boolean
  isUnreadAbove: boolean
  isUnreadBelow: boolean
}) {
  const t = useTheme()
  const {t: l, i18n} = useLingui()
  const now = Date.now()
  const ago = daysAgo(day, now)
  const date = new Date(day)
  const label =
    ago === 0
      ? l({message: 'Today', context: 'Activity section header'})
      : ago === 1
        ? l({message: 'Yesterday', context: 'Activity section header'})
        : ago < 7
          ? i18n.date(date, {weekday: 'long'})
          : i18n.date(date, {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
              year:
                date.getFullYear() === new Date(now).getFullYear()
                  ? undefined
                  : 'numeric',
            })

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
      <Text accessibilityRole="header" style={[a.text_md, a.font_bold]}>
        {label}
      </Text>
    </View>
  )
}
