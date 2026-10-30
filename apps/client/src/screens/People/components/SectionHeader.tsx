import {View} from 'react-native'

import {atoms as a, useTheme} from '#/alf'
import {ActivityLink} from '#/components/ActivityLink'
import {Text} from '#/components/Typography'

/** A list section heading (title, optional count) with the section's own action on the right. */
export function SectionHeader({
  title,
  testID,
  count,
  action,
  href,
  hrefLabel,
}: {
  title: string
  testID?: string
  count?: number
  action?: React.ReactNode
  /** Makes the title and count a link into Activity with the matching filters (owners 193-195): `seeAllTransactionsPath`... */
  href?: string
  /** What a screen reader says for `href` ("See all transactions"). */
  hrefLabel?: string
}) {
  const t = useTheme()
  const heading = (
    <Text testID={testID} style={[a.text_lg, a.font_bold, a.leading_snug]}>
      {title}
      {count !== undefined && (
        <Text style={[a.text_lg, a.font_normal, t.atoms.text_contrast_medium]}>
          {'  '}
          {count}
        </Text>
      )}
    </Text>
  )
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
      {href ? (
        <ActivityLink testID={`${testID ?? 'section'}-link`} href={href} label={hrefLabel ?? title} style={[a.flex_shrink]}>
          {heading}
        </ActivityLink>
      ) : (
        heading
      )}
      {action}
    </View>
  )
}
