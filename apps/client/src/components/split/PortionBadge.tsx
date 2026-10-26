import {View} from 'react-native'

import {atoms as a, useTheme} from '#/alf'
import {Text} from '#/components/Typography'

/** "x2" on a person's chip: how many portions of an item they had, as a filled badge. */
export function PortionBadge({
  portions,
  testID,
}: {
  portions: number
  testID?: string
}) {
  const t = useTheme()
  return (
    <View
      style={[
        a.rounded_full,
        a.px_xs,
        {
          backgroundColor: t.palette.primary_500,
          minWidth: 22,
          paddingVertical: 1,
        },
      ]}>
      <Text
        testID={testID}
        style={[
          a.text_xs,
          a.font_bold,
          a.text_center,
          {color: t.palette.white, fontVariant: ['tabular-nums']},
        ]}>
        ×{portions}
      </Text>
    </View>
  )
}
