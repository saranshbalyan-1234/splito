import {useState} from 'react'
import {View} from 'react-native'
import {useLingui} from '@lingui/react/macro'
import {type Contact} from '@splito/domain'
import {parseContact} from '@splito/sync'

import {deviceRegion} from '#/data/friends'
import {atoms as a, useTheme} from '#/alf'
import {Admonition} from '#/components/Admonition'
import {Text} from '#/components/Typography'
import {ContactField} from './ContactField'
import {FormActions} from './FormActions'
import {FormContainer} from './FormContainer'

/**
 * Asks for the one contact an account still lacks (owner 139: every account has both an email and a phone, both
 * verified). Used for a new account's second contact and for the blocking "Add your ..." step.
 */
export function OtherContactForm({
  kind,
  title,
  description,
  isDisabled = false,
  disabledNote,
  onContact,
  onBack,
}: {
  kind: 'email' | 'phone'
  title: React.ReactNode
  description: React.ReactNode
  isDisabled?: boolean
  disabledNote?: React.ReactNode
  onContact: (contact: Contact) => void
  onBack?: () => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const [region] = useState(deviceRegion)
  const [value, setValue] = useState('')
  const [error, setError] = useState('')

  const submit = () => {
    const contact = parseContact(value, region)
    if (!contact || contact.kind !== kind) {
      return setError(kind === 'email' ? l`Enter an email like name@example.com.` : l`Enter a phone number with its country code, like +91 98765 43210.`)
    }
    onContact(contact)
  }

  return (
    <FormContainer testID="other-contact-form" titleText={title}>
      <Text style={[a.leading_snug, t.atoms.text_contrast_high]}>{description}</Text>
      <ContactField
        testID="other-input"
        value={value}
        kind={kind}
        isInvalid={!!error}
        onChangeText={v => {
          setValue(v)
          if (error) setError('')
        }}
        onSubmit={submit}
      />
      {!!error && (
        <View role="alert" testID="other-error">
          <Admonition type="error">{error}</Admonition>
        </View>
      )}
      {isDisabled && disabledNote && (
        <View testID="other-offline">
          <Admonition type="warning">{disabledNote}</Admonition>
        </View>
      )}
      <FormActions testID="other" isDisabled={isDisabled} onBack={onBack} onNext={submit} />
    </FormContainer>
  )
}
