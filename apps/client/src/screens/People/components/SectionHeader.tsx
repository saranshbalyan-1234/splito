import {View} from 'react-native'

import {atoms as a, useTheme} from '#/alf'
import {Text} from '#/components/Typography'

/** A list section heading (title, optional count) with the section's own action on the right. */
export function SectionHeader({
  title,
  testID,
  count,
  action,
}: {
  title: string
  testID?: string
  count?: number
  action?: React.ReactNode
}) {
  const t = useTheme()
  return (
    <View
      style={[
        a.flex_row,
        a.flex_wrap,
        a.align_center,
        a.justify_between,
        a.px_lg,
        a.pt_md,
        a.pb_sm,
        {minHeight: 52},
      ]}>
      <Text testID={testID} style={[a.text_lg, a.font_bold, a.leading_snug]}>
        {title}
        {count !== undefined && (
          <Text
            style={[a.text_lg, a.font_normal, t.atoms.text_contrast_medium]}>
            {'  '}
            {count}
          </Text>
        )}
      </Text>
      {action}
    </View>
  )
}
