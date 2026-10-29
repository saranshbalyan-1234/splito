// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/screens/Login/ForgotPasswordForm.tsx
import {useState} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {type Contact} from '@splito/domain'
import {formatContact} from '@splito/sync'

import {AuthError, getAuthClient} from '#/lib/auth'
import {atoms as a, useTheme} from '#/alf'
import {Admonition} from '#/components/Admonition'
import {Button, ButtonText} from '#/components/Button'
import {Text} from '#/components/Typography'
import {FormActions} from './FormActions'
import {FormContainer} from './FormContainer'
import {useAuthErrorText} from './messages'

/** The contact is already known from the Continue screen, so there is nothing to type: it confirms where the reset code goes. */
export const ForgotPasswordForm = ({
  contact,
  onPressBack,
  onCodeSent,
  onCodeEntered,
}: {
  contact: Contact
  onPressBack: () => void
  onCodeSent: () => void
  /** "Already have a code?": on to the new-password step. */
  onCodeEntered: () => void
}) => {
  const t = useTheme()
  const {t: l} = useLingui()
  const errorText = useAuthErrorText()
  const [error, setError] = useState('')
  const [isBusy, setBusy] = useState(false)

  const send = async () => {
    setError('')
    setBusy(true)
    try {
      await (await getAuthClient()).sendCode(contact, 'reset')
      onCodeSent()
    } catch (e) {
      setError(errorText(e instanceof AuthError ? e.code : 'unknown'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <FormContainer testID="forgotPasswordForm" titleText={<Trans>Reset password</Trans>}>
      <Text style={[a.leading_snug, t.atoms.text_contrast_high]}>
        <Trans>
          We’ll send a “reset code” to {formatContact(contact)} so you can set a new password.
        </Trans>
      </Text>
      {!!error && (
        <View role="alert" testID="forgotPasswordError">
          <Admonition type={error === errorText('unavailable') ? 'info' : 'error'}>{error}</Admonition>
        </View>
      )}
      <FormActions testID="forgotPassword" nextLabel={l`Send code`} isBusy={isBusy} onBack={onPressBack} onNext={send} />
      <View style={[t.atoms.border_contrast_medium, a.border_t, a.pt_xl, a.mt_md, a.flex_row, a.justify_center]}>
        <Button testID="skipSendCodeButton" onPress={onCodeEntered} label={l`Go to next`} accessibilityHint={l`Navigates to the next screen`} size="large" variant="ghost" color="secondary">
          <ButtonText>
            <Trans>Already have a code?</Trans>
          </ButtonText>
        </Button>
      </View>
    </FormContainer>
  )
}
