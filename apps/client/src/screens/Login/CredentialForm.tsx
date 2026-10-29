// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/screens/Login/LoginForm.tsx
import {useEffect, useRef, useState} from 'react'
import {Keyboard, type TextInput, View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {type Contact, isSignInCode} from '@splito/domain'
import {formatContact} from '@splito/sync'

import {AuthError, getAuthClient} from '#/lib/auth'
import {HITSLOP_10} from '#/lib/constants'
import {type SessionAccount} from '#/state/session'
import {device} from '#/storage'
import {atoms as a, useTheme} from '#/alf'
import {Admonition} from '#/components/Admonition'
import {Button, ButtonText} from '#/components/Button'
import * as SegmentedControl from '#/components/forms/SegmentedControl'
import {PasswordField} from '#/components/forms/PasswordField'
import * as TextField from '#/components/forms/TextField'
import {Key_Stroke2_Corner0_Rounded as KeyIcon} from '#/components/icons/Auth'
import {Text} from '#/components/Typography'
import {IS_IOS} from '#/env'
import {onlyDigits} from './digits'
import {FormActions} from './FormActions'
import {FormContainer} from './FormContainer'
import {useAuthErrorText} from './messages'

type Method = 'password' | 'code'

/**
 * An existing account asks for its password or a one-time code, the person's choice (owner 144): "Password | Code" as
 * equals, the one last used on this device preselected, the other a tap away. An account without a password (made with
 * Google or Apple) sees Code only. Forgot? starts the reset (Bluesky's `ForgotPasswordForm`).
 */
export function CredentialForm({
  contact,
  hasPassword,
  onSignedIn,
  onForgotPassword,
  onBack,
}: {
  contact: Contact
  hasPassword: boolean
  onSignedIn: (account: SessionAccount) => void
  onForgotPassword: () => void
  onBack: () => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const errorText = useAuthErrorText()
  const [method, setMethod] = useState<Method>(() => (hasPassword ? (device.get(['authMethod']) ?? 'password') : 'code'))
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [isBusy, setBusy] = useState(false)
  const [isSent, setSent] = useState(false)
  const sentFor = useRef<Method | null>(null)
  const codeRef = useRef<React.ComponentRef<typeof TextInput>>(null)

  const fail = (e: unknown) => setError(errorText(e instanceof AuthError ? e.code : 'unknown'))

  const sendCode = async () => {
    setError('')
    try {
      await (await getAuthClient()).sendCode(contact, 'signin')
      setSent(true)
    } catch (e) {
      fail(e)
    }
  }

  /* Choosing Code sends one, once per visit to it. */
  useEffect(() => {
    if (method !== 'code' || sentFor.current === 'code') return
    sentFor.current = 'code'
    void sendCode()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [method])

  const submit = async () => {
    Keyboard.dismiss()
    setError('')
    if (method === 'password' && !password) return setError(l`Please enter your password`)
    if (method === 'code' && !isSignInCode(code)) return setError(l`Enter the 6-digit code.`)
    setBusy(true)
    try {
      const client = await getAuthClient()
      const account = method === 'password' ? await client.signInWithPassword(contact, password) : await client.signInWithCode(contact, code)
      device.set(['authMethod'], method)
      onSignedIn(account)
    } catch (e) {
      fail(e)
    } finally {
      setBusy(false)
    }
  }

  const switchTo = (next: Method) => {
    setMethod(next)
    setError('')
    if (next !== 'code') sentFor.current = null
  }

  return (
    <FormContainer testID="credential-form" titleText={<Trans>Welcome back</Trans>}>
      <Text testID="credential-contact" style={[a.leading_snug, t.atoms.text_contrast_high]}>
        <Trans>Signing in as {formatContact(contact)}</Trans>
      </Text>

      {hasPassword && (
        <SegmentedControl.Root label={l`How to sign in`} type="radio" value={method} onChange={switchTo}>
          <SegmentedControl.Item testID="method-password" value="password" label={l`Password`}>
            <SegmentedControl.ItemText>
              <Trans>Password</Trans>
            </SegmentedControl.ItemText>
          </SegmentedControl.Item>
          <SegmentedControl.Item testID="method-code" value="code" label={l`Code`}>
            <SegmentedControl.ItemText>
              <Trans>Code</Trans>
            </SegmentedControl.ItemText>
          </SegmentedControl.Item>
        </SegmentedControl.Root>
      )}

      {method === 'password' ? (
        <View>
          <TextField.LabelText>
            <Trans>Password</Trans>
          </TextField.LabelText>
          <PasswordField
            testID="credential-password"
            label={l`Password`}
            placeholder={null}
            autoFocus={!IS_IOS}
            autoComplete="current-password"
            returnKeyType="done"
            enablesReturnKeyAutomatically
            isInvalid={!!error}
            value={password}
            onChangeText={v => {
              setPassword(v)
              if (error) setError('')
            }}
            onSubmitEditing={submit}
            blurOnSubmit={false}
            accessibilityHint={l`Enter your password`}
          />
          <Button
            testID="credential-forgot"
            label={l`Forgot password?`}
            accessibilityHint={l`Reset your password by sending a code to your email or phone`}
            style={[a.mt_md, a.self_start]}
            hoverStyle={{opacity: 0.5}}
            hitSlop={HITSLOP_10}
            onPress={onForgotPassword}>
            <ButtonText style={[t.atoms.text_contrast_medium]}>
              <Trans>Forgot?</Trans>
            </ButtonText>
          </Button>
        </View>
      ) : (
        <View style={[a.gap_sm]}>
          <TextField.LabelText>
            <Trans>6-digit code</Trans>
          </TextField.LabelText>
          <TextField.Root isInvalid={!!error}>
            <TextField.Icon icon={KeyIcon} />
            <TextField.Input
              testID="credential-code"
              inputRef={codeRef}
              label={l`6-digit code`}
              autoFocus={!IS_IOS}
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              inputMode="numeric"
              keyboardType="number-pad"
              value={code}
              onChangeText={v => {
                setCode(onlyDigits(v))
                if (error) setError('')
              }}
              onSubmitEditing={submit}
            />
          </TextField.Root>
          <View style={[a.flex_row, a.align_center, a.justify_between]}>
            <Text testID="credential-code-sent" style={[a.text_sm, a.flex_1, t.atoms.text_contrast_medium]}>
              {isSent ? <Trans>We sent a code to {formatContact(contact)}.</Trans> : null}
            </Text>
            <Button testID="credential-resend" label={l`Send a new code`} size="small" variant="ghost" color="secondary" onPress={sendCode}>
              <ButtonText>
                <Trans>Resend</Trans>
              </ButtonText>
            </Button>
          </View>
        </View>
      )}

      {!!error && (
        <View role="alert" testID="credential-error">
          <Admonition type={error === errorText('unavailable') ? 'info' : 'error'}>{error}</Admonition>
        </View>
      )}
      <FormActions testID="credential" isBusy={isBusy} onBack={onBack} onNext={submit} />
    </FormContainer>
  )
}
