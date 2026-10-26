import {type StyleProp, View, type ViewStyle} from 'react-native'

import {atoms as a, useTheme} from '#/alf'
import {Text} from '#/components/Typography'

/**
 * A chart's frame, in the summary card's style (People balances): a hairline
 * border, the title and a one-line explanation, an optional figure on the
 * right, then the chart or its table.
 */
export function ChartCard({
  title,
  subtitle,
  aside,
  children,
  style,
  testID,
}: {
  title: string
  subtitle?: string
  aside?: React.ReactNode
  children: React.ReactNode
  style?: StyleProp<ViewStyle>
  testID?: string
}) {
  const t = useTheme()
  return (
    <View
      testID={testID}
      role="group"
      aria-label={title}
      style={[
        a.rounded_md,
        a.border,
        t.atoms.border_contrast_low,
        a.p_lg,
        a.gap_lg,
        style,
      ]}>
      <View
        style={[
          a.flex_row,
          a.flex_wrap,
          a.align_start,
          a.justify_between,
          a.gap_md,
        ]}>
        {/* The aside drops under the title when the card is too narrow for both. */}
        <View style={[a.gap_2xs, {flexGrow: 1, flexShrink: 1, flexBasis: 220}]}>
          <Text
            role="heading"
            style={[a.text_md, a.font_semi_bold, a.leading_snug]}>
            {title}
          </Text>
          {subtitle ? (
            <Text
              style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {aside}
      </View>
      {children}
    </View>
  )
}
