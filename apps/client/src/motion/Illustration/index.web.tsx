// Adapted from Expensify/App@a60491f (MIT) - src/components/Lottie/index.tsx
import {useContext, useEffect, useRef} from 'react'
import {NavigationContext} from '@react-navigation/native'
import lottie from 'lottie-web/build/player/lottie_light'

import {ILLUSTRATIONS, type IllustrationProps} from '#/motion/illustrations'
import {useShouldReduceMotion} from '#/motion/useShouldReduceMotion'

/*
 * Web renders with lottie-web's SVG player instead of lottie-react-native's
 * dotLottie player, which fetches its WASM renderer from a CDN at runtime -
 * that breaks the offline PWA. The light build has no expression engine
 * (no eval), which Splito's generated files never use.
 */

/**
 * An original Splito Lottie illustration (empty states, page headers,
 * success). Decorative: hidden from screen readers, so put the meaning in
 * adjacent text. Shows a fixed frame under reduce motion; `data-static`
 * says which mode rendered.
 */
export function Illustration({name, size, loop, testID}: IllustrationProps) {
  const {source, staticFrame, isLoop} = ILLUSTRATIONS[name]
  const shouldReduceMotion = useShouldReduceMotion()
  const navigation = useContext(NavigationContext)
  const container = useRef<HTMLDivElement>(null)
  const shouldLoop = loop ?? isLoop

  useEffect(() => {
    if (!container.current) return
    const anim = lottie.loadAnimation({
      container: container.current,
      renderer: 'svg',
      loop: shouldLoop,
      autoplay: !shouldReduceMotion,
      // lottie-web mutates animationData, so every instance gets its own copy
      animationData: structuredClone(source),
    })
    if (shouldReduceMotion) anim.goToAndStop(staticFrame, true)
    /* From Expensify: pause while the screen is covered so stacked screens stop rendering frames. */
    const offs =
      navigation && !shouldReduceMotion
        ? [
            navigation.addListener('blur', () => anim.pause()),
            navigation.addListener('focus', () => anim.play()),
          ]
        : []
    return () => {
      offs.forEach(off => off())
      anim.destroy()
    }
  }, [source, staticFrame, shouldLoop, shouldReduceMotion, navigation])

  return (
    <div
      ref={container}
      data-testid={testID}
      data-static={shouldReduceMotion ? 'true' : 'false'}
      aria-hidden
      style={{width: size, height: (size * source.h) / source.w, flexShrink: 0}}
    />
  )
}
