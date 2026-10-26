import {View} from 'react-native'
import Svg, {Path} from 'react-native-svg'

import {atoms as a, useTheme} from '#/alf'
import {Text} from '#/components/Typography'

/*
 * Owner rule 21: the mark is the owner-provided SVG
 * (assets-owner/logo-owner-provided.svg, viewBox 0 0 600 535, always blue).
 * It is Bluesky's butterfly, a Bluesky trademark; the owner chose it for
 * development only. It must be replaced before any public build - this
 * component is the one place to swap it.
 */
const MARK =
  'm299.75 238.48c-26.326-51.007-97.736-146.28-164.21-193.17-63.677-44.919-88.028-37.186-103.82-29.946-18.428 8.3915-21.719 36.692-21.719 53.311s9.0496 136.57 15.138 156.48c19.745 66.145 89.674 88.522 154.17 81.282 3.2908-0.49362 6.5816-0.98723 10.037-1.3163-3.2908 0.49362-6.7461 0.98723-10.037 1.3163-94.445 13.986-178.52 48.374-68.284 170.96 121.1 125.38 166.02-26.82 189.06-104.15 23.035 77.169 49.526 223.94 186.75 104.15 103.17-104.15 28.301-156.97-66.145-170.96-3.2908-0.32908-6.7461-0.82269-10.037-1.3163 3.4553 0.49362 6.7461 0.82269 10.037 1.3163 64.499 7.2397 134.59-15.138 154.17-81.282 5.9234-20.074 15.138-139.86 15.138-156.48s-3.2908-44.919-21.719-53.311c-15.96-7.2397-40.148-14.973-103.82 29.946-66.967 47.058-138.38 142.16-164.7 193.17z'
const MARK_ASPECT = 535 / 600

/** The Splito mark, `size` wide, in the theme's accent (primary) colour on every theme (owner: accent changes the logo). */
export function LogoMark({size = 32}: {size?: number}) {
  const t = useTheme()
  return (
    <Svg
      width={size}
      height={Math.round(size * MARK_ASPECT)}
      viewBox="0 0 600 535">
      <Path d={MARK} fill={t.palette.primary_500} />
    </Svg>
  )
}

/**
 * The mark, followed by the "Splito" wordmark on the desktop sidebar (owner
 * rule 15). The wordmark takes the theme's text colour (owner rule 20); only
 * the mark is always blue (owner rule 21).
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
      style={[a.flex_row, a.align_center, {gap: Math.round(size * 0.2)}]}>
      <LogoMark size={size} />
      {withWordmark && (
        <Text
          testID="logo-wordmark"
          aria-hidden={true}
          style={[
            a.font_bold,
            {
              fontSize: Math.round(size * 0.65),
              lineHeight: size,
              letterSpacing: -0.5,
            },
            t.atoms.text,
          ]}>
          Splito
        </Text>
      )}
    </View>
  )
}
