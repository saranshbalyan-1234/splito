import {useEffect} from 'react'
import {type StyleProp, type ViewStyle} from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'

import {useShouldReduceMotion} from '#/motion/useShouldReduceMotion'

/* Same curve as Expensify's loading bar; a slow breath reads as "loading", not "blinking". */
const BREATH = {duration: 800, easing: Easing.bezier(0.65, 0, 0.35, 1)}

/**
 * Pulses its children - Bluesky `#/components/Skeleton` blocks - while local
 * data loads, on the UI thread. Static under reduce motion. Only for real
 * loading: never wrap a figure that is already known.
 */
export function Shimmer({
  children,
  style,
  testID,
}: {
  children: React.ReactNode
  style?: StyleProp<ViewStyle>
  testID?: string
}) {
  const shouldReduceMotion = useShouldReduceMotion()
  const opacity = useSharedValue(1)

  useEffect(() => {
    if (shouldReduceMotion) return
    opacity.set(
      withRepeat(
        withSequence(withTiming(0.45, BREATH), withTiming(1, BREATH)),
        -1,
      ),
    )
    return () => cancelAnimation(opacity)
  }, [shouldReduceMotion, opacity])

  const animatedStyle = useAnimatedStyle(() => ({opacity: opacity.get()}))

  return (
    <Animated.View
      style={[style, !shouldReduceMotion && animatedStyle]}
      accessibilityState={{busy: true}}
      testID={testID}>
      {children}
    </Animated.View>
  )
}
