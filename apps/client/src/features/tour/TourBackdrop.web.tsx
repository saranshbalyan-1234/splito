import {View} from 'react-native'
import Svg, {Path} from 'react-native-svg'

import {holePath} from '#/lib/tour/layout'
import {useShouldReduceMotion} from '#/motion/useShouldReduceMotion'
import {atoms as a, useTheme, web} from '#/alf'
import {type Backdrop} from './types'

/** The OS asks for no see-through effects: the blur gives way to a plain dim (owner 143). */
function prefersReducedTransparency(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-transparency: reduce)').matches
  } catch {
    return false
  }
}

/*
 * The tour's backdrop on the web (owner 143): the whole screen blurred and slightly dimmed, the focused control sharp
 * inside a rounded cut-out. The blur is a `backdrop-filter` layer masked by the same hole path the dim uses, so the
 * control is never filtered. Reduced motion or reduced transparency: the plain, darker dim alone.
 */
export function TourBackdrop({screen, spot}: Backdrop) {
  const t = useTheme()
  const shouldReduceMotion = useShouldReduceMotion()
  const isBlurred = !shouldReduceMotion && !prefersReducedTransparency()
  const d = holePath(screen, spot)
  const mask = `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${screen.width}" height="${screen.height}"><path fill="black" fill-rule="evenodd" d="${d}"/></svg>`)}")`
  return (
    <View pointerEvents="none" style={[a.absolute, a.inset_0]}>
      {isBlurred && (
        <View
          testID="tour-blur"
          style={[
            a.absolute,
            a.inset_0,
            web({
              backdropFilter: 'blur(5px)',
              WebkitBackdropFilter: 'blur(5px)',
              maskImage: mask,
              WebkitMaskImage: mask,
              maskSize: '100% 100%',
              WebkitMaskSize: '100% 100%',
            }),
          ]}
        />
      )}
      <Svg width={screen.width} height={screen.height}>
        <Path d={d} fill={t.palette.black} fillOpacity={isBlurred ? 0.3 : 0.55} fillRule="evenodd" />
      </Svg>
    </View>
  )
}
