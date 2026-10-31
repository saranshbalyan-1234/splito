// Adapted from Expensify/App@a60491f (MIT) - src/components/Lottie/index.tsx
import {useContext, useEffect, useRef} from 'react'
import {NavigationContext} from '@react-navigation/native'

import {useTheme} from '#/alf'
import {ILLUSTRATIONS, type IllustrationProps} from '#/motion/illustrations'
import {useIllustrationSource} from '#/motion/useIllustrationSource'
import {useShouldReduceMotion} from '#/motion/useShouldReduceMotion'

/*
 * Web renders with lottie-web's SVG player instead of lottie-react-native's
 * dotLottie player, which fetches its WASM renderer from a CDN at runtime -
 * that breaks the offline PWA. The light build has no expression engine
 * (no eval), which Splito's generated files never use. The player and the
 * animation JSON are both dynamic imports: neither is in the start-up bundle.
 */

/**
 * An original Splito Lottie illustration (empty states, page headers,
 * success). Decorative: hidden from screen readers, so put the meaning in
 * adjacent text. Shows a fixed frame under reduce motion; `data-static`
 * says which mode rendered, `data-art` which illustration.
 */
export function Illustration({name, size, loop, testID}: IllustrationProps) {
  const t = useTheme()
  const {staticFrame, isLoop} = ILLUSTRATIONS[name]
  const source = useIllustrationSource(name, t.scheme === 'dark')
  const shouldReduceMotion = useShouldReduceMotion()
  const navigation = useContext(NavigationContext)
  const container = useRef<HTMLDivElement>(null)
  const shouldLoop = loop ?? isLoop

  useEffect(() => {
    const host = container.current
    if (!host || !source) return
    let isCurrent = true
    let off = () => {}
    void import('lottie-web/build/player/lottie_light').then(({default: lottie}) => {
      if (!isCurrent) return
      const anim = lottie.loadAnimation({
        container: host,
        renderer: 'svg',
        loop: shouldLoop,
        autoplay: !shouldReduceMotion && shouldLoop,
        // lottie-web mutates animationData, so every instance gets its own copy
        animationData: structuredClone(source),
      })
      /* Once and at rest: play to the resting frame and hold it; reduced motion goes straight there. */
      if (shouldReduceMotion) anim.goToAndStop(staticFrame, true)
      else if (!shouldLoop) anim.playSegments([0, staticFrame], true)
      /* From Expensify: pause while the screen is covered so stacked screens stop rendering frames. */
      const offs =
        navigation && !shouldReduceMotion && shouldLoop
          ? [
              navigation.addListener('blur', () => anim.pause()),
              navigation.addListener('focus', () => anim.play()),
            ]
          : []
      off = () => {
        offs.forEach(o => o())
        anim.destroy()
      }
    })
    return () => {
      isCurrent = false
      off()
    }
  }, [source, staticFrame, shouldLoop, shouldReduceMotion, navigation])

  return (
    <div
      ref={container}
      data-testid={testID}
      data-static={shouldReduceMotion ? 'true' : 'false'}
      data-art={name}
      aria-hidden
      style={{width: size, height: size, flexShrink: 0}}
    />
  )
}
