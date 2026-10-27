// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/screens/Signup/StepInfo/index.tsx
import {useRef, useState} from 'react'
import {type TextInput, View} from 'react-native'
import {useLingui} from '@lingui/react/macro'
import {detectContactKind, MIN_PASSWORD_LENGTH} from '@splito/domain'
import {parseContact} from '@splito/sync'

import {deviceRegion} from '#/data/friends'
import {NotLiveYet} from '#/screens/Login/NotLiveYet'
import {type SignupIssue, firstSignupIssue} from '#/screens/Signup/validate'
import {atoms as a, native} from '#/alf'
import * as Admonition from '#/components/Admonition'
import {PasswordField} from '#/components/forms/PasswordField'
import * as TextField from '#/components/forms/TextField'
import {
  Envelope_Stroke2_Corner0_Rounded as EmailIcon,
  Person_Stroke2_Corner0_Rounded as PersonIcon,
  Phone_Stroke2_Corner0_Rounded as PhoneIcon,
} from '#/components/icons/Auth'
import {BackNextButtons} from '../BackNextButtons'
import {useSignupContext} from '../state'

export function StepInfo({onPressBack}: {onPressBack: () => void}) {
  const {t: l} = useLingui()
  const {state, dispatch} = useSignupContext()
  const [region] = useState(deviceRegion)
  const identifierInputRef = useRef<React.ComponentRef<typeof TextInput>>(null)
  const passwordInputRef = useRef<React.ComponentRef<typeof TextInput>>(null)

  const issueText: Record<SignupIssue, string> = {
    'name-missing': l`Please enter your name.`,
    'identifier-missing': l`Please enter your email or phone number.`,
    'identifier-invalid': l`Enter an email like name@example.com, or a phone number with its country code like +91 98765 43210.`,
    'password-missing': l`Please choose your password.`,
    'password-short': l`Your password must be at least ${MIN_PASSWORD_LENGTH} characters long.`,
  }
  const issueField = {
    'name-missing': 'name',
    'identifier-missing': 'identifier',
    'identifier-invalid': 'identifier',
    'password-missing': 'password',
    'password-short': 'password',
  } as const satisfies Record<SignupIssue, 'name' | 'identifier' | 'password'>

  const onNextPress = () => {
    const issue = firstSignupIssue(state, region)
    if (issue) {
      return dispatch({
        type: 'setError',
        value: issueText[issue],
        field: issueField[issue],
      })
    }
    /* No account is created before the auth backend exists; say so. */
    dispatch({type: 'finish'})
  }

  return (
    <>
      <View style={[a.gap_md, a.pt_lg]}>
        {!!state.error && (
          <View role="alert" testID="signupError">
            <Admonition.Admonition type="error">
              {state.error}
            </Admonition.Admonition>
          </View>
        )}
        <View>
          <TextField.LabelText>{l`Name`}</TextField.LabelText>
          <TextField.Root isInvalid={state.errorField === 'name'}>
            <TextField.Icon icon={PersonIcon} />
            <TextField.Input
              testID="nameInput"
              onChangeText={value => {
                dispatch({type: 'setName', value})
                if (state.errorField === 'name' && value.trim()) {
                  dispatch({type: 'clearError'})
                }
              }}
              label={l`Enter your name`}
              value={state.name}
              autoCapitalize="words"
              autoComplete="name"
              textContentType="name"
              returnKeyType="next"
              submitBehavior={native('submit')}
              onSubmitEditing={native(() =>
                identifierInputRef.current?.focus(),
              )}
            />
          </TextField.Root>
        </View>
        <View>
          <TextField.LabelText>{l`Email or phone`}</TextField.LabelText>
          <TextField.Root isInvalid={state.errorField === 'identifier'}>
            <TextField.Icon
              icon={
                detectContactKind(state.identifier) === 'phone'
                  ? PhoneIcon
                  : EmailIcon
              }
            />
            <TextField.Input
              testID="identifierInput"
              inputRef={identifierInputRef}
              onChangeText={value => {
                dispatch({type: 'setIdentifier', value})
                if (
                  state.errorField === 'identifier' &&
                  parseContact(value, region)
                ) {
                  dispatch({type: 'clearError'})
                }
              }}
              label={l`Email or phone number`}
              value={state.identifier}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="username"
              keyboardType="email-address"
              returnKeyType="next"
              submitBehavior={native('submit')}
              onSubmitEditing={native(() =>
                passwordInputRef.current?.focus(),
              )}
            />
          </TextField.Root>
        </View>
        <View>
          <TextField.LabelText>{l`Password`}</TextField.LabelText>
          <PasswordField
            isInvalid={state.errorField === 'password'}
            testID="passwordInput"
            inputRef={passwordInputRef}
            onChangeText={value => {
              dispatch({type: 'setPassword', value})
              if (state.errorField === 'password' && value.length >= MIN_PASSWORD_LENGTH) {
                dispatch({type: 'clearError'})
              }
            }}
            label={l`Choose your password`}
            value={state.password}
            autoComplete="new-password"
            returnKeyType="done"
            onSubmitEditing={onNextPress}
            passwordRules={`minlength: ${MIN_PASSWORD_LENGTH};`}
          />
        </View>
        {state.isNotLive && <NotLiveYet />}
      </View>
      <BackNextButtons onBackPress={onPressBack} onNextPress={onNextPress} />
    </>
  )
}
