import {View} from 'react-native'
import Svg, {Defs, LinearGradient, Path, Rect, Stop} from 'react-native-svg'

import {atoms as a, useTheme} from '#/alf'
import {Text} from '#/components/Typography'

/** Splito mark: a coin split in two, one half dropped. Source: assets/brand/mark.svg. */
export function LogoMark({size = 32}: {size?: number}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Defs>
        <LinearGradient id="splitoMark" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#2FB487" />
          <Stop offset="1" stopColor="#08674F" />
        </LinearGradient>
      </Defs>
      <Rect width={64} height={64} rx={16} fill="url(#splitoMark)" />
      <Path d="M30 15a17 17 0 0 0 0 34z" fill="#fff" />
      <Path d="M34 18a17 17 0 0 1 0 34z" fill="#fff" fillOpacity={0.72} />
    </Svg>
  )
}

export function Logo({size = 28}: {size?: number}) {
  const t = useTheme()
  return (
    <View style={[a.flex_row, a.align_center, a.gap_sm]}>
      <LogoMark size={size} />
      <Text style={[a.font_bold, {fontSize: size * 0.78, letterSpacing: -0.5}, t.atoms.text]}>Splito</Text>
    </View>
  )
}
