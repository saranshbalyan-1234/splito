// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/screens/Login/LoginForm.tsx
import {useState} from 'react'
import {Keyboard, View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {type Contact} from '@splito/domain'
import {parseContact} from '@splito/sync'

import {deviceRegion} from '#/data/friends'
import {AuthError, getAuthClient, type Lookup} from '#/lib/auth'
import {atoms as a, useTheme} from '#/alf'
import {Admonition} from '#/components/Admonition'
import {LogoMark} from '#/components/brand/Logo'
import {Button, ButtonText} from '#/components/Button'
import {Text} from '#/components/Typography'
import {ContactField} from './ContactField'
import {FormActions} from './FormActions'
import {useAuthErrorText} from './messages'
import {SocialButtons} from './SocialButtons'

/**
 * The one Continue screen (owners 140, 141; Bluesky's splash look and `LoginForm` layout): Apple, Google, then
 * "Email or phone" and Continue. Continue asks the auth client whether the account exists; the next step follows
 * from the answer. There is no Create account anywhere. Dev and e2e builds add a labelled "Continue with a dev
 * account" below.
 */
export function ContinueForm({
  initialValue,
  onContinue,
  onDevAccount,
  onPublicPage,
}: {
  initialValue: string
  onContinue: (contact: Contact, lookup: Lookup) => void
  onDevAccount: () => void
  /** The pages a signed-out device may open (Help, Privacy, About). */
  onPublicPage: (page: 'help' | 'privacy' | 'about') => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const errorText = useAuthErrorText()
  const [region] = useState(deviceRegion)
  const [value, setValue] = useState(initialValue)
  const [error, setError] = useState('')
  const [isBusy, setBusy] = useState(false)

  const submit = async () => {
    Keyboard.dismiss()
    setError('')
    if (!value.trim()) return setError(l`Please enter your email or phone number`)
    const contact = parseContact(value, region)
    if (!contact) return setError(l`Enter an email like name@example.com, or a phone number with its country code like +91 98765 43210.`)
    setBusy(true)
    try {
      onContinue(contact, await (await getAuthClient()).lookup(contact))
    } catch (e) {
      setError(errorText(e instanceof AuthError ? e.code : 'unknown'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <View testID="continue-form" style={[a.gap_lg, a.w_full, a.px_xl, a.self_center, {maxWidth: 420}]}>
      <View style={[a.align_center, a.gap_md, a.pb_md]}>
        <LogoMark size={72} />
        <Text style={[a.text_3xl, a.font_bold, a.text_center]}>
          <Trans>Splito</Trans>
        </Text>
        <Text style={[a.text_md, a.font_semi_bold, a.text_center, t.atoms.text_contrast_medium]}>
          <Trans>Split bills, stay friends.</Trans>
        </Text>
      </View>

      <SocialButtons />

      <ContactField
        testID="continue-input"
        value={value}
        isInvalid={!!error}
        onChangeText={v => {
          setValue(v)
          if (error) setError('')
        }}
        onSubmit={submit}
      />
      {!!error && (
        <View role="alert" testID="continue-error">
          <Admonition type={error === errorText('unavailable') ? 'info' : 'error'}>{error}</Admonition>
        </View>
      )}
      <FormActions testID="continue" isBusy={isBusy} onNext={submit} />

      {process.env.EXPO_PUBLIC_ENV === 'preview' && (
        <View testID="preview-note" role="note">
          <Admonition type="warning">
            <Trans>Preview build: local dev account, data stays in this browser, don't use a real password.</Trans>
          </Admonition>
        </View>
      )}

      {/* Inline so a production bundle folds it away (a const from another module would not fold). */}
      {(__DEV__ || process.env.EXPO_PUBLIC_ENV === 'e2e' || process.env.EXPO_PUBLIC_ENV === 'preview') && (
        <View style={[a.gap_xs, a.pt_md, a.align_center]}>
          <Button testID="continue-dev-account" label={l`Continue with a dev account`} size="small" variant="outline" color="secondary" onPress={onDevAccount}>
            <ButtonText>
              <Trans>Continue with a dev account</Trans>
            </ButtonText>
          </Button>
          <Text style={[a.text_xs, a.text_center, t.atoms.text_contrast_medium]}>
            <Trans>Dev builds only: a local account, nothing is sent.</Trans>
          </Text>
        </View>
      )}
      <View style={[a.flex_row, a.justify_center, a.flex_wrap, a.gap_xs, a.pt_sm]}>
        {(['help', 'privacy', 'about'] as const).map(page => (
          <Button key={page} testID={`public-link-${page}`} label={{help: l`Help`, privacy: l`Privacy`, about: l`About`}[page]} size="small" variant="ghost" color="secondary" onPress={() => onPublicPage(page)}>
            <ButtonText style={[t.atoms.text_contrast_medium]}>{{help: <Trans>Help</Trans>, privacy: <Trans>Privacy</Trans>, about: <Trans>About</Trans>}[page]}</ButtonText>
          </Button>
        ))}
      </View>
    </View>
  )
}
