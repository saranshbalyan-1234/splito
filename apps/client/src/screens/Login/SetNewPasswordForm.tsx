// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/screens/Login/SetNewPasswordForm.tsx
import {useState} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {isSignInCode, MIN_PASSWORD_LENGTH} from '@splito/domain'

import {atoms as a, web} from '#/alf'
import {Admonition} from '#/components/Admonition'
import {Button, ButtonText} from '#/components/Button'
import {PasswordField} from '#/components/forms/PasswordField'
import * as TextField from '#/components/forms/TextField'
import {Key_Stroke2_Corner0_Rounded as KeyIcon} from '#/components/icons/Auth'
import {Text} from '#/components/Typography'
import {IS_WEB} from '#/env'
import {FormContainer} from './FormContainer'
import {NotLiveYet} from './NotLiveYet'

/*
 * `onPasswordSet` is the step to PasswordUpdatedForm. It is never called
 * before the auth backend exists: no reset is performed, so none is reported.
 */
export const SetNewPasswordForm = ({
  onPressBack,
}: {
  onPressBack: () => void
  onPasswordSet: () => void
}) => {
  const {t: l} = useLingui()
  const [resetCode, setResetCode] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isNotLive, setIsNotLive] = useState(false)

  const onPressNext = () => {
    setIsNotLive(false)
    if (!isSignInCode(resetCode)) {
      return setError(
        l`You have entered an invalid code. It should be 6 digits.`,
      )
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      return setError(l`Your password must be at least ${MIN_PASSWORD_LENGTH} characters long.`)
    }
    setError('')
    setIsNotLive(true)
  }

  return (
    <FormContainer
      testID="setNewPasswordForm"
      titleText={<Trans>Set new password</Trans>}>
      <Text style={[a.leading_snug, a.mb_sm]}>
        <Trans>
          You will receive a "reset code" by email or text. Enter that code
          here, then enter your new password.
        </Trans>
      </Text>
      <View>
        <TextField.LabelText>
          <Trans>Reset code</Trans>
        </TextField.LabelText>
        <TextField.Root isInvalid={!!error && !isSignInCode(resetCode)}>
          <TextField.Icon icon={KeyIcon} />
          <TextField.Input
            testID="resetCodeInput"
            label={l`6-digit reset code`}
            autoFocus
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            inputMode="numeric"
            keyboardType="number-pad"
            maxLength={6}
            value={resetCode}
            onChangeText={v => {
              setResetCode(v)
              if (error) setError('')
            }}
          />
        </TextField.Root>
      </View>
      <View>
        <TextField.LabelText>
          <Trans>New password</Trans>
        </TextField.LabelText>
        <PasswordField
          testID="newPasswordInput"
          label={l`Enter a password`}
          returnKeyType="done"
          autoComplete="new-password"
          passwordRules={`minlength: ${MIN_PASSWORD_LENGTH};`}
          clearButtonMode="while-editing"
          value={password}
          onChangeText={v => {
            setPassword(v)
            if (error) setError('')
          }}
          onSubmitEditing={onPressNext}
          accessibilityHint={l`Input new password`}
        />
      </View>
      {error ? (
        <View role="alert" testID="setNewPasswordError">
          <Admonition type="error">{error}</Admonition>
        </View>
      ) : (
        isNotLive && <NotLiveYet />
      )}
      <View style={[web([a.flex_row, a.align_center]), a.pt_lg]}>
        {IS_WEB && (
          <>
            <Button
              testID="setNewPasswordBack"
              label={l`Back`}
              variant="solid"
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
          testID="setNewPasswordNext"
          label={l`Next`}
          color="primary"
          size="large"
          onPress={onPressNext}>
          <ButtonText>
            <Trans>Next</Trans>
          </ButtonText>
        </Button>
      </View>
    </FormContainer>
  )
}
