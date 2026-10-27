// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/view/com/auth/NativeSplashScreen.tsx
import {View} from 'react-native'
import Animated, {FadeIn, FadeOut} from 'react-native-reanimated'
import {useLingui} from '@lingui/react'
import {msg} from '@lingui/core/macro'
import {Trans} from '@lingui/react/macro'

import {useHaptics} from '#/lib/haptics'
import {atoms as a, useBreakpoints, useTheme} from '#/alf'
import {LogoMark} from '#/components/brand/Logo'
import {Button, ButtonText} from '#/components/Button'
import {Text} from '#/components/Typography'

/*
 * Bluesky's phone splash: the logo at the top, the two buttons at the foot.
 * Its illustration is Bluesky artwork and is not copied.
 */
export function SplashScreen({
  onPressSignin,
  onPressCreateAccount,
}: {
  onPressSignin: () => void
  onPressCreateAccount: () => void
}) {
  const t = useTheme()
  const {gtPhone} = useBreakpoints()
  const {_} = useLingui()
  const haptics = useHaptics()

  return (
    <Animated.View
      entering={FadeIn.duration(90)}
      exiting={FadeOut.duration(90)}
      style={[a.flex_1]}>
      <View
        style={[a.justify_center, a.align_center, {gap: 12, paddingTop: 72}]}>
        <LogoMark size={76} />
        <Text style={[a.text_3xl, a.font_bold]}>
          <Trans>Splito</Trans>
        </Text>
        <Text
          style={[a.text_md, a.font_semi_bold, t.atoms.text_contrast_medium]}>
          <Trans>Split bills, stay friends.</Trans>
        </Text>
      </View>

      <View style={[a.flex_1]} />

      <View
        testID="signinOrCreateAccount"
        style={[
          a.px_5xl,
          a.gap_md,
          a.pb_xl,
          gtPhone && [a.w_full, a.self_center, {maxWidth: 600}],
        ]}>
        <Button
          testID="createAccountButton"
          onPress={() => {
            onPressCreateAccount()
            haptics.tap()
          }}
          label={_(msg`Create new account`)}
          accessibilityHint={_(msg`Opens flow to create a new Splito account`)}
          size="large"
          color="primary">
          <ButtonText>
            <Trans>Create account</Trans>
          </ButtonText>
        </Button>

        <Button
          testID="signInButton"
          onPress={() => {
            onPressSignin()
            haptics.tap()
          }}
          label={_(msg`Sign in`)}
          accessibilityHint={_(
            msg`Opens flow to sign in to your existing Splito account`,
          )}
          size="large"
          color="secondary">
          <ButtonText>
            <Trans>Sign in</Trans>
          </ButtonText>
        </Button>
        <Text
          style={[
            a.text_sm,
            a.text_center,
            a.pt_sm,
            t.atoms.text_contrast_medium,
          ]}>
          <Trans>
            Splito works without an account. Your data stays on this device.
          </Trans>
        </Text>
      </View>
    </Animated.View>
  )
}
