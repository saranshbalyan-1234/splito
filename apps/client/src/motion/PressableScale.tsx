// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/lib/custom-animations/PressableScale.tsx
import {
  Pressable,
  type PressableProps,
  type StyleProp,
  type View,
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
 * PressableScale's press-in shrink as handlers plus an animated style, for a
 * pressable that already exists (a `Link` row or card): pass the handlers to
 * it and the style to an `Animated.View` around what should shrink. `style`
 * is undefined when there is nothing to animate (reduce motion, or desktop
 * web where the target scale is 1 and hover covers feedback).
 */
export function usePressScale(targetScale = DEFAULT_TARGET_SCALE) {
  const shouldReduceMotion = useShouldReduceMotion()
  const scale = useSharedValue(1)
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{scale: scale.get()}],
  }))
  return {
    style: shouldReduceMotion || targetScale === 1 ? undefined : animatedStyle,
    onPressIn: () => {
      cancelAnimation(scale)
      scale.set(withTiming(targetScale, {duration: 100}))
    },
    onPressOut: () => {
      cancelAnimation(scale)
      scale.set(withTiming(1, {duration: 100}))
    },
  }
}

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
  /** The node, for code that points at it (the guided tour). Absent: upstream behaviour. */
  ref?: React.Ref<React.ComponentRef<typeof View>>
} & Exclude<PressableProps, 'onPressIn' | 'onPressOut' | 'style'>) {
  const press = usePressScale(targetScale)

  return (
    <AnimatedPressable
      accessibilityRole="button"
      onPressIn={e => {
        if (onPressIn) {
          onPressIn(e)
        }
        press.onPressIn()
      }}
      onPressOut={e => {
        if (onPressOut) {
          onPressOut(e)
        }
        press.onPressOut()
      }}
      style={[press.style, style]}
      {...rest}>
      {children}
    </AnimatedPressable>
  )
}
