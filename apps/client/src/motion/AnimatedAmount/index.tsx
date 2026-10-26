import {useEffect, useState} from 'react'
import {StyleSheet, TextInput, View} from 'react-native'
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import {formatAmount} from '@splito/domain'

import {useA11y} from '#/state/a11y'
import {atoms as a, useAlf, useTheme} from '#/alf'
import {normalizeTextStyles} from '#/alf/typography'
import {Text} from '#/components/Typography'
import {
  AMOUNT_DURATION_MS,
  amountFrames,
  type Money,
} from '#/motion/amountSteps'
import {type AnimatedAmountProps} from '#/motion/AnimatedAmount/types'
import {useShouldReduceMotion} from '#/motion/useShouldReduceMotion'

export {type AnimatedAmountProps} from '#/motion/AnimatedAmount/types'

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput)

/* Equal-width digits, so the widest frame is the one with the most characters. */
const TABULAR = {fontVariant: ['tabular-nums' as const]}

/**
 * A formatted amount that counts to its new value when `minor` changes.
 * Frames are exact `formatAmount` strings precomputed from bigint steps
 * (see amountSteps.ts); the UI thread only picks which string to show, via
 * the read-only TextInput `text` prop (Reanimated's own pattern), so no JS
 * runs per frame. The first render and any currency change show the value
 * directly. Plain text under reduce motion or a screen reader.
 */
export function AnimatedAmount({
  minor,
  currency,
  locale,
  style,
  testID,
}: AnimatedAmountProps) {
  const {fonts, flags} = useAlf()
  const t = useTheme()
  const {screenReaderEnabled} = useA11y()
  const shouldReduceMotion = useShouldReduceMotion()
  const final = formatAmount(minor, currency, locale)

  /* The previous amount lives in state (React's "information from previous renders" pattern) so the sizer below knows it. */
  const [target, setTarget] = useState<Money>({minor, currency})
  const [from, setFrom] = useState<Money>()
  if (target.minor !== minor || target.currency !== currency) {
    setFrom(target)
    setTarget({minor, currency})
  }

  const frames = useSharedValue([final])
  const index = useSharedValue(0)
  useEffect(() => {
    const next = shouldReduceMotion
      ? [formatAmount(minor, currency, locale)]
      : amountFrames(from, {minor, currency}, locale)
    frames.set(next)
    index.set(0)
    if (next.length > 1)
      index.set(
        withTiming(next.length - 1, {
          duration: AMOUNT_DURATION_MS,
          easing: Easing.linear,
        }),
      )
  }, [from, minor, currency, locale, shouldReduceMotion, frames, index])

  const animatedProps = useAnimatedProps(() => {
    const all = frames.get()
    const text = all[Math.min(all.length - 1, Math.round(index.get()))] ?? ''
    return {text, defaultValue: text}
  })

  if (shouldReduceMotion || screenReaderEnabled) {
    return (
      <Text style={style} testID={testID}>
        {final}
      </Text>
    )
  }

  /* Steps move monotonically, so the longest frame is one of the two ends. */
  const fromText =
    from && from.currency === currency
      ? formatAmount(from.minor, currency, locale)
      : final
  const widest = fromText.length > final.length ? fromText : final
  const inputStyle = normalizeTextStyles(
    [a.text_sm, t.atoms.text, a.leading_snug, style, TABULAR],
    {
      fontScale: fonts.scaleMultiplier,
      fontFamily: fonts.family,
      flags,
    },
  )

  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={final}
      testID={testID}>
      {/* Invisible sizer: the input is laid out once, so it must already be wide enough for every frame. */}
      <Text
        style={[style, TABULAR, styles.sizer]}
        importantForAccessibility="no-hide-descendants">
        {widest}
      </Text>
      <AnimatedTextInput
        editable={false}
        caretHidden
        contextMenuHidden
        pointerEvents="none"
        underlineColorAndroid="transparent"
        defaultValue={final}
        animatedProps={animatedProps}
        importantForAccessibility="no-hide-descendants"
        style={[inputStyle, styles.input]}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  sizer: {opacity: 0},
  input: {
    ...StyleSheet.absoluteFill,
    padding: 0,
    margin: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
  },
})
