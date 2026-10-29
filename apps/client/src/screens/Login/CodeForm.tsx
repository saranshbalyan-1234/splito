import {useEffect, useRef, useState} from 'react'
import {Keyboard, View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {type Contact, isSignInCode} from '@splito/domain'
import {formatContact} from '@splito/sync'

import {AuthError, type CodePurpose, getAuthClient} from '#/lib/auth'
import {atoms as a, useTheme} from '#/alf'
import {Admonition} from '#/components/Admonition'
import {Button, ButtonText} from '#/components/Button'
import * as TextField from '#/components/forms/TextField'
import {Key_Stroke2_Corner0_Rounded as KeyIcon} from '#/components/icons/Auth'
import {Text} from '#/components/Typography'
import {FormActions} from './FormActions'
import {FormContainer} from './FormContainer'
import {useAuthErrorText} from './messages'

/**
 * Sends a one-time code to `contact` on arrival and checks the 6 digits (owner 139/140: a new account's email or phone,
 * the other contact, and the Add-missing step each go through this). Nothing is created here; the host moves on with
 * `onVerified(code)`. A new code can be asked for at any time.
 */
export function CodeForm({
  contact,
  purpose,
  title,
  hint,
  onVerified,
  onBack,
}: {
  contact: Contact
  purpose: CodePurpose
  title: React.ReactNode
  hint?: React.ReactNode
  onVerified: (code: string) => void | Promise<void>
  onBack?: () => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const errorText = useAuthErrorText()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [isBusy, setBusy] = useState(false)
  const [isSent, setSent] = useState(false)
  const didSend = useRef(false)

  const fail = (e: unknown) => setError(errorText(e instanceof AuthError ? e.code : 'unknown'))

  const send = async () => {
    setError('')
    try {
      await (await getAuthClient()).sendCode(contact, purpose)
      setSent(true)
    } catch (e) {
      fail(e)
    }
  }

  useEffect(() => {
    if (didSend.current) return
    didSend.current = true
    void send()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const submit = async () => {
    Keyboard.dismiss()
    setError('')
    if (!isSignInCode(code)) return setError(l`Enter the 6-digit code.`)
    setBusy(true)
    try {
      await (await getAuthClient()).verifyCode(contact, code, purpose)
      await onVerified(code.trim())
    } catch (e) {
      fail(e)
    } finally {
      setBusy(false)
    }
  }

  return (
    <FormContainer testID="code-form" titleText={title}>
      <Text style={[a.leading_snug, t.atoms.text_contrast_high]}>
        {isSent ? <Trans>We sent a 6-digit code to {formatContact(contact)}.</Trans> : <Trans>Sending a code to {formatContact(contact)}…</Trans>}{' '}
        {hint}
      </Text>
      <View>
        <TextField.LabelText>
          <Trans>6-digit code</Trans>
        </TextField.LabelText>
        <TextField.Root isInvalid={!!error}>
          <TextField.Icon icon={KeyIcon} />
          <TextField.Input
            testID="code-input"
            label={l`6-digit code`}
            autoFocus
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            inputMode="numeric"
            keyboardType="number-pad"
            maxLength={6}
            value={code}
            onChangeText={v => {
              setCode(v)
              if (error) setError('')
            }}
            onSubmitEditing={submit}
          />
        </TextField.Root>
      </View>
      <View style={[a.flex_row, a.justify_start]}>
        <Button testID="code-resend" label={l`Send a new code`} size="small" variant="ghost" color="secondary" onPress={send}>
          <ButtonText>
            <Trans>Send a new code</Trans>
          </ButtonText>
        </Button>
      </View>
      {!!error && (
        <View role="alert" testID="code-error">
          <Admonition type={error === errorText('unavailable') ? 'info' : 'error'}>{error}</Admonition>
        </View>
      )}
      <FormActions testID="code" isBusy={isBusy} onBack={onBack} onNext={submit} />
    </FormContainer>
  )
}
