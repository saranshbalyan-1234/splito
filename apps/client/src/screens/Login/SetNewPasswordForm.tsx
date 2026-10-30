// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/screens/Login/SetNewPasswordForm.tsx
import {useState} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {isSignInCode, MIN_PASSWORD_LENGTH} from '@splito/domain'

import {AuthError} from '#/lib/auth'
import {isPasswordLongEnough} from '#/lib/auth/password'
import {atoms as a} from '#/alf'
import {Admonition} from '#/components/Admonition'
import {PasswordField} from '#/components/forms/PasswordField'
import * as TextField from '#/components/forms/TextField'
import {Key_Stroke2_Corner0_Rounded as KeyIcon} from '#/components/icons/Auth'
import {Text} from '#/components/Typography'
import {onlyDigits} from './digits'
import {FormActions} from './FormActions'
import {FormContainer} from './FormContainer'
import {useAuthErrorText} from './messages'
import {StrengthMeter} from './StrengthMeter'

/**
 * A new password with its strength shown (minimum 8, owner 141). With `needsCode` it also asks for the reset code
 * (the forgot-password flow); a new account has already verified its contacts, so it asks for the password alone.
 */
export const SetNewPasswordForm = ({
  testID = 'setNewPasswordForm',
  title,
  description,
  needsCode,
  submitLabel,
  onPressBack,
  onSubmit,
}: {
  testID?: string
  title: React.ReactNode
  description?: React.ReactNode
  needsCode: boolean
  submitLabel?: string
  onPressBack: () => void
  /** Resolves when it worked; throws `AuthError` for a message under the form. */
  onSubmit: (code: string, password: string) => Promise<void>
}) => {
  const {t: l} = useLingui()
  const errorText = useAuthErrorText()
  const [resetCode, setResetCode] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isBusy, setBusy] = useState(false)

  const submit = async () => {
    if (needsCode && !isSignInCode(resetCode)) return setError(l`You have entered an invalid code. It should be 6 digits.`)
    if (!isPasswordLongEnough(password)) return setError(l`Your password must be at least ${MIN_PASSWORD_LENGTH} characters long.`)
    setError('')
    setBusy(true)
    try {
      await onSubmit(resetCode.trim(), password)
    } catch (e) {
      setError(errorText(e instanceof AuthError ? e.code : 'unknown'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <FormContainer testID={testID} titleText={title}>
      {!!description && <Text style={[a.leading_snug, a.mb_sm]}>{description}</Text>}
      {needsCode && (
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
              value={resetCode}
              onChangeText={v => {
                setResetCode(onlyDigits(v))
                if (error) setError('')
              }}
            />
          </TextField.Root>
        </View>
      )}
      <View style={[a.gap_sm]}>
        <TextField.LabelText>{needsCode ? <Trans>New password</Trans> : <Trans>Password</Trans>}</TextField.LabelText>
        <PasswordField
          testID="newPasswordInput"
          label={l`Enter a password`}
          autoFocus={!needsCode}
          returnKeyType="done"
          autoComplete="new-password"
          passwordRules={`minlength: ${MIN_PASSWORD_LENGTH};`}
          clearButtonMode="while-editing"
          isInvalid={!!error && !needsCode}
          value={password}
          onChangeText={v => {
            setPassword(v)
            if (error) setError('')
          }}
          onSubmitEditing={submit}
          accessibilityHint={l`Input new password`}
        />
        <StrengthMeter password={password} />
      </View>
      {!!error && (
        <View role="alert" testID="setNewPasswordError">
          <Admonition type="error">{error}</Admonition>
        </View>
      )}
      <FormActions testID="setNewPassword" nextLabel={submitLabel} isBusy={isBusy} onBack={onPressBack} onNext={submit} />
    </FormContainer>
  )
}
