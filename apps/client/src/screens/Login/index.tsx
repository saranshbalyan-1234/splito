// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/screens/Login/index.tsx
import {useState} from 'react'
import {KeyboardAvoidingView} from 'react-native-keyboard-controller'
import Animated, {FadeIn, LayoutAnimationConfig} from 'react-native-reanimated'
import {useLingui} from '@lingui/react/macro'

import {type SessionAccount, useSession} from '#/state/session'
import {atoms as a, native} from '#/alf'
import {LoggedOutLayout} from '#/components/LoggedOutLayout'
import {ScreenTransition} from '#/components/ScreenTransition'
import {ChooseAccountForm} from './ChooseAccountForm'
import * as AuthLayout from './components/AuthLayout'
import {AuthLayoutNavigationContext} from './components/AuthLayout/context'
import {ForgotPasswordForm} from './ForgotPasswordForm'
import {LoginForm} from './LoginForm'
import {PasswordUpdatedForm} from './PasswordUpdatedForm'
import {SetNewPasswordForm} from './SetNewPasswordForm'

enum Forms {
  Login,
  ChooseAccount,
  ForgotPassword,
  SetNewPassword,
  PasswordUpdated,
}

const OrderedForms = [
  Forms.ChooseAccount,
  Forms.Login,
  Forms.ForgotPassword,
  Forms.SetNewPassword,
  Forms.PasswordUpdated,
] as const

export const Login = ({
  onPressBack,
  onPressCreateAccount,
}: {
  onPressBack: () => void
  onPressCreateAccount: () => void
}) => {
  const {t: l} = useLingui()
  const {accounts} = useSession()
  const [initialIdentifier, setInitialIdentifier] = useState('')
  const [currentForm, setCurrentForm] = useState<Forms>(
    accounts.length ? Forms.ChooseAccount : Forms.Login,
  )
  const [screenTransitionDirection, setScreenTransitionDirection] = useState<
    'Forward' | 'Backward'
  >('Forward')

  const onSelectAccount = (account?: SessionAccount) => {
    setInitialIdentifier(account?.contact || '')
    gotoForm(Forms.Login)
  }

  const gotoForm = (form: Forms) => {
    const index = OrderedForms.indexOf(currentForm)
    const nextIndex = OrderedForms.indexOf(form)
    setScreenTransitionDirection(index < nextIndex ? 'Forward' : 'Backward')
    setCurrentForm(form)
  }

  const handlePressBack = () => {
    onPressBack()
    setScreenTransitionDirection('Backward')
  }

  let content = null
  let title = ''
  let description = ''
  let goBack = null

  switch (currentForm) {
    case Forms.Login:
      title = l`Sign in`
      description = l`Enter your email or phone and password`
      goBack = () =>
        accounts.length ? gotoForm(Forms.ChooseAccount) : handlePressBack()
      content = (
        <LoginForm
          initialIdentifier={initialIdentifier}
          onPressBack={goBack}
          onPressForgotPassword={() => gotoForm(Forms.ForgotPassword)}
          onPressCreateAccount={onPressCreateAccount}
        />
      )
      break
    case Forms.ChooseAccount:
      title = l`Sign in`
      description = l`Select from an existing account`
      goBack = handlePressBack
      content = (
        <ChooseAccountForm
          onSelectAccount={onSelectAccount}
          onPressBack={goBack}
        />
      )
      break
    case Forms.ForgotPassword:
      title = l`Forgot Password`
      description = l`Let's get your password reset!`
      goBack = () => gotoForm(Forms.Login)
      content = (
        <ForgotPasswordForm
          onPressBack={goBack}
          onCodeEntered={() => gotoForm(Forms.SetNewPassword)}
        />
      )
      break
    case Forms.SetNewPassword:
      title = l`Forgot Password`
      description = l`Let's get your password reset!`
      goBack = () => gotoForm(Forms.ForgotPassword)
      content = (
        <SetNewPasswordForm
          onPressBack={goBack}
          onPasswordSet={() => gotoForm(Forms.PasswordUpdated)}
        />
      )
      break
    case Forms.PasswordUpdated:
      title = l`Password updated`
      description = l`You can now sign in with your new password.`
      content = (
        <PasswordUpdatedForm onPressNext={() => gotoForm(Forms.Login)} />
      )
      break
  }

  const navigation = goBack ? {goBack} : null

  return (
    <AuthLayoutNavigationContext value={navigation}>
      <Animated.View style={a.flex_1} entering={native(FadeIn.duration(90))}>
        <KeyboardAvoidingView
          testID="signIn"
          behavior="padding"
          style={a.flex_1}
          automaticOffset>
          <AuthLayout.Header.Outer>
            <AuthLayout.Header.BackButton />
            <AuthLayout.Header.Content />
            <AuthLayout.Header.Slot />
          </AuthLayout.Header.Outer>
          <LoggedOutLayout
            leadin=""
            title={title}
            description={description}
            scrollable>
            <LayoutAnimationConfig skipEntering>
              <ScreenTransition
                key={currentForm}
                direction={screenTransitionDirection}
                style={a.flex_1}>
                {content}
              </ScreenTransition>
            </LayoutAnimationConfig>
          </LoggedOutLayout>
        </KeyboardAvoidingView>
      </Animated.View>
    </AuthLayoutNavigationContext>
  )
}
