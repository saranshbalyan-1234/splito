// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/components/dms/DateDivider.tsx
import {memo} from 'react'
import {View} from 'react-native'
import {Trans} from '@lingui/react/macro'

import {useDayLabel, useFormatTime} from '#/locale/useDates'
import {atoms as a, useTheme} from '#/alf'
import {Text} from '#/components/Typography'

/**
 * "Today at 4:15 PM", "Yesterday at ...", a weekday within the week, otherwise the date: Bluesky's DM
 * divider, worded by the one day rule (`useDayLabel`) in the Timezone and Date format preferences.
 */
let DateDivider = ({at}: {at: number}): React.ReactNode => {
  const t = useTheme()
  const dayLabel = useDayLabel()
  const formatTime = useFormatTime()
  const date = dayLabel(at)
  const time = formatTime(at)

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
