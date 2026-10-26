import {useLayoutEffect, useRef} from 'react'
import {View} from 'react-native'
import {formatAmount} from '@splito/domain'

import {Text} from '#/components/Typography'
import {
  AMOUNT_DURATION_MS,
  amountFrames,
  type Money,
} from '#/motion/amountSteps'
import {type AnimatedAmountProps} from '#/motion/AnimatedAmount/types'
import {useShouldReduceMotion} from '#/motion/useShouldReduceMotion'

export {type AnimatedAmountProps} from '#/motion/AnimatedAmount/types'

const TABULAR = {fontVariant: ['tabular-nums' as const]}

/**
 * A formatted amount that counts to its new value when `minor` changes.
 * Web has no separate UI thread, so a requestAnimationFrame loop writes the
 * precomputed exact `formatAmount` frames straight into the text node -
 * no React renders per frame. React's own text node is reused, so its next
 * commit still lands. Plain text under reduce motion.
 */
export function AnimatedAmount({
  minor,
  currency,
  locale,
  style,
  testID,
}: AnimatedAmountProps) {
  const shouldReduceMotion = useShouldReduceMotion()
  const final = formatAmount(minor, currency, locale)
  const wrapper = useRef<React.ComponentRef<typeof View>>(null)
  const prev = useRef<Money>(undefined)

  useLayoutEffect(() => {
    const frames = amountFrames(prev.current, {minor, currency}, locale)
    prev.current = {minor, currency}
    const host = wrapper.current as unknown as HTMLElement | null
    const node =
      host && document.createTreeWalker(host, NodeFilter.SHOW_TEXT).nextNode()
    if (!node) return
    /* Correct any frame a cancelled run left behind before deciding to animate. */
    node.nodeValue = frames.at(-1)!
    if (shouldReduceMotion || frames.length < 2) return
    const start = performance.now()
    let raf = 0
    const tick = (now: number) => {
      /*
       * A frame's timestamp is when the frame began, which can be before
       * `start`: clamp at 0, or frames[-1] (undefined) blanks the text.
       */
      const i = Math.min(
        frames.length - 1,
        Math.max(
          0,
          Math.floor(((now - start) / AMOUNT_DURATION_MS) * frames.length),
        ),
      )
      node.nodeValue = frames[i]!
      if (i < frames.length - 1) raf = requestAnimationFrame(tick)
    }
    node.nodeValue = frames[0]!
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [minor, currency, locale, shouldReduceMotion])

  return (
    <View ref={wrapper} testID={testID}>
      <Text style={[style, TABULAR]}>{final}</Text>
    </View>
  )
}
