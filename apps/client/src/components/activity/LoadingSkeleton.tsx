// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/screens/Notifications/components/NotificationItem/LoadingSkeleton.tsx
import {
  type DimensionValue,
  type StyleProp,
  type TextStyle,
  View,
} from 'react-native'

import {atoms as a, useTheme} from '#/alf'
import * as Skele from '#/components/Skeleton'
import {AVATAR_SIZE, BADGE_POSITION, SLOT_SIZE} from './ActivityItem'

/** Enough rows to fill a tall screen. */
const ROW_COUNT = 10

/**
 * Placeholder rows while the feed first loads. They share the real rows'
 * padding, avatar slot and line heights, so nothing jumps when they're
 * replaced. Rows alternate between a one- and a two-line headline, so no row
 * looks like the last.
 */
export function LoadingSkeleton() {
  const t = useTheme()
  return (
    <>
      <View style={[a.px_lg, a.py_sm, a.border_b, t.atoms.border_contrast_low]}>
        <Skele.Text style={[a.text_md, a.font_bold, {width: 48}]} />
      </View>
      {Array.from({length: ROW_COUNT}, (_, i) => {
        const even = i % 2 === 0
        return (
          <View
            key={i}
            style={[
              a.flex_row,
              a.align_start,
              a.gap_lg,
              a.px_lg,
              a.py_md,
              i > 0 && [a.border_t, t.atoms.border_contrast_low],
            ]}>
            <AvatarSkeleton />
            <View style={[a.flex_1, a.gap_xs]}>
              <Lines
                style={a.text_md}
                widths={even ? ['70%'] : ['100%', '35%']}
              />
              <Lines blend style={a.text_sm} widths={[even ? '45%' : '55%']} />
              <Lines blend style={a.text_sm} widths={[48]} />
            </View>
          </View>
        )
      })}
    </>
  )
}

/** Stands in for a badged avatar, with a faint circle where the badge goes. */
function AvatarSkeleton() {
  const t = useTheme()
  return (
    <View style={SLOT_SIZE}>
      <Skele.Circle size={AVATAR_SIZE} />
      <View style={[a.absolute, a.rounded_full, BADGE_POSITION, t.atoms.bg]}>
        <Skele.Circle blend size={20} />
      </View>
    </View>
  )
}

/** Lines of wrapping text, one per width, at the line height of `style`. */
function Lines({
  widths,
  blend,
  style,
}: {
  widths: DimensionValue[]
  blend?: boolean
  style: StyleProp<TextStyle>
}) {
  return (
    <View>
      {widths.map((width, index) => (
        <Skele.Text key={index} blend={blend} style={[style, {width}]} />
      ))}
    </View>
  )
}
