import {type TextInput, View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {detectContactKind} from '@splito/domain'

import * as TextField from '#/components/forms/TextField'
import {
  Envelope_Stroke2_Corner0_Rounded as EmailIcon,
  Phone_Stroke2_Corner0_Rounded as PhoneIcon,
} from '#/components/icons/Auth'

/** The "Email or phone" field: one box, the icon follows what is typed (the directory field of § 26.18). `kind` fixes it to one of the two. */
export function ContactField({
  testID,
  value,
  kind,
  isInvalid,
  isAutoFocus = true,
  onChangeText,
  onSubmit,
  inputRef,
}: {
  testID: string
  value: string
  kind?: 'email' | 'phone'
  isInvalid: boolean
  isAutoFocus?: boolean
  onChangeText: (value: string) => void
  onSubmit: () => void
  inputRef?: React.RefObject<React.ComponentRef<typeof TextInput> | null>
}) {
  const {t: l} = useLingui()
  const shown = kind ?? detectContactKind(value)
  return (
    <View>
      <TextField.LabelText>{kind === 'email' ? <Trans>Email</Trans> : kind === 'phone' ? <Trans>Phone number</Trans> : <Trans>Email or phone</Trans>}</TextField.LabelText>
      <TextField.Root isInvalid={isInvalid}>
        <TextField.Icon icon={shown === 'phone' ? PhoneIcon : EmailIcon} />
        <TextField.Input
          testID={testID}
          inputRef={inputRef}
          label={kind === 'email' ? l`Email` : kind === 'phone' ? l`Phone number` : l`Email or phone number`}
          placeholder={null}
          autoCapitalize="none"
          autoFocus={isAutoFocus}
          autoCorrect={false}
          autoComplete={kind === 'phone' ? 'tel' : 'username'}
          keyboardType={kind === 'phone' ? 'phone-pad' : 'email-address'}
          returnKeyType="next"
          textContentType={kind === 'phone' ? 'telephoneNumber' : 'username'}
          value={value}
          onChangeText={onChangeText}
          onSubmitEditing={onSubmit}
        />
      </TextField.Root>
    </View>
  )
}
