import {useState} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {useNavigation} from '@react-navigation/native'
import {createPerson, type Person} from '@splito/sync'

import {type NavigationProp} from '#/lib/routes/types'
import {useEntities, useMutationCtx, useStore} from '#/data/hooks'
import {UserAvatar} from '#/view/com/util/UserAvatar'
import {atoms as a, useBreakpoints, useTheme} from '#/alf'
import * as Composer from '#/components/Composer'
import {Divider} from '#/components/Divider'
import {Cloud_Stroke2_Corner0_Rounded as CloudIcon} from '#/components/icons/Cloud'
import {PlainInput} from '#/components/split/fields'
import {useErrorText} from '#/components/split/shared'
import * as Toast from '#/components/Toast'
import {Text} from '#/components/Typography'

/**
 * Add a friend by name - no account, invite or app needed. Presented like
 * the Add expense composer. Invites need sign-in and sync, so that row says
 * so instead of pretending.
 */
export function AddFriendScreen() {
  const t = useTheme()
  const {t: l} = useLingui()
  const {gtMobile} = useBreakpoints()
  const navigation = useNavigation<NavigationProp>()
  const store = useStore()
  const ctx = useMutationCtx()
  const errorText = useErrorText()
  const people = useEntities<Person>('person')
  const [name, setName] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const trimmed = name.trim()
  const duplicate = people?.find(
    p => !p.data.isMe && p.data.name.toLowerCase() === trimmed.toLowerCase(),
  )

  const close = () => {
    if (navigation.canGoBack()) navigation.goBack()
    else navigation.navigate('People')
  }

  const save = async () => {
    if (!trimmed || isSaving) return
    setIsSaving(true)
    try {
      const person = await createPerson(store, ctx, {name: trimmed})
      close()
      Toast.show(
        <Toast.Outer>
          <Toast.Icon />
          <Toast.Text>
            <Trans>{person.data.name} added</Trans>
          </Toast.Text>
          <Toast.Action
            label={l`Add an expense with ${person.data.name}`}
            onPress={() =>
              navigation.navigate('AddExpense', {personId: person.id})
            }>
            <Trans>Add expense</Trans>
          </Toast.Action>
        </Toast.Outer>,
        {type: 'success'},
      )
    } catch (e) {
      setIsSaving(false)
      Toast.show(errorText((e as {code?: string}).code ?? ''), {type: 'error'})
    }
  }

  return (
    <Composer.Outer testID="screen-add-friend" onDismiss={close}>
      <Composer.TopBar
        onCancel={close}
        onSave={() => void save()}
        canSave={!!trimmed}
        isSaving={isSaving}
        saveLabel={l`Add friend`}
        cancelHint={l`Closes without adding anyone`}>
        <Text style={[a.text_sm, a.pr_sm, t.atoms.text_contrast_medium]}>
          <Trans>New friend</Trans>
        </Text>
      </Composer.TopBar>
      <View
        style={[
          a.flex_row,
          a.align_center,
          a.gap_md,
          a.px_lg,
          a.pt_sm,
          a.pb_lg,
        ]}>
        <UserAvatar size={42} name={trimmed || '?'} type="user" />
        <PlainInput
          testID="friend-name"
          value={name}
          onChangeText={setName}
          placeholder={l`Friend’s name`}
          accessibilityLabel={l`Name`}
          autoFocus={gtMobile}
          autoCapitalize="words"
          autoComplete="name"
          maxLength={60}
          returnKeyType="done"
          onSubmitEditing={() => void save()}
          style={[a.flex_1, a.text_xl, a.font_medium, {paddingVertical: 4}]}
        />
      </View>
      <Text
        style={[
          a.px_lg,
          a.pb_lg,
          a.text_md,
          a.leading_snug,
          t.atoms.text_contrast_medium,
        ]}>
        {duplicate ? (
          <Trans>
            You already have a friend called {duplicate.data.name}. You can
            still add another.
          </Trans>
        ) : (
          <Trans>
            Friends don’t need an account or the app. Only you see this name.
          </Trans>
        )}
      </Text>
      <Divider />
      <View
        testID="friend-invite-unavailable"
        style={[a.flex_row, a.align_center, a.gap_md, a.px_lg, a.py_lg]}>
        <View
          style={[
            a.align_center,
            a.justify_center,
            a.rounded_full,
            t.atoms.bg_contrast_25,
            {width: 36, height: 36},
          ]}>
          <CloudIcon size="md" fill={t.atoms.text_contrast_medium.color} />
        </View>
        <View style={[a.flex_1, a.gap_2xs]}>
          <Text
            style={[a.text_md, a.font_medium, t.atoms.text_contrast_medium]}>
            <Trans>Invite to Splito</Trans>
          </Text>
          <Text
            style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
            <Trans>
              Available when you sign in – they’ll see the balances you share.
            </Trans>
          </Text>
        </View>
      </View>
    </Composer.Outer>
  )
}
