import {View} from 'react-native'
import Svg, {Path} from 'react-native-svg'

import {holePath} from '#/lib/tour/layout'
import {atoms as a, useTheme} from '#/alf'
import {type Backdrop} from './types'

/*
 * The tour's dim with a hole where the control stays sharp (owner 143). Native draws a plain dim: `expo-blur` is not a
 * dependency, and a blur is not worth one for a three-step tour. `TourBackdrop.web.tsx` adds the blur.
 */
export function TourBackdrop({screen, spot}: Backdrop) {
  const t = useTheme()
  return (
    <View pointerEvents="none" style={[a.absolute, a.inset_0]}>
      <Svg width={screen.width} height={screen.height}>
        <Path d={holePath(screen, spot)} fill={t.palette.black} fillOpacity={0.55} fillRule="evenodd" />
      </Svg>
    </View>
  )
}
