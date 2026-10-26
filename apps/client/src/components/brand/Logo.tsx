import {View} from 'react-native'
import Svg, {Path} from 'react-native-svg'
import {DEFAULT_PALETTE} from '@bsky.app/alf'

import {atoms as a, useTheme} from '#/alf'
import {Text} from '#/components/Typography'

const HEAD =
  'M12 5c.67 0 1.35.09 2 .26 1.78-2 5.03-2.84 6.42-2.26 1.4.58-.42 7-.42 7 .57 1.07 1 2.24 1 3.44C21 17.9 16.97 21 12 21s-9-3-9-7.56c0-1.25.5-2.4 1-3.44 0 0-1.89-6.42-.5-7 1.39-.58 4.72.23 6.5 2.23A9.04 9.04 0 0 1 12 5Z'

/**
 * Splito mark: Lucide's "cat" icon (ISC, lucide-static v1.61.0 - see
 * LICENSES/lucide.txt), filled, with eyes and nose knocked out. Source file:
 * assets/brand/mark.svg.
 */
export function LogoMark({
  size = 32,
  color = DEFAULT_PALETTE.primary_500,
  featureColor = '#FFFFFF',
}: {
  size?: number
  color?: string
  featureColor?: string
}) {
  /*
   * Owner rule 20: blue with white features on every theme. The blue is the
   * brand's, so the Accent colour preference never recolours it.
   */
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round">
      <Path d={HEAD} fill={color} stroke={color} strokeWidth={2} />
      <Path d="M8 14v.5" stroke={featureColor} strokeWidth={2} />
      <Path d="M16 14v.5" stroke={featureColor} strokeWidth={2} />
      <Path
        d="M11.25 16.25h1.5L12 17l-.75-.75Z"
        fill={featureColor}
        stroke={featureColor}
        strokeWidth={2}
      />
    </Svg>
  )
}

/**
 * The mark, plus the name "Splito" beside it where the desktop sidebar has
 * room (owner rule 15). Phones and the icon rail show the mark alone.
 */
export function Logo({
  size = 28,
  withWordmark = false,
}: {
  size?: number
  withWordmark?: boolean
}) {
  const t = useTheme()
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel="Splito"
      style={[a.flex_row, a.align_center, a.gap_sm]}>
      <LogoMark size={size} />
      {withWordmark && (
        <Text
          style={[
            a.font_bold,
            t.atoms.text,
            {fontSize: Math.round(size * 0.75), letterSpacing: -0.5},
          ]}>
          Splito
        </Text>
      )}
    </View>
  )
}
