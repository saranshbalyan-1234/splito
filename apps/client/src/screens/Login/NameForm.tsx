import {useState} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {atoms as a, useTheme} from '#/alf'
import {Admonition} from '#/components/Admonition'
import * as TextField from '#/components/forms/TextField'
import {Person_Stroke2_Corner0_Rounded as PersonIcon} from '#/components/icons/Auth'
import {Text} from '#/components/Typography'
import {FormActions} from './FormActions'
import {FormContainer} from './FormContainer'

/** A new account's name (owner 139: name, email and phone are all required). */
export function NameForm({initial, onName, onBack}: {initial: string; onName: (name: string) => void; onBack: () => void}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const [name, setName] = useState(initial)
  const [error, setError] = useState('')

  const submit = () => {
    if (!name.trim()) return setError(l`Please enter your name.`)
    onName(name.trim())
  }

  return (
    <FormContainer testID="name-form" titleText={<Trans>What’s your name?</Trans>}>
      <Text style={[a.leading_snug, t.atoms.text_contrast_high]}>
        <Trans>Friends see this name.</Trans>
      </Text>
      <View>
        <TextField.LabelText>
          <Trans>Name</Trans>
        </TextField.LabelText>
        <TextField.Root isInvalid={!!error}>
          <TextField.Icon icon={PersonIcon} />
          <TextField.Input
            testID="name-input"
            label={l`Enter your name`}
            autoFocus
            autoCapitalize="words"
            autoComplete="name"
            textContentType="name"
            returnKeyType="next"
            value={name}
            onChangeText={v => {
              setName(v)
              if (error) setError('')
            }}
            onSubmitEditing={submit}
          />
        </TextField.Root>
      </View>
      {!!error && (
        <View role="alert" testID="name-error">
          <Admonition type="error">{error}</Admonition>
        </View>
      )}
      <FormActions testID="name" onBack={onBack} onNext={submit} />
    </FormContainer>
  )
}
