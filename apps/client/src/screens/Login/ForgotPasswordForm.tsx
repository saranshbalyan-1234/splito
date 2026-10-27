// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/screens/Login/ForgotPasswordForm.tsx
import {useState} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {detectContactKind} from '@splito/domain'
import {parseContact} from '@splito/sync'

import {deviceRegion} from '#/data/friends'
import {atoms as a, useTheme, web} from '#/alf'
import {Admonition} from '#/components/Admonition'
import {Button, ButtonText} from '#/components/Button'
import * as TextField from '#/components/forms/TextField'
import {
  Envelope_Stroke2_Corner0_Rounded as EmailIcon,
  Phone_Stroke2_Corner0_Rounded as PhoneIcon,
} from '#/components/icons/Auth'
import {Text} from '#/components/Typography'
import {IS_WEB} from '#/env'
import {FormContainer} from './FormContainer'
import {NotLiveYet} from './NotLiveYet'

export const ForgotPasswordForm = ({
  onPressBack,
  onCodeEntered,
}: {
  onPressBack: () => void
  /** "Already have a code?": on to the new-password step. */
  onCodeEntered: () => void
}) => {
  const t = useTheme()
  const {t: l} = useLingui()
  const [region] = useState(deviceRegion)
  const [identifier, setIdentifier] = useState('')
  const [error, setError] = useState('')
  const [isNotLive, setIsNotLive] = useState(false)

  const onPressNext = () => {
    setIsNotLive(false)
    if (!parseContact(identifier, region)) {
      return setError(
        l`Enter the email or phone number (with its country code) you signed up with.`,
      )
    }
    setError('')
    /* No code can be sent before the auth backend exists; say so, send nothing. */
    setIsNotLive(true)
  }

  return (
    <FormContainer
      testID="forgotPasswordForm"
      titleText={<Trans>Reset password</Trans>}>
      <View>
        <TextField.LabelText>
          <Trans>Email or phone</Trans>
        </TextField.LabelText>
        <TextField.Root isInvalid={!!error}>
          <TextField.Icon
            icon={
              detectContactKind(identifier) === 'phone' ? PhoneIcon : EmailIcon
            }
          />
          <TextField.Input
            testID="forgotPasswordIdentifier"
            label={l`Enter your email or phone number`}
            autoCapitalize="none"
            autoFocus
            autoCorrect={false}
            autoComplete="username"
            keyboardType="email-address"
            returnKeyType="next"
            value={identifier}
            onChangeText={v => {
              setIdentifier(v)
              if (error) setError('')
              if (isNotLive) setIsNotLive(false)
            }}
            onSubmitEditing={onPressNext}
            accessibilityHint={l`Sets the email or phone number for password reset`}
          />
        </TextField.Root>
      </View>
      <Text style={[t.atoms.text_contrast_high, a.leading_snug]}>
        <Trans>
          Enter the email or phone number you used to create your account.
          We'll send you a "reset code" so you can set a new password.
        </Trans>
      </Text>
      {error ? (
        <View role="alert" testID="forgotPasswordError">
          <Admonition type="error">{error}</Admonition>
        </View>
      ) : (
        isNotLive && <NotLiveYet />
      )}
      <View style={[web([a.flex_row, a.align_center]), a.pt_md]}>
        {IS_WEB && (
          <>
            <Button
              testID="forgotPasswordBack"
              label={l`Back`}
              color="secondary"
              size="large"
              onPress={onPressBack}>
              <ButtonText>
                <Trans>Back</Trans>
              </ButtonText>
            </Button>
            <View style={a.flex_1} />
          </>
        )}
        <Button
          testID="forgotPasswordNext"
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
      <View
        style={[
          t.atoms.border_contrast_medium,
          a.border_t,
          a.pt_xl,
          a.mt_md,
          a.flex_row,
          a.justify_center,
        ]}>
        <Button
          testID="skipSendCodeButton"
          onPress={onCodeEntered}
          label={l`Go to next`}
          accessibilityHint={l`Navigates to the next screen`}
          size="large"
          variant="ghost"
          color="secondary">
          <ButtonText>
            <Trans>Already have a code?</Trans>
          </ButtonText>
        </Button>
      </View>
    </FormContainer>
  )
}
