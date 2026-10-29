import {useState} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {useNavigation} from '@react-navigation/native'
import {DomainError, parseLocalDate} from '@splito/domain'
import {createGroup, createPerson, type Group, isRemovedFriend, type Person} from '@splito/sync'

import {useHaptics} from '#/lib/haptics'
import {useSingleFlight} from '#/lib/hooks/useSingleFlight'
import {type NavigationProp} from '#/lib/routes/types'
import {logger} from '#/logger'
import {
  useEntities,
  useMe,
  useMutationCtx,
  usePendingRequests,
  usePref,
  useStore,
} from '#/data/hooks'
import {UserAvatar} from '#/view/com/util/UserAvatar'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonIcon} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import * as TextField from '#/components/forms/TextField'
import * as Toggle from '#/components/forms/Toggle'
import {PlusLarge_Stroke2_Corner0_Rounded as PlusIcon} from '#/components/icons/Plus'
import * as FormSheet from '#/components/FormSheet'
import {GroupFields} from '#/components/groups/GroupFields'
import {AvatarPreview} from '#/components/people/AvatarPreview'
import {PendingPeople} from '#/components/people/PendingPeople'
import {CurrencyDialog} from '#/components/split/pickers'
import * as Toast from '#/components/Toast'
import {Text} from '#/components/Typography'

type Kind = Group['kind']

/**
 * New group: name, kind, currency, trip dates and members. You are always a
 * member. Someone new can be added inline without leaving the form.
 */
export function CreateGroupScreen() {
  const t = useTheme()
  const {outgoing: pending} = usePendingRequests()
  const {t: l} = useLingui()
  const navigation = useNavigation<NavigationProp>()
  const store = useStore()
  const ctx = useMutationCtx()
  const haptics = useHaptics()
  const people = useEntities<Person>('person')
  const me = useMe()
  const [defaultCurrency] = usePref('defaultCurrency')
  const [name, setName] = useState('')
  const [kind, setKind] = useState<Kind>('trip')
  const [chosenCurrency, setCurrency] = useState<string | null>(null)
  const currency = chosenCurrency ?? defaultCurrency ?? 'INR'
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [memberIds, setMemberIds] = useState<string[]>([])
  const [newName, setNewName] = useState('')
  const runOnce = useSingleFlight()
  const [error, setError] = useState<'name' | 'dates' | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const currencyControl = Dialog.useDialogControl()
  const isDirty =
    name.trim() !== '' || memberIds.length > 0 || !!startDate || !!endDate

  const close = () => {
    if (navigation.canGoBack()) navigation.goBack()
    else navigation.navigate('Groups')
  }
  const friends = (people ?? [])
    .filter(p => !p.data.isMe && !isRemovedFriend(p.data))
    .sort((x, y) => x.data.name.localeCompare(y.data.name))

  const addNewFriend = () =>
    runOnce(async () => {
      if (!newName.trim()) return
      try {
        const p = await createPerson(store, ctx, {name: newName})
        setMemberIds(ids => [...ids, p.id])
        setNewName('')
        haptics.confirm()
      } catch (e) {
        logger.error(e, {where: 'CreateGroup.addNewFriend'})
        Toast.show(l`Couldn’t add that person. Please try again.`, {
          type: 'error',
        })
      }
    })

  const save = async () => {
    const isTrip = kind === 'trip'
    try {
      if (isTrip && startDate) parseLocalDate(startDate)
      if (isTrip && endDate) parseLocalDate(endDate)
      if (isTrip && startDate && endDate && endDate < startDate)
        throw new DomainError('INVALID_DATE')
    } catch {
      haptics.error()
      setError('dates')
      return
    }
    setIsSaving(true)
    try {
      const group = await createGroup(store, ctx, {
        name,
        kind,
        currency,
        startDate: isTrip && startDate ? startDate : null,
        endDate: isTrip && endDate ? endDate : null,
        memberIds,
      })
      haptics.success()
      Toast.show(l`${group.data.name} created`, {type: 'success'})
      close()
      navigation.navigate('Group', {groupId: group.id})
    } catch (e) {
      setIsSaving(false)
      haptics.error()
      if (e instanceof DomainError && e.code === 'INVALID_NAME')
        setError('name')
      else {
        logger.error(e, {where: 'CreateGroup.save'})
        Toast.show(l`Couldn’t create the group. Please try again.`, {
          type: 'error',
        })
      }
    }
  }

  return (
    <FormSheet.Screen
      testID="screen-create-group"
      title={l`New group`}
      closeHint={l`Closes without creating the group`}
      isDirty={isDirty && !isSaving}
      onClose={close}
      discardDescription={l`What you filled in won’t be kept. Anyone you added as a new friend stays in People.`}
      footer={{
        saveLabel: l`Create group`,
        canSave: name.trim() !== '',
        isSaving,
        onSave: () => void save(),
      }}
      overlay={
        <CurrencyDialog
          control={currencyControl}
          value={currency}
          onSelect={setCurrency}
        />
      }>
      <View style={[a.px_lg, a.pt_md, a.gap_xl]}>
        <View style={[a.flex_row, a.align_center, a.gap_md]}>
          <AvatarPreview name={name} type="list" />
          <View style={[a.flex_1, a.gap_2xs]}>
            <Text style={[a.text_xl, a.font_bold, a.leading_tight]}>
              <Trans>One place for shared costs</Trans>
            </Text>
            <Text
              style={[a.text_md, a.leading_snug, t.atoms.text_contrast_medium]}>
              <Trans>A trip, a flat or anything you split often.</Trans>
            </Text>
          </View>
        </View>

        <GroupFields
          value={{name, kind, currency, startDate, endDate}}
          error={error}
          onChange={patch => {
            if (patch.name !== undefined) setName(patch.name)
            if (patch.kind) setKind(patch.kind)
            if (patch.startDate !== undefined) setStartDate(patch.startDate)
            if (patch.endDate !== undefined) setEndDate(patch.endDate)
            setError(null)
          }}
          onPressCurrency={() => currencyControl.open()}
          autoFocus
        />

        <View>
          <TextField.LabelText>
            <Trans>Members</Trans>
          </TextField.LabelText>
          <View
            style={[
              a.rounded_md,
              a.border,
              t.atoms.border_contrast_low,
              a.overflow_hidden,
            ]}>
            <View
              style={[a.flex_row, a.align_center, a.gap_md, a.px_md, a.py_sm]}>
              <UserAvatar size={32} name={me?.data.name} type="user" />
              <Text style={[a.flex_1, a.text_md, a.font_semi_bold]}>
                <Trans>You</Trans>
              </Text>
              <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
                <Trans>Always in the group</Trans>
              </Text>
            </View>
            <Toggle.Group
              label={l`Members`}
              type="checkbox"
              values={memberIds}
              onChange={setMemberIds}>
              {friends.map(friend => (
                <Toggle.Item
                  key={friend.id}
                  testID={`create-group-member-${friend.data.name}`}
                  name={friend.id}
                  label={friend.data.name}
                  style={[
                    a.px_md,
                    a.py_sm,
                    a.border_t,
                    t.atoms.border_contrast_low,
                  ]}>
                  <UserAvatar size={32} name={friend.data.name} type="user" />
                  <Toggle.LabelText style={[a.flex_1, a.text_md]}>
                    {friend.data.name}
                  </Toggle.LabelText>
                  <Toggle.Checkbox />
                </Toggle.Item>
              ))}
            </Toggle.Group>
            <PendingPeople
              pending={pending}
              avatarSize={32}
              rowStyle={[a.px_md, a.border_t, t.atoms.border_contrast_low]}
            />
            <View
              style={[
                a.flex_row,
                a.align_center,
                a.gap_sm,
                a.px_md,
                a.py_sm,
                a.border_t,
                t.atoms.border_contrast_low,
              ]}>
              <View style={[a.flex_1]}>
                <TextField.Root>
                  <TextField.Input
                    testID="create-group-new-member"
                    label={l`Add someone new`}
                    value={newName}
                    onChangeText={setNewName}
                    placeholder={l`Add someone new`}
                    autoCapitalize="words"
                    maxLength={64}
                    onSubmitEditing={() => void addNewFriend()}
                  />
                </TextField.Root>
              </View>
              <Button
                testID="create-group-add-member"
                label={l`Add member`}
                size="large"
                color="secondary"
                shape="round"
                disabled={!newName.trim()}
                onPress={() => void addNewFriend()}>
                <ButtonIcon icon={PlusIcon} />
              </Button>
            </View>
          </View>
        </View>
      </View>
    </FormSheet.Screen>
  )
}
