// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/components/dms/DateDivider.tsx
import {memo} from 'react'
import {View} from 'react-native'
import {addDays} from '@splito/domain'
import {Trans, useLingui} from '@lingui/react/macro'

import {useTimeZone, useToday} from '#/locale/useDates'
import {atoms as a, useTheme} from '#/alf'
import {Text} from '#/components/Typography'
import {dayKey} from './timeline'

/** "Today at 4:15 PM", "Yesterday at ...", a weekday within the week, otherwise the date: Bluesky's DM divider, in the Timezone preference. */
let DateDivider = ({at}: {at: number}): React.ReactNode => {
  const t = useTheme()
  const {t: l, i18n} = useLingui()
  const timeZone = useTimeZone()

  // Today comes from the shared clock (§ 10): it rolls over at local midnight and follows DST.
  const today = useToday()
  const day = dayKey(at, timeZone)
  const time = i18n.date(at, {hour: 'numeric', minute: 'numeric', timeZone})

  let date: string
  if (day === today) {
    date = l`Today`
  } else if (day === addDays(today, -1)) {
    date = l`Yesterday`
  } else if (day < addDays(today, -6)) {
    const sameYear = day.slice(0, 4) === today.slice(0, 4)
    date = i18n.date(at, {
      weekday: 'short',
      month: 'long',
      day: 'numeric',
      ...(sameYear ? {} : {year: 'numeric'}),
      timeZone,
    })
  } else {
    date = i18n.date(at, {weekday: 'long', timeZone})
  }

  return (
    <View style={[a.w_full, a.mt_md]} testID="comment-date-divider">
      <Text
        style={[
          a.text_xs,
          a.text_center,
          t.atoms.text_contrast_medium,
          a.px_md,
        ]}>
        <Trans>
          {date} at {time}
        </Trans>
      </Text>
    </View>
  )
}
DateDivider = memo(DateDivider)
export {DateDivider}
