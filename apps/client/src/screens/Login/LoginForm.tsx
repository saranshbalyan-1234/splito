// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/screens/Login/LoginForm.tsx
import {useRef, useState} from 'react'
import {Keyboard, type TextInput, View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {detectContactKind} from '@splito/domain'
import {parseContact} from '@splito/sync'

import {deviceRegion} from '#/data/friends'
import {HITSLOP_10} from '#/lib/constants'
import {atoms as a, native, useBreakpoints, useTheme} from '#/alf'
import * as Admonition from '#/components/Admonition'
import {Button, ButtonText} from '#/components/Button'
import {PasswordField} from '#/components/forms/PasswordField'
import * as TextField from '#/components/forms/TextField'
import {
  Envelope_Stroke2_Corner0_Rounded as EmailIcon,
  Phone_Stroke2_Corner0_Rounded as PhoneIcon,
} from '#/components/icons/Auth'
import {Text} from '#/components/Typography'
import {IS_IOS, IS_NATIVE, IS_WEB} from '#/env'
import {FormContainer} from './FormContainer'
import {NotLiveYet} from './NotLiveYet'

export const LoginForm = ({
  initialIdentifier,
  onPressBack,
  onPressForgotPassword,
  onPressCreateAccount,
}: {
  initialIdentifier: string
  onPressBack: () => void
  onPressForgotPassword: () => void
  onPressCreateAccount: () => void
}) => {
  const t = useTheme()
  const {t: l} = useLingui()
  const {gtMobile} = useBreakpoints()
  const [region] = useState(deviceRegion)
  const [error, setError] = useState('')
  const [errorField, setErrorField] = useState<
    'none' | 'identifier' | 'password'
  >('none')
  /* Set once every field passes: the honest "not yet" answer. */
  const [isNotLive, setIsNotLive] = useState(false)
  const [identifier, setIdentifier] = useState(initialIdentifier)
  const [password, setPassword] = useState('')
  const identifierRef = useRef<React.ComponentRef<typeof TextInput>>(null)
  const passwordRef = useRef<React.ComponentRef<typeof TextInput>>(null)
  const hasFocusedOnce = useRef(false)

  const onPressNext = () => {
    Keyboard.dismiss()
    setError('')
    setErrorField('none')
    setIsNotLive(false)

    if (!identifier.trim()) {
      setError(l`Please enter your email or phone number`)
      setErrorField('identifier')
      return
    }
    if (!parseContact(identifier, region)) {
      setError(
        l`Enter an email like name@example.com, or a phone number with its country code like +91 98765 43210.`,
      )
      setErrorField('identifier')
      return
    }
    if (!password) {
      setError(l`Please enter your password`)
      setErrorField('password')
      return
    }
    setIsNotLive(true)
  }

  return (
    <FormContainer testID="loginForm" titleText={<Trans>Sign in</Trans>}>
      <View>
        <TextField.LabelText>
          <Trans>Email or phone</Trans>
        </TextField.LabelText>
        <TextField.Root isInvalid={errorField === 'identifier'}>
          <TextField.Icon
            icon={
              detectContactKind(identifier) === 'phone' ? PhoneIcon : EmailIcon
            }
          />
          <TextField.Input
            testID="loginIdentifierInput"
            inputRef={identifierRef}
            label={l`Email or phone number`}
            placeholder={null}
            autoCapitalize="none"
            autoFocus={!IS_IOS && !initialIdentifier}
            autoCorrect={false}
            autoComplete="username"
            keyboardType="email-address"
            returnKeyType="next"
            textContentType="username"
            value={identifier}
            onChangeText={v => {
              setIdentifier(v)
              if (errorField !== 'none') setErrorField('none')
              if (isNotLive) setIsNotLive(false)
            }}
            onSubmitEditing={() => {
              passwordRef.current?.focus()
            }}
            blurOnSubmit={false} // prevents flickering due to onSubmitEditing going to next field
            accessibilityHint={l`Enter the email or phone number you used when you created your account`}
          />
        </TextField.Root>
      </View>

      <View>
        <TextField.LabelText>
          <Trans>Password</Trans>
        </TextField.LabelText>
        <PasswordField
          isInvalid={errorField === 'password'}
          testID="loginPasswordInput"
          inputRef={passwordRef}
          label={l`Password`}
          placeholder={null}
          autoFocus={!IS_IOS && !!initialIdentifier}
          autoComplete="current-password"
          returnKeyType="done"
          enablesReturnKeyAutomatically={true}
          value={password}
          onChangeText={v => {
            setPassword(v)
            if (errorField !== 'none') setErrorField('none')
            if (isNotLive) setIsNotLive(false)
          }}
          onSubmitEditing={onPressNext}
          blurOnSubmit={false} // HACK: https://github.com/facebook/react-native/issues/21911#issuecomment-558343069 Keyboard blur behavior is now handled in onSubmitEditing
          accessibilityHint={l`Enter your password`}
          onLayout={
            IS_IOS
              ? () => {
                  if (hasFocusedOnce.current) return
                  hasFocusedOnce.current = true
                  // If we use `autoFocus`, it happens before the password
                  // input is rendered, which breaks iOS password autofill (it
                  // only fills the username). Delay until both are rendered.
                  if (initialIdentifier) {
                    passwordRef.current?.focus()
                  } else {
                    identifierRef.current?.focus()
                  }
                }
              : undefined
          }
        />

        <Button
          testID="loginForgotButton"
          label={l`Forgot password?`}
          accessibilityHint={l`Reset your password by sending a code to your email or phone`}
          style={[a.mt_md, a.self_start]}
          hoverStyle={{opacity: 0.5}}
          hitSlop={HITSLOP_10}
          onPress={onPressForgotPassword}>
          <ButtonText style={[t.atoms.text_contrast_medium]}>
            <Trans>Forgot?</Trans>
          </ButtonText>
        </Button>
      </View>

      {/* At most one message at a time: the field error, or the honest "not yet". */}
      {error ? (
        <View role="alert" testID="loginError">
          <Admonition.Admonition type="error">{error}</Admonition.Admonition>
        </View>
      ) : (
        isNotLive && <NotLiveYet />
      )}

      {/* Web has no auth header, so its Back sits in the footer at every width (Bluesky hides it on narrow web, leaving no way back). */}
      <View
        style={[
          a.pt_md,
          (gtMobile || IS_WEB) && [a.justify_between, a.flex_row, a.gap_sm],
        ]}>
        {(gtMobile || IS_WEB) && (
          <Button
            testID="loginBackButton"
            label={l`Back`}
            color="secondary"
            size="large"
            onPress={onPressBack}>
            <ButtonText>
              <Trans>Back</Trans>
            </ButtonText>
          </Button>
        )}
        <Button
          testID="loginNextButton"
          label={l`Next`}
          accessibilityHint={l`Checks your details`}
          color="primary"
          size="large"
          onPress={onPressNext}>
          <ButtonText>
            <Trans>Next</Trans>
          </ButtonText>
        </Button>
      </View>

      {IS_NATIVE && (
        <View style={[a.flex_row, a.justify_center, a.align_center, a.mt_sm]}>
          <Text style={[a.text_md, native(a.text_center)]}>
            <Trans>New to Splito?</Trans>
          </Text>
          <Button
            testID="loginCreateAccountButton"
            label={l`Create account`}
            variant="ghost"
            color="primary"
            size="small"
            onPress={onPressCreateAccount}>
            <ButtonText style={[a.text_md]}>
              <Trans>Create account</Trans>
            </ButtonText>
          </Button>
        </View>
      )}
    </FormContainer>
  )
}
