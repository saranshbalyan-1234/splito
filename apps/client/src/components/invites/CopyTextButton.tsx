// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/screens/Messages/components/CopyTextButton.tsx
import {useEffect, useState} from 'react'
import {type GestureResponderEvent, View} from 'react-native'
import Animated, {FadeOutUp, ZoomIn} from 'react-native-reanimated'
import {Trans} from '@lingui/react/macro'

import {copyText} from '#/lib/sharing'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonIcon, type ButtonProps} from '#/components/Button'
import {SquareBehindSquare_Stroke2_Corner2_Rounded as CopyIcon} from '#/components/icons/Invite'
import {Text} from '#/components/Typography'
import {useShouldReduceMotion} from '#/motion/useShouldReduceMotion'

/** A field-like button that copies `value`, with Bluesky's floating "Copied!". */
export function CopyTextButton({
  children,
  disabled,
  style,
  value,
  onPress: onPressProp,
  ...props
}: ButtonProps & {value: string}) {
  const t = useTheme()
  const [hasBeenCopied, setHasBeenCopied] = useState(false)
  const isReducedMotionEnabled = useShouldReduceMotion()

  useEffect(() => {
    if (hasBeenCopied) {
      const timeout = setTimeout(
        () => setHasBeenCopied(false),
        isReducedMotionEnabled ? 2000 : 100,
      )
      return () => clearTimeout(timeout)
    }
  }, [hasBeenCopied, isReducedMotionEnabled])

  const onPress = (evt: GestureResponderEvent) => {
    void copyText(value, {toast: false})
    setHasBeenCopied(true)
    onPressProp?.(evt)
  }

  return (
    <View style={[a.relative]}>
      {hasBeenCopied && (
        <Animated.View
          entering={isReducedMotionEnabled ? undefined : ZoomIn.duration(100)}
          exiting={isReducedMotionEnabled ? undefined : FadeOutUp.duration(2000)}
          style={[
            a.absolute,
            {bottom: '100%', right: 0},
            a.justify_center,
            a.gap_sm,
            a.z_10,
            a.pb_sm,
          ]}
          pointerEvents="none">
          <Text
            testID="copy-text-copied"
            style={[
              a.font_medium,
              a.text_right,
              a.text_sm,
              t.atoms.text_contrast_high,
            ]}>
            <Trans>Copied!</Trans>
          </Text>
        </Animated.View>
      )}
      <Button
        color="secondary"
        disabled={disabled}
        style={[a.flex_1, a.justify_between, {borderRadius: 10}, style]}
        onPress={onPress}
        {...props}>
        {context => (
          <View style={[a.flex_1, a.flex_row, a.justify_between, a.p_md]}>
            {typeof children === 'function' ? children(context) : children}
            {disabled ? null : <ButtonIcon icon={CopyIcon} size="lg" />}
          </View>
        )}
      </Button>
    </View>
  )
}
