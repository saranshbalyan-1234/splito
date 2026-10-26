// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/screens/Login/LoginForm.tsx, src/screens/Login/FormContainer.tsx (label-over-field layout, Admonition errors, large Back / Next buttons)
import {useState} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {isEmail, isSignInCode, normalizePhone} from '@splito/domain'

import {atoms as a, useBreakpoints, useTheme} from '#/alf'
import * as Admonition from '#/components/Admonition'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import * as TextField from '#/components/forms/TextField'
import {
  Envelope_Stroke2_Corner0_Rounded as EmailIcon,
  Key_Stroke2_Corner0_Rounded as KeyIcon,
  Phone_Stroke2_Corner0_Rounded as PhoneIcon,
} from '#/components/icons/Auth'
import * as Layout from '#/components/Layout'
import {Text} from '#/components/Typography'

type Method = 'email' | 'phone'
type Step =
  | {kind: 'choose'}
  | {kind: 'entry'; method: Method}
  | {kind: 'code'; method: Method; contact: string}

/**
 * Sign in (owner rule: Settings > Account): pick a method, enter an email
 * or phone, then the 6-digit code. Splito has no auth server yet, so the
 * screens are honest about it: every field is checked, nothing pretends a
 * code was sent, and finishing shows that sign-in arrives with sync. No
 * account or session is ever created here.
 */
export function SignInScreen() {
  const {t: l} = useLingui()
  const {gtMobile} = useBreakpoints()
  const [step, setStep] = useState<Step>({kind: 'choose'})
  /* Set once a step is finished: the honest "not yet" answer. */
  const [isNotLive, setIsNotLive] = useState(false)
  const go = (next: Step) => {
    setIsNotLive(false)
    setStep(next)
  }

  return (
    <Layout.Screen testID="screen-sign-in">
      <Layout.Header.Outer>
        <Layout.Header.BackButton />
        <Layout.Header.Content>
          <Layout.Header.TitleText>
            <Trans>Sign in</Trans>
          </Layout.Header.TitleText>
        </Layout.Header.Content>
        <Layout.Header.Slot />
      </Layout.Header.Outer>
      <Layout.Content>
        <View
          style={[
            a.w_full,
            a.gap_lg,
            a.px_xl,
            a.py_2xl,
            a.self_center,
            {maxWidth: 520},
            gtMobile && a.px_2xl,
          ]}>
          {step.kind === 'choose' ? (
            <ChooseMethod
              onMethodChosen={method => go({kind: 'entry', method})}
              onProviderChosen={() => setIsNotLive(true)}
            />
          ) : step.kind === 'entry' ? (
            <ContactEntry
              method={step.method}
              onBack={() => go({kind: 'choose'})}
              onContactEntered={contact =>
                go({kind: 'code', method: step.method, contact})
              }
            />
          ) : (
            <CodeEntry
              contact={step.contact}
              onBack={() => go({kind: 'entry', method: step.method})}
              onCodeEntered={() => setIsNotLive(true)}
            />
          )}
          {isNotLive && <NotLiveYet />}
        </View>
      </Layout.Content>
    </Layout.Screen>
  )
}

/** The honest end of every path until the auth backend exists. */
function NotLiveYet() {
  return (
    <View testID="sign-in-not-live">
      <Admonition.Outer type="info">
        <Admonition.Row>
          <Admonition.Icon />
          <Admonition.Content>
            <Admonition.Text>
              <Trans>
                Sign-in arrives with sync. Your data stays safe on this device.
              </Trans>
            </Admonition.Text>
          </Admonition.Content>
        </Admonition.Row>
      </Admonition.Outer>
    </View>
  )
}

function Intro({title, children}: {title: string; children: React.ReactNode}) {
  const t = useTheme()
  return (
    <View style={[a.gap_xs]}>
      <Text style={[a.text_3xl, a.font_bold, a.leading_tight]}>{title}</Text>
      <Text style={[a.text_md, a.leading_snug, t.atoms.text_contrast_medium]}>
        {children}
      </Text>
    </View>
  )
}

function ChooseMethod({
  onMethodChosen,
  onProviderChosen,
}: {
  onMethodChosen: (method: Method) => void
  /** Apple and Google need the auth backend for their redirect. */
  onProviderChosen: () => void
}) {
  const {t: l} = useLingui()
  const methods = [
    {
      testID: 'sign-in-apple',
      label: l`Continue with Apple`,
      onPress: onProviderChosen,
    },
    {
      testID: 'sign-in-google',
      label: l`Continue with Google`,
      onPress: onProviderChosen,
    },
  ]
  return (
    <>
      <Intro title={l`Back up and share`}>
        <Trans>
          Sign in to keep your expenses safe and share groups with friends.
        </Trans>
      </Intro>
      <View style={[a.gap_sm]}>
        {methods.map(m => (
          <Button
            key={m.testID}
            testID={m.testID}
            label={m.label}
            size="large"
            color="secondary"
            onPress={m.onPress}>
            <ButtonText>{m.label}</ButtonText>
          </Button>
        ))}
        <Button
          testID="sign-in-email"
          label={l`Continue with email`}
          size="large"
          color="secondary"
          onPress={() => onMethodChosen('email')}>
          <ButtonIcon icon={EmailIcon} position="left" />
          <ButtonText>
            <Trans>Continue with email</Trans>
          </ButtonText>
        </Button>
        <Button
          testID="sign-in-phone"
          label={l`Continue with phone`}
          size="large"
          color="secondary"
          onPress={() => onMethodChosen('phone')}>
          <ButtonIcon icon={PhoneIcon} position="left" />
          <ButtonText>
            <Trans>Continue with phone</Trans>
          </ButtonText>
        </Button>
      </View>
    </>
  )
}

function ContactEntry({
  method,
  onBack,
  onContactEntered,
}: {
  method: Method
  onBack: () => void
  onContactEntered: (contact: string) => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const [value, setValue] = useState('')
  const [isInvalid, setIsInvalid] = useState(false)
  const isEmailMethod = method === 'email'

  const submit = () => {
    const contact = isEmailMethod
      ? isEmail(value)
        ? value.trim()
        : null
      : normalizePhone(value)
    if (!contact) setIsInvalid(true)
    else onContactEntered(contact)
  }

  return (
    <>
      <Intro title={isEmailMethod ? l`Your email` : l`Your phone number`}>
        {isEmailMethod ? (
          <Trans>We’ll send a 6-digit code to this address.</Trans>
        ) : (
          <Trans>
            We’ll text a 6-digit code to this number. Include your country code.
          </Trans>
        )}
      </Intro>
      <View>
        <TextField.LabelText>
          {isEmailMethod ? <Trans>Email</Trans> : <Trans>Phone number</Trans>}
        </TextField.LabelText>
        <TextField.Root isInvalid={isInvalid}>
          <TextField.Icon icon={isEmailMethod ? EmailIcon : PhoneIcon} />
          <TextField.Input
            testID="sign-in-contact"
            label={isEmailMethod ? l`Email address` : l`Phone number`}
            placeholder={
              isEmailMethod ? l`you@example.com` : l`+91 98765 43210`
            }
            value={value}
            onChangeText={v => {
              setValue(v)
              if (isInvalid) setIsInvalid(false)
            }}
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete={isEmailMethod ? 'email' : 'tel'}
            inputMode={isEmailMethod ? 'email' : 'tel'}
            keyboardType={isEmailMethod ? 'email-address' : 'phone-pad'}
            returnKeyType="next"
            onSubmitEditing={submit}
          />
        </TextField.Root>
        {isInvalid && (
          <Text
            testID="sign-in-contact-error"
            style={[
              a.text_sm,
              a.leading_snug,
              a.mt_sm,
              {color: t.palette.negative_500},
            ]}>
            {isEmailMethod ? (
              <Trans>Enter an email like name@example.com.</Trans>
            ) : (
              <Trans>
                Enter the number with its country code, like +91 98765 43210.
              </Trans>
            )}
          </Text>
        )}
      </View>
      <Actions onBack={onBack} onNext={submit} nextLabel={l`Next`} />
    </>
  )
}

function CodeEntry({
  contact,
  onBack,
  onCodeEntered,
}: {
  contact: string
  onBack: () => void
  onCodeEntered: () => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const [code, setCode] = useState('')
  const [isInvalid, setIsInvalid] = useState(false)
  const submit = () => {
    if (!isSignInCode(code)) setIsInvalid(true)
    else onCodeEntered()
  }

  return (
    <>
      <Intro title={l`Enter the code`}>
        <Trans>The 6-digit code for {contact}.</Trans>
      </Intro>
      {/* No code is sent before sign-in is live; the screen says so rather than wait for one. */}
      <Text
        testID="sign-in-no-code"
        style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
        <Trans>
          Sign-in isn’t live yet, so no code has been sent. It arrives with
          sync.
        </Trans>
      </Text>
      <View>
        <TextField.LabelText>
          <Trans>Code</Trans>
        </TextField.LabelText>
        <TextField.Root isInvalid={isInvalid}>
          <TextField.Icon icon={KeyIcon} />
          <TextField.Input
            testID="sign-in-code"
            label={l`6-digit code`}
            placeholder={l`6-digit code`}
            value={code}
            onChangeText={v => {
              setCode(v)
              if (isInvalid) setIsInvalid(false)
            }}
            autoFocus
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            inputMode="numeric"
            keyboardType="number-pad"
            maxLength={6}
            returnKeyType="done"
            onSubmitEditing={submit}
          />
        </TextField.Root>
        {isInvalid && (
          <Text
            testID="sign-in-code-error"
            style={[
              a.text_sm,
              a.leading_snug,
              a.mt_sm,
              {color: t.palette.negative_500},
            ]}>
            <Trans>The code is 6 digits.</Trans>
          </Text>
        )}
      </View>
      <Actions onBack={onBack} onNext={submit} nextLabel={l`Sign in`} />
    </>
  )
}

/** Bluesky's login footer: Back on the left, the next step on the right. */
function Actions({
  onBack,
  onNext,
  nextLabel,
}: {
  onBack: () => void
  onNext: () => void
  nextLabel: string
}) {
  const {t: l} = useLingui()
  return (
    <View style={[a.flex_row, a.justify_between, a.gap_sm, a.pt_md]}>
      <Button
        testID="sign-in-back"
        label={l`Back`}
        color="secondary"
        size="large"
        onPress={onBack}>
        <ButtonText>
          <Trans>Back</Trans>
        </ButtonText>
      </Button>
      <Button
        testID="sign-in-next"
        label={nextLabel}
        color="primary"
        size="large"
        onPress={onNext}>
        <ButtonText>{nextLabel}</ButtonText>
      </Button>
    </View>
  )
}
