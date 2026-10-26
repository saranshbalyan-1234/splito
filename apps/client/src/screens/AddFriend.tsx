import {useState} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {useNavigation} from '@react-navigation/native'
import {DomainError} from '@splito/domain'
import {createPerson} from '@splito/sync'

import {useHaptics} from '#/lib/haptics'
import {type NavigationProp} from '#/lib/routes/types'
import {logger} from '#/logger'
import {useMutationCtx, useStore} from '#/data/hooks'
import {atoms as a, useTheme} from '#/alf'
import {Admonition} from '#/components/Admonition'
import * as FormSheet from '#/components/FormSheet'
import * as TextField from '#/components/forms/TextField'
import {Person_Stroke2_Corner2_Rounded as PersonIcon} from '#/components/icons/Person'
import {AvatarPreview} from '#/components/people/AvatarPreview'
import * as Toast from '#/components/Toast'
import {Text} from '#/components/Typography'

/**
 * Add a friend privately: a name and, optionally, the UPI ID used for pay
 * links. Friends don't need the app; invites arrive with sign-in. Opens as
 * a composer sheet (owner: close cross at the top right, the primary
 * action at the bottom).
 */
export function AddFriendScreen() {
  const t = useTheme()
  const {t: l} = useLingui()
  const navigation = useNavigation<NavigationProp>()
  const store = useStore()
  const ctx = useMutationCtx()
  const haptics = useHaptics()
  const [name, setName] = useState('')
  const [upiId, setUpiId] = useState('')
  const [error, setError] = useState<'name' | 'upi' | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const isDirty = name.trim() !== '' || upiId.trim() !== ''

  const close = () => {
    if (navigation.canGoBack()) navigation.goBack()
    else navigation.navigate('People')
  }
  const save = async () => {
    setIsSaving(true)
    try {
      const person = await createPerson(store, ctx, {name, upiId})
      haptics.success()
      Toast.show(l`${person.data.name} added`, {type: 'success'})
      close()
      navigation.navigate('Person', {personId: person.id})
    } catch (e) {
      setIsSaving(false)
      haptics.error()
      if (e instanceof DomainError && e.code === 'INVALID_NAME')
        setError('name')
      else if (e instanceof DomainError && e.code === 'INVALID_UPI')
        setError('upi')
      else {
        logger.error(e, {where: 'AddFriend.save'})
        Toast.show(l`Couldn’t add your friend. Please try again.`, {
          type: 'error',
        })
      }
    }
  }

  return (
    <FormSheet.Screen
      testID="screen-add-friend"
      title={l`Add friend`}
      closeHint={l`Closes without adding anyone`}
      isDirty={isDirty && !isSaving}
      onClose={close}
      discardDescription={l`What you typed won’t be kept.`}
      footer={{
        saveLabel: l`Add friend`,
        canSave: name.trim() !== '',
        isSaving,
        onSave: () => void save(),
      }}>
      <View style={[a.px_lg, a.pt_md, a.gap_xl]}>
        <View style={[a.flex_row, a.align_center, a.gap_md]}>
          <AvatarPreview name={name} type="user" />
          <View style={[a.flex_1, a.gap_2xs]}>
            <Text style={[a.text_xl, a.font_bold, a.leading_tight]}>
              <Trans>Split with anyone</Trans>
            </Text>
            <Text
              style={[a.text_md, a.leading_snug, t.atoms.text_contrast_medium]}>
              <Trans>Friends don’t need Splito. Only you see them.</Trans>
            </Text>
          </View>
        </View>

        <View>
          <TextField.LabelText>
            <Trans>Name</Trans>
          </TextField.LabelText>
          <TextField.Root isInvalid={error === 'name'}>
            <TextField.Icon icon={PersonIcon} />
            <TextField.Input
              testID="add-friend-name"
              label={l`Name`}
              value={name}
              onChangeText={v => {
                setName(v)
                setError(null)
              }}
              placeholder={l`e.g. Riya Sharma`}
              autoCapitalize="words"
              autoFocus
              maxLength={64}
              returnKeyType="next"
            />
          </TextField.Root>
          {error === 'name' && (
            <Text style={[a.pt_sm, a.text_sm, {color: t.palette.negative_500}]}>
              <Trans>Enter a name.</Trans>
            </Text>
          )}
        </View>

        <View>
          <TextField.LabelText>
            <Trans>UPI ID (optional)</Trans>
          </TextField.LabelText>
          <TextField.Root isInvalid={error === 'upi'}>
            <TextField.Input
              testID="add-friend-upi"
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
              onSubmitEditing={() => void save()}
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
                Lets you open your UPI app when you pay them in rupees.
              </Trans>
            )}
          </Text>
        </View>

        <Admonition type="info">
          <Trans>
            Inviting friends to Splito by link or QR is available when you sign
            in, coming with sync.
          </Trans>
        </Admonition>
      </View>
    </FormSheet.Screen>
  )
}
