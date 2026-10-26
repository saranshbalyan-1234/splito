// Adapted from Expensify/App@a60491f (MIT) - src/components/Lottie/index.tsx
import {useContext, useEffect, useRef, useState} from 'react'
import {View} from 'react-native'
import LottieView from 'lottie-react-native'
import {NavigationContext} from '@react-navigation/native'

import {ILLUSTRATIONS, type IllustrationProps} from '#/motion/illustrations'
import {useShouldReduceMotion} from '#/motion/useShouldReduceMotion'

/**
 * An original Splito Lottie illustration (empty states, page headers,
 * success). Decorative: hidden from screen readers, so put the meaning in
 * adjacent text. Shows a fixed frame under reduce motion.
 */
export function Illustration({name, size, loop, testID}: IllustrationProps) {
  const {source, staticFrame, isLoop} = ILLUSTRATIONS[name]
  const shouldReduceMotion = useShouldReduceMotion()
  const [hasFailed, setHasFailed] = useState(false)
  const ref = useRef<LottieView>(null)
  const navigation = useContext(NavigationContext)
  const style = {width: size, height: (size * source.h) / source.w}

  /* From Expensify: pause while the screen is covered so stacked screens stop rendering frames. */
  useEffect(() => {
    if (!navigation || shouldReduceMotion) return
    const offBlur = navigation.addListener('blur', () => ref.current?.pause())
    const offFocus = navigation.addListener('focus', () =>
      ref.current?.resume(),
    )
    return () => {
      offBlur()
      offFocus()
    }
  }, [navigation, shouldReduceMotion])

  /* From Expensify: a failed animation leaves an empty box of the same size rather than breaking layout. */
  if (hasFailed) return <View style={style} testID={testID} />

  return (
    <View
      style={style}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      <LottieView
        ref={ref}
        source={source}
        style={style}
        testID={testID}
        autoPlay={!shouldReduceMotion}
        loop={!shouldReduceMotion && (loop ?? isLoop)}
        progress={shouldReduceMotion ? staticFrame / source.op : undefined}
        onAnimationFailure={() => setHasFailed(true)}
      />
    </View>
  )
}
