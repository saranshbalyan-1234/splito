import {View} from 'react-native'
import Svg, {Defs, LinearGradient, Path, Stop} from 'react-native-svg'


/**
 * Splito mark: an original butterfly whose right wings are split off, shifted
 * down and lighter - the "split". Source: assets/brand/mark.svg. Deliberately
 * not Bluesky's butterfly (their trademark).
 */
export function LogoMark({size = 32}: {size?: number}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Defs>
        <LinearGradient id="splitoL" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#4291FF" />
          <Stop offset="1" stopColor="#0048AD" />
        </LinearGradient>
        <LinearGradient id="splitoR" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#A8CCFF" />
          <Stop offset="1" stopColor="#4291FF" />
        </LinearGradient>
      </Defs>
      <Path d="M30.5 30.5C26 17 13 8.5 6.5 12.5 1 16 5.5 29 30.5 31.5Z" fill="url(#splitoL)" />
      <Path d="M30.5 33.5C15 34 8.5 42 11.5 48.5 14.5 55 26 50 30.5 36Z" fill="url(#splitoL)" />
      <Path d="M33.5 34.5C38 21 51 12.5 57.5 16.5 63 20 58.5 33 33.5 35.5Z" fill="url(#splitoR)" />
      <Path d="M33.5 37.5C49 38 55.5 46 52.5 52.5 49.5 59 38 54 33.5 40Z" fill="url(#splitoR)" />
    </Svg>
  )
}

/** The logo is the butterfly alone - no wordmark, no tile (owner, 2026-10-26). */
export function Logo({size = 28}: {size?: number}) {
  return (
    <View accessibilityRole="image" accessibilityLabel="Splito">
      <LogoMark size={size} />
    </View>
  )
}
