// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/components/dms/DateDivider.tsx
import {memo} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {useTimeZone} from '#/locale/useDates'
import {atoms as a, useTheme} from '#/alf'
import {Text} from '#/components/Typography'
import {dayKey} from './timeline'

const DAY_MS = 24 * 3600_000

/** "Today at 4:15 PM", "Yesterday at ...", a weekday within the week, otherwise the date: Bluesky's DM divider, in the Timezone preference. */
let DateDivider = ({at}: {at: number}): React.ReactNode => {
  const t = useTheme()
  const {t: l, i18n} = useLingui()
  const timeZone = useTimeZone()

  const now = Date.now()
  const day = dayKey(at, timeZone)
  const time = i18n.date(at, {hour: 'numeric', minute: 'numeric', timeZone})

  let date: string
  if (day === dayKey(now, timeZone)) {
    date = l`Today`
  } else if (day === dayKey(now - DAY_MS, timeZone)) {
    date = l`Yesterday`
  } else if (at < now - 7 * DAY_MS) {
    const sameYear = day.slice(0, 4) === dayKey(now, timeZone).slice(0, 4)
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
