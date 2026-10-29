// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/screens/Login/index.tsx
import {useState} from 'react'
import {ScrollView, View} from 'react-native'
import {KeyboardAvoidingView} from 'react-native-keyboard-controller'
import Animated, {FadeIn, LayoutAnimationConfig} from 'react-native-reanimated'
import {useLingui} from '@lingui/react/macro'
import {type Contact} from '@splito/domain'

import {getAuthClient, getDevAccount, type Lookup} from '#/lib/auth'
import {sessionApi} from '#/state/session'
import {atoms as a, native} from '#/alf'
import {AppLanguageDropdown} from '#/components/AppLanguageDropdown'
import {LoggedOutLayout} from '#/components/LoggedOutLayout'
import {ScreenTransition} from '#/components/ScreenTransition'
import * as AuthLayout from './components/AuthLayout'
import {AuthLayoutNavigationContext} from './components/AuthLayout/context'
import {CodeForm} from './CodeForm'
import {ContinueForm} from './ContinueForm'
import {CredentialForm} from './CredentialForm'
import {ForgotPasswordForm} from './ForgotPasswordForm'
import {NameForm} from './NameForm'
import {OtherContactForm} from './OtherContactForm'
import {PasswordUpdatedForm} from './PasswordUpdatedForm'
import {SetNewPasswordForm} from './SetNewPasswordForm'

/*
 * The steps of the one Continue flow (owners 140, 141, 144). An existing account goes contact -> credential (-> forgot
 * -> reset -> updated -> credential). A new one goes contact -> verify -> name -> other -> otherVerify -> password and
 * is signed in when the password is set; both of its contacts are verified by then (owner 139).
 */
type Step = 'contact' | 'credential' | 'forgot' | 'reset' | 'updated' | 'verify' | 'name' | 'other' | 'otherVerify' | 'password'
const ORDER: Step[] = ['contact', 'credential', 'forgot', 'reset', 'updated', 'verify', 'name', 'other', 'otherVerify', 'password']

type Draft = {contact?: Contact; lookup?: Lookup; name: string; other?: Contact}

export function Login() {
  const {t: l} = useLingui()
  const [step, setStep] = useState<Step>('contact')
  const [direction, setDirection] = useState<'Forward' | 'Backward'>('Forward')
  const [draft, setDraft] = useState<Draft>({name: ''})
  const contact = draft.contact!
  const otherKind = contact?.kind === 'email' ? 'phone' : 'email'

  const go = (next: Step) => {
    setDirection(ORDER.indexOf(next) >= ORDER.indexOf(step) ? 'Forward' : 'Backward')
    setStep(next)
  }

  const devAccount = async () => sessionApi.signIn(await getDevAccount())

  const createAccount = async (password: string) => {
    const [email, phone] = contact.kind === 'email' ? [contact, draft.other!] : [draft.other!, contact]
    sessionApi.signIn(await (await getAuthClient()).createAccount({name: draft.name, email: email.value, phone: phone.value, password}))
  }

  let content: React.ReactNode = null
  let title = ''
  let description = ''
  let goBack: (() => void) | null = null

  switch (step) {
    case 'contact':
      content = (
        <ContinueForm
          initialValue={contact?.value ?? ''}
          onDevAccount={devAccount}
          onContinue={(c, lookup) => {
            setDraft(d => ({...d, contact: c, lookup}))
            go(lookup.exists ? 'credential' : 'verify')
          }}
        />
      )
      break
    case 'credential':
      title = l`Welcome back`
      description = l`Enter your password or a one-time code`
      goBack = () => go('contact')
      content = (
        <CredentialForm
          contact={contact}
          hasPassword={draft.lookup?.hasPassword ?? false}
          onSignedIn={sessionApi.signIn}
          onForgotPassword={() => go('forgot')}
          onBack={goBack}
        />
      )
      break
    case 'forgot':
      title = l`Forgot Password`
      description = l`Let's get your password reset!`
      goBack = () => go('credential')
      content = <ForgotPasswordForm contact={contact} onPressBack={goBack} onCodeSent={() => go('reset')} onCodeEntered={() => go('reset')} />
      break
    case 'reset':
      title = l`Forgot Password`
      description = l`Let's get your password reset!`
      goBack = () => go('forgot')
      content = (
        <SetNewPasswordForm
          title={l`Set new password`}
          description={l`You will receive a “reset code” by email or text. Enter that code here, then enter your new password.`}
          needsCode
          onPressBack={goBack}
          onSubmit={async (code, password) => {
            await (await getAuthClient()).resetPassword(contact, code, password)
            go('updated')
          }}
        />
      )
      break
    case 'updated':
      title = l`Password updated`
      description = l`You can now sign in with your new password.`
      content = <PasswordUpdatedForm onPressNext={() => go('credential')} />
      break
    case 'verify':
      title = l`Create your account`
      description = l`We’ll create your account`
      goBack = () => go('contact')
      content = (
        <CodeForm
          contact={contact}
          purpose="signup"
          title={l`We’ll create your account`}
          hint={l`Enter it to continue.`}
          onVerified={() => go('name')}
          onBack={goBack}
        />
      )
      break
    case 'name':
      title = l`Create your account`
      description = l`We’ll create your account`
      goBack = () => go('verify')
      content = (
        <NameForm
          initial={draft.name}
          onName={name => {
            setDraft(d => ({...d, name}))
            go('other')
          }}
          onBack={goBack}
        />
      )
      break
    case 'other':
      title = l`Create your account`
      description = l`We’ll create your account`
      goBack = () => go('name')
      content = (
        <OtherContactForm
          kind={otherKind}
          title={otherKind === 'phone' ? l`Add your phone number` : l`Add your email`}
          description={otherKind === 'phone' ? l`Every account has a verified phone number and email. We’ll send a code to confirm this one.` : l`Every account has a verified email and phone number. We’ll send a code to confirm this one.`}
          onContact={other => {
            setDraft(d => ({...d, other}))
            go('otherVerify')
          }}
          onBack={goBack}
        />
      )
      break
    case 'otherVerify':
      title = l`Create your account`
      description = l`We’ll create your account`
      goBack = () => go('other')
      content = <CodeForm contact={draft.other!} purpose="signup" title={otherKind === 'phone' ? l`Confirm your phone number` : l`Confirm your email`} onVerified={() => go('password')} onBack={goBack} />
      break
    case 'password':
      title = l`Create your account`
      description = l`We’ll create your account`
      goBack = () => go('otherVerify')
      content = (
        <SetNewPasswordForm
          testID="passwordForm"
          title={l`Choose a password`}
          description={l`Use at least 8 characters. You can sign in with it, or with a code, any time.`}
          needsCode={false}
          submitLabel={l`Create account`}
          onPressBack={goBack}
          onSubmit={(_code, password) => createAccount(password)}
        />
      )
      break
  }

  const navigation = goBack ? {goBack} : null

  return (
    <AuthLayoutNavigationContext value={navigation}>
      <Animated.View style={a.flex_1} entering={native(FadeIn.duration(90))}>
        <KeyboardAvoidingView testID="signIn" behavior="padding" style={a.flex_1} automaticOffset>
          {step === 'contact' ? (
            <ScrollView style={a.flex_1} keyboardShouldPersistTaps="handled" contentContainerStyle={[a.flex_grow, a.justify_center, a.py_2xl]}>
              <ScreenTransition key={step} direction={direction} style={a.w_full}>
                {content}
              </ScreenTransition>
              <View style={[a.align_center, a.pt_2xl]}>
                <AppLanguageDropdown isDevice />
              </View>
            </ScrollView>
          ) : (
            <>
              <AuthLayout.Header.Outer>
                <AuthLayout.Header.BackButton />
                <AuthLayout.Header.Content />
                <AuthLayout.Header.Slot />
              </AuthLayout.Header.Outer>
              <LoggedOutLayout leadin="" title={title} description={description} scrollable>
                <LayoutAnimationConfig skipEntering>
                  <ScreenTransition key={step} direction={direction} style={a.flex_1}>
                    {content}
                  </ScreenTransition>
                </LayoutAnimationConfig>
              </LoggedOutLayout>
            </>
          )}
        </KeyboardAvoidingView>
      </Animated.View>
    </AuthLayoutNavigationContext>
  )
}
