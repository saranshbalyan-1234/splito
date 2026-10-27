// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/components/ScreenTransition.tsx
import {type StyleProp, type ViewStyle} from 'react-native'
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  SlideInLeft,
  SlideInRight,
} from 'react-native-reanimated'

import {IS_WEB} from '#/env'
import {useShouldReduceMotion} from '#/motion/useShouldReduceMotion'

export function ScreenTransition({
  direction,
  style,
  children,
  enabledWeb,
}: {
  direction: 'Backward' | 'Forward'
  style?: StyleProp<ViewStyle>
  children: React.ReactNode
  enabledWeb?: boolean
}) {
  const shouldReduceMotion = useShouldReduceMotion()
  const entering = shouldReduceMotion
    ? FadeIn.duration(90)
    : direction === 'Forward'
      ? SlideInRight.easing(Easing.out(Easing.exp))
      : SlideInLeft.easing(Easing.out(Easing.exp))
  const webEntering = enabledWeb ? FadeIn.duration(90) : undefined
  const exiting = FadeOut.duration(90) // Totally vibes based
  const webExiting = enabledWeb ? FadeOut.duration(90) : undefined

  return (
    <Animated.View
      entering={IS_WEB ? webEntering : entering}
      exiting={IS_WEB ? webExiting : exiting}
      style={style}>
      {children}
    </Animated.View>
  )
}
