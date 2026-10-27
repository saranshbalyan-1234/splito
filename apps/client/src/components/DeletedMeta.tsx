import {Pressable, View} from 'react-native'
import {plural} from '@lingui/core/macro'
import {useLingui} from '@lingui/react/macro'
import {Clock} from 'lucide-react-native'

import {deletedAge} from '#/lib/deletedAge'
import {useTimeZone} from '#/locale/useDates'
import {useTickEveryMinute} from '#/state/shell'
import {atoms as a, useTheme} from '#/alf'
import {createIcon} from '#/components/icons/lucide'
import * as Toast from '#/components/Toast'
import {Text} from '#/components/Typography'

const ClockIcon = createIcon(Clock)

/**
 * How a deleted record looks wherever it appears (owner 98): its title and amount struck through in the
 * muted text colour (`useStruck`), and this line after them: a small clock and "Deleted 2 hours ago". The
 * exact date and time is the tooltip on web, a long press elsewhere, and part of the accessibility label.
 * Counts and helper lines ("8 records", "27 days left") stay plain.
 */
export function DeletedMeta({
  at,
  testID,
  onPress,
}: {
  at: number
  testID?: string
  /** The row this sits in opens on press; the line must not swallow that tap (it only adds the long press). */
  onPress?: () => void
}) {
  const t = useTheme()
  const {t: l, i18n} = useLingui()
  const tz = useTimeZone()
  const now = useTickEveryMinute()
  const age = deletedAge(at, now)
  const exact = i18n.date(new Date(at), {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: tz,
  })
  const label =
    age.unit === 'now'
      ? l`Deleted just now`
      : age.unit === 'date'
        ? l`Deleted on ${i18n.date(new Date(at), {dateStyle: 'medium', timeZone: tz})}`
        : age.unit === 'minute'
          ? plural(age.value, {one: 'Deleted # minute ago', other: 'Deleted # minutes ago'})
          : age.unit === 'hour'
            ? plural(age.value, {one: 'Deleted # hour ago', other: 'Deleted # hours ago'})
            : age.unit === 'day'
              ? plural(age.value, {one: 'Deleted # day ago', other: 'Deleted # days ago'})
              : plural(age.value, {one: 'Deleted # month ago', other: 'Deleted # months ago'})
  return (
    <Pressable
      testID={testID}
      accessible
      accessibilityRole="text"
      accessibilityLabel={l`Deleted, ${exact}`}
      onPress={onPress}
      onLongPress={() => Toast.show(exact)}
      style={[a.flex_row, a.align_center, a.gap_2xs]}>
      <View testID={testID ? `${testID}-clock` : undefined}>
        <ClockIcon size="xs" fill={t.atoms.text_contrast_medium.color} />
      </View>
      <Text
        title={exact}
        style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
        {label}
      </Text>
    </Pressable>
  )
}

/** The struck-through style of a deleted record's title and amount: a line through muted text. */
export function useStruck() {
  const t = useTheme()
  return [
    {textDecorationLine: 'line-through' as const},
    t.atoms.text_contrast_medium,
  ]
}
