// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/view/com/auth/SplashScreen.web.tsx
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {atoms as a, useBreakpoints, useTheme} from '#/alf'
import {AppLanguageDropdown} from '#/components/AppLanguageDropdown'
import {LogoMark} from '#/components/brand/Logo'
import {Button, ButtonText} from '#/components/Button'
import * as Layout from '#/components/Layout'
import {Text} from '#/components/Typography'

export const SplashScreen = ({
  onPressSignin,
  onPressCreateAccount,
}: {
  onPressSignin: () => void
  onPressCreateAccount: () => void
}) => {
  const {t: l} = useLingui()
  const t = useTheme()
  const {gtMobile} = useBreakpoints()

  return (
    <Layout.Center style={[a.h_full, a.flex_1]} ignoreTabletLayoutOffset>
      <View
        testID="noSessionView"
        style={[
          a.h_full,
          a.justify_center,
          {paddingBottom: '20vh'},
          !gtMobile && a.pb_5xl,
          t.atoms.border_contrast_medium,
          a.align_center,
          a.gap_5xl,
          a.flex_1,
        ]}>
        <View style={[a.justify_center, a.align_center, a.gap_lg]}>
          <LogoMark size={92} />
          <Text style={[a.text_3xl, a.font_bold, a.text_center]}>
            <Trans>Splito</Trans>
          </Text>
          <Text
            style={[a.text_md, a.font_semi_bold, t.atoms.text_contrast_medium]}>
            <Trans>Split bills, stay friends.</Trans>
          </Text>
        </View>

        <View
          testID="signinOrCreateAccount"
          style={[a.w_full, a.px_xl, a.gap_md, a.pb_2xl, {maxWidth: 320}]}>
          <Button
            testID="createAccountButton"
            onPress={onPressCreateAccount}
            label={l`Create new account`}
            accessibilityHint={l`Opens flow to create a new Splito account`}
            size="large"
            variant="solid"
            color="primary">
            <ButtonText>
              <Trans>Create account</Trans>
            </ButtonText>
          </Button>
          <Button
            testID="signInButton"
            onPress={onPressSignin}
            label={l`Sign in`}
            accessibilityHint={l`Opens flow to sign in to your existing Splito account`}
            size="large"
            variant="solid"
            color="secondary">
            <ButtonText>
              <Trans>Sign in</Trans>
            </ButtonText>
          </Button>
        </View>
      </View>
      <Footer />
    </Layout.Center>
  )
}

function Footer() {
  const t = useTheme()

  return (
    <View
      style={[
        a.absolute,
        a.inset_0,
        {top: 'auto'},
        a.px_xl,
        a.py_lg,
        a.border_t,
        a.flex_row,
        a.align_center,
        a.flex_wrap,
        a.gap_xl,
        t.atoms.border_contrast_medium,
      ]}>
      <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
        <Trans>
          Splito works without an account. Your data stays on this device.
        </Trans>
      </Text>

      <View style={a.flex_1} />

      <AppLanguageDropdown />
    </View>
  )
}
