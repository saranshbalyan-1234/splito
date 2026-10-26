// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/lib/custom-animations/PressableScale.tsx
import {
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

import {IS_NATIVE, IS_WEB_TOUCH_DEVICE} from '#/env'
import {useShouldReduceMotion} from '#/motion/useShouldReduceMotion'

const DEFAULT_TARGET_SCALE = IS_NATIVE || IS_WEB_TOUCH_DEVICE ? 0.98 : 1

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

/**
 * Pressable that shrinks slightly while held, on the UI thread. Static when
 * reduce motion (OS or the Animations preference) is on. Desktop web keeps
 * scale 1, as upstream does: hover feedback covers it there.
 */
export function PressableScale({
  targetScale = DEFAULT_TARGET_SCALE,
  children,
  style,
  onPressIn,
  onPressOut,
  ...rest
}: {
  targetScale?: number
  style?: StyleProp<ViewStyle>
} & Exclude<PressableProps, 'onPressIn' | 'onPressOut' | 'style'>) {
  const shouldReduceMotion = useShouldReduceMotion()

  const scale = useSharedValue(1)

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{scale: scale.get()}],
  }))

  return (
    <AnimatedPressable
      accessibilityRole="button"
      onPressIn={e => {
        if (onPressIn) {
          onPressIn(e)
        }
        cancelAnimation(scale)
        scale.set(withTiming(targetScale, {duration: 100}))
      }}
      onPressOut={e => {
        if (onPressOut) {
          onPressOut(e)
        }
        cancelAnimation(scale)
        scale.set(withTiming(1, {duration: 100}))
      }}
      style={[!shouldReduceMotion && animatedStyle, style]}
      {...rest}>
      {children}
    </AnimatedPressable>
  )
}
