// Adapted from Expensify/App@a60491f (MIT) - src/components/Lottie/index.tsx
import {useContext, useEffect, useRef, useState} from 'react'
import {View} from 'react-native'
import LottieView from 'lottie-react-native'
import {NavigationContext} from '@react-navigation/native'

import {useTheme} from '#/alf'
import {ILLUSTRATIONS, type IllustrationProps} from '#/motion/illustrations'
import {useIllustrationSource} from '#/motion/useIllustrationSource'
import {useShouldReduceMotion} from '#/motion/useShouldReduceMotion'

/**
 * An original Splito Lottie illustration (empty states, page headers,
 * success). Decorative: hidden from screen readers, so put the meaning in
 * adjacent text. Shows a fixed frame under reduce motion.
 */
export function Illustration({name, size, loop, testID}: IllustrationProps) {
  const t = useTheme()
  const {staticFrame, frames, isLoop} = ILLUSTRATIONS[name]
  const source = useIllustrationSource(name, t.scheme === 'dark')
  const shouldReduceMotion = useShouldReduceMotion()
  const [hasFailed, setHasFailed] = useState(false)
  const ref = useRef<LottieView>(null)
  const navigation = useContext(NavigationContext)
  const style = {width: size, height: size}
  const shouldLoop = loop ?? isLoop

  /* From Expensify: pause while the screen is covered so stacked screens stop rendering frames. */
  useEffect(() => {
    if (!navigation || shouldReduceMotion || !shouldLoop) return
    const offBlur = navigation.addListener('blur', () => ref.current?.pause())
    const offFocus = navigation.addListener('focus', () =>
      ref.current?.resume(),
    )
    return () => {
      offBlur()
      offFocus()
    }
  }, [navigation, shouldReduceMotion, shouldLoop])

  /* Once and at rest: play to the resting frame and hold it (reduced motion shows that frame from the start). */
  useEffect(() => {
    if (source && !shouldReduceMotion && !shouldLoop) ref.current?.play(0, staticFrame)
  }, [source, shouldReduceMotion, shouldLoop, staticFrame])

  /* From Expensify: a failed animation leaves an empty box of the same size rather than breaking layout. */
  /* The JSON is its own chunk: until it arrives the art's box is empty at its final size. */
  if (hasFailed || !source) return <View style={style} testID={testID} />

  return (
    <View
      style={style}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      <LottieView
        ref={ref}
        source={source as never}
        style={style}
        testID={testID}
        autoPlay={!shouldReduceMotion && shouldLoop}
        loop={!shouldReduceMotion && shouldLoop}
        progress={shouldReduceMotion ? staticFrame / frames : undefined}
        onAnimationFailure={() => setHasFailed(true)}
      />
    </View>
  )
}
