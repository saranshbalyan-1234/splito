import {useState} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {DomainError} from '@splito/domain'
import {type Entity, type Person, updatePerson} from '@splito/sync'

import {useHaptics} from '#/lib/haptics'
import {logger} from '#/logger'
import {useMutationCtx, useStore} from '#/data/hooks'
import {atoms as a, useTheme} from '#/alf'
import * as Dialog from '#/components/Dialog'
import * as TextField from '#/components/forms/TextField'
import * as Toast from '#/components/Toast'
import {Text} from '#/components/Typography'
import * as FormSheet from '#/components/FormSheet'

/**
 * Rename a friend and set the UPI ID used for pay links. For my own person
 * (Profile's Edit profile) it edits only my name.
 */
export function EditFriendDialog({
  control,
  person,
}: {
  control: Dialog.DialogControlProps
  person: Entity<Person>
}) {
  return (
    <FormSheet.Outer control={control} testID="edit-friend-sheet">
      <Form person={person} />
    </FormSheet.Outer>
  )
}

function Form({person}: {person: Entity<Person>}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const control = Dialog.useDialogContext()
  const store = useStore()
  const ctx = useMutationCtx()
  const haptics = useHaptics()
  const isMe = person.data.isMe
  const [name, setName] = useState(person.data.name)
  const [upiId, setUpiId] = useState(person.data.upiId ?? '')
  const [error, setError] = useState<'name' | 'upi' | null>(null)

  const save = async () => {
    try {
      await updatePerson(store, ctx, person.id, {name, upiId})
      haptics.confirm()
      control.close(() => Toast.show(l`Saved`, {type: 'success'}))
    } catch (e) {
      haptics.error()
      if (e instanceof DomainError && e.code === 'INVALID_NAME')
        setError('name')
      else if (e instanceof DomainError && e.code === 'INVALID_UPI')
        setError('upi')
      else {
        logger.error(e, {where: 'EditFriendDialog.save'})
        Toast.show(l`Couldn’t save. Please try again.`, {type: 'error'})
      }
    }
  }

  return (
    <FormSheet.Inner
      title={isMe ? l`Edit profile` : l`Edit friend`}
      isDirty={name !== person.data.name || upiId !== (person.data.upiId ?? '')}
      footer={{
        saveLabel: l`Save`,
        canSave: name.trim() !== '',
        onSave: () => void save(),
      }}>
      <View style={[a.gap_lg]}>
        <View>
          <TextField.LabelText>
            <Trans>Name</Trans>
          </TextField.LabelText>
          <TextField.Root isInvalid={error === 'name'}>
            <Dialog.Input
              testID="friend-name"
              label={l`Name`}
              value={name}
              onChangeText={v => {
                setName(v)
                setError(null)
              }}
              autoCapitalize="words"
              maxLength={64}
            />
          </TextField.Root>
          {error === 'name' ? (
            <Text style={[a.pt_sm, a.text_sm, {color: t.palette.negative_500}]}>
              <Trans>Enter a name.</Trans>
            </Text>
          ) : isMe ? (
            <Text
              style={[
                a.pt_sm,
                a.text_sm,
                a.leading_snug,
                t.atoms.text_contrast_medium,
              ]}>
              <Trans>Shown on your expenses and payments.</Trans>
            </Text>
          ) : null}
        </View>
        {!isMe && (
          <View>
            <TextField.LabelText>
              <Trans>UPI ID (optional)</Trans>
            </TextField.LabelText>
            <TextField.Root isInvalid={error === 'upi'}>
              <Dialog.Input
                testID="friend-upi"
                label={l`UPI ID`}
                value={upiId}
                onChangeText={v => {
                  setUpiId(v)
                  setError(null)
                }}
                placeholder="name@bank"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
              />
            </TextField.Root>
            <Text
              style={[
                a.pt_sm,
                a.text_sm,
                a.leading_snug,
                error === 'upi'
                  ? {color: t.palette.negative_500}
                  : t.atoms.text_contrast_medium,
              ]}>
              {error === 'upi' ? (
                <Trans>Enter a UPI ID like name@bank.</Trans>
              ) : (
                <Trans>
                  Used to open your UPI app when you pay them in rupees.
                </Trans>
              )}
            </Text>
          </View>
        )}
      </View>
    </FormSheet.Inner>
  )
}
