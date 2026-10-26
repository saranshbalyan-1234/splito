import {useState} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {useNavigation} from '@react-navigation/native'
import {CURRENCIES, DomainError, parseLocalDate} from '@splito/domain'
import {createGroup, createPerson, type Group, type Person} from '@splito/sync'

import {useHaptics} from '#/lib/haptics'
import {type NavigationProp} from '#/lib/routes/types'
import {logger} from '#/logger'
import {useEntities, useMutationCtx, usePref, useStore} from '#/data/hooks'
import {UserAvatar} from '#/view/com/util/UserAvatar'
import {atoms as a, useBreakpoints, useTheme, web} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import {DateField} from '#/components/forms/DateField'
import * as SegmentedControl from '#/components/forms/SegmentedControl'
import * as TextField from '#/components/forms/TextField'
import * as Toggle from '#/components/forms/Toggle'
import {ChevronRight_Stroke2_Corner0_Rounded as ChevronIcon} from '#/components/icons/Chevron'
import {Group3_Stroke2_Corner0_Rounded as GroupIcon} from '#/components/icons/Group'
import {PlusLarge_Stroke2_Corner0_Rounded as PlusIcon} from '#/components/icons/Plus'
import * as Layout from '#/components/Layout'
import {AvatarPreview} from '#/components/people/AvatarPreview'
import {currencyName} from '#/components/people/ledger'
import * as Toast from '#/components/Toast'
import {Text} from '#/components/Typography'

const FORM_WIDTH = 560

type Kind = Group['kind']

/**
 * New group: name, kind, currency, trip dates and members. You are always a
 * member. Someone new can be added inline without leaving the form.
 */
export function CreateGroupScreen() {
  const t = useTheme()
  const {t: l, i18n} = useLingui()
  const navigation = useNavigation<NavigationProp>()
  const store = useStore()
  const ctx = useMutationCtx()
  const haptics = useHaptics()
  const people = useEntities<Person>('person')
  const [defaultCurrency] = usePref('defaultCurrency')
  const [name, setName] = useState('')
  const [kind, setKind] = useState<Kind>('trip')
  const [chosenCurrency, setCurrency] = useState<string | null>(null)
  const currency = chosenCurrency ?? defaultCurrency ?? 'INR'
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [memberIds, setMemberIds] = useState<string[]>([])
  const [newName, setNewName] = useState('')
  const [error, setError] = useState<'name' | 'dates' | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const currencyControl = Dialog.useDialogControl()

  const friends = (people ?? [])
    .filter(p => !p.data.isMe)
    .sort((x, y) => x.data.name.localeCompare(y.data.name))

  const addNewFriend = async () => {
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
  }

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
      navigation.replace('Group', {groupId: group.id})
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

  const kinds: Array<[Kind, string]> = [
    ['trip', l`Trip`],
    ['home', l`Home`],
    ['couple', l`Couple`],
    ['other', l`Other`],
  ]

  return (
    <Layout.Screen testID="screen-create-group">
      <Layout.Header.Outer>
        <Layout.Header.BackButton />
        <Layout.Header.Content>
          <Layout.Header.TitleText>
            <Trans>New group</Trans>
          </Layout.Header.TitleText>
        </Layout.Header.Content>
        <Layout.Header.Slot />
      </Layout.Header.Outer>
      <Layout.Content keyboardShouldPersistTaps="handled">
        <View
          style={[
            a.px_lg,
            a.pt_xl,
            a.pb_2xl,
            a.gap_xl,
            {maxWidth: FORM_WIDTH},
          ]}>
          <View style={[a.flex_row, a.align_center, a.gap_md]}>
            <AvatarPreview name={name} type="list" />
            <View style={[a.flex_1, a.gap_2xs]}>
              <Text style={[a.text_xl, a.font_bold, a.leading_tight]}>
                <Trans>One place for shared costs</Trans>
              </Text>
              <Text
                style={[
                  a.text_md,
                  a.leading_snug,
                  t.atoms.text_contrast_medium,
                ]}>
                <Trans>A trip, a flat or anything you split often.</Trans>
              </Text>
            </View>
          </View>

          <View>
            <TextField.LabelText>
              <Trans>Name</Trans>
            </TextField.LabelText>
            <TextField.Root isInvalid={error === 'name'}>
              <TextField.Icon icon={GroupIcon} />
              <TextField.Input
                testID="create-group-name"
                label={l`Group name`}
                value={name}
                onChangeText={v => {
                  setName(v)
                  setError(null)
                }}
                placeholder={l`e.g. Goa trip`}
                autoFocus
                maxLength={64}
              />
            </TextField.Root>
            {error === 'name' && (
              <Text
                style={[a.pt_sm, a.text_sm, {color: t.palette.negative_500}]}>
                <Trans>Enter a name.</Trans>
              </Text>
            )}
          </View>

          <View>
            <TextField.LabelText>
              <Trans>Type</Trans>
            </TextField.LabelText>
            <SegmentedControl.Root
              label={l`Group type`}
              type="radio"
              size="small"
              value={kind}
              onChange={setKind}>
              {kinds.map(([value, label]) => (
                <SegmentedControl.Item
                  key={value}
                  value={value}
                  label={label}
                  testID={`create-group-kind-${value}`}>
                  <SegmentedControl.ItemText style={[a.text_sm]}>
                    {label}
                  </SegmentedControl.ItemText>
                </SegmentedControl.Item>
              ))}
            </SegmentedControl.Root>
          </View>

          <View>
            <TextField.LabelText>
              <Trans>Currency</Trans>
            </TextField.LabelText>
            <Button
              testID="create-group-currency"
              label={l`Currency: ${currencyName(currency, i18n.locale)}`}
              size="large"
              color="secondary"
              style={[a.justify_between]}
              onPress={() => currencyControl.open()}>
              <ButtonText style={[a.flex_1, a.text_left]}>
                {currency} · {currencyName(currency, i18n.locale)}
              </ButtonText>
              <ButtonIcon icon={ChevronIcon} />
            </Button>
          </View>

          {kind === 'trip' && (
            <View>
              <TextField.LabelText>
                <Trans>Dates (optional)</Trans>
              </TextField.LabelText>
              <View style={[a.flex_row, a.gap_sm]}>
                <View style={[a.flex_1]}>
                  <DateField
                    testID="create-group-start"
                    label={l`Start date`}
                    value={startDate}
                    onChangeDate={v => {
                      setStartDate(v)
                      setError(null)
                    }}
                    isInvalid={error === 'dates'}
                  />
                </View>
                <View style={[a.flex_1]}>
                  <DateField
                    testID="create-group-end"
                    label={l`End date`}
                    value={endDate}
                    onChangeDate={v => {
                      setEndDate(v)
                      setError(null)
                    }}
                    isInvalid={error === 'dates'}
                  />
                </View>
              </View>
              {error === 'dates' && (
                <Text
                  style={[a.pt_sm, a.text_sm, {color: t.palette.negative_500}]}>
                  <Trans>
                    Check the dates: the trip can’t end before it starts.
                  </Trans>
                </Text>
              )}
            </View>
          )}

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
                style={[
                  a.flex_row,
                  a.align_center,
                  a.gap_md,
                  a.px_md,
                  a.py_sm,
                ]}>
                <UserAvatar size={32} name={l`You`} type="user" />
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

          <Button
            testID="create-group-save"
            label={l`Create group`}
            size="large"
            color="primary"
            disabled={isSaving}
            onPress={() => void save()}>
            <ButtonText>
              <Trans>Create group</Trans>
            </ButtonText>
          </Button>
        </View>
      </Layout.Content>
      <CurrencyDialog
        control={currencyControl}
        value={currency}
        onCurrencyChosen={setCurrency}
      />
    </Layout.Screen>
  )
}

function CurrencyDialog({
  control,
  value,
  onCurrencyChosen,
}: {
  control: Dialog.DialogControlProps
  value: string
  onCurrencyChosen: (code: string) => void
}) {
  const {t: l, i18n} = useLingui()
  const {gtMobile} = useBreakpoints()
  const codes = Object.keys(CURRENCIES).sort((x, y) =>
    currencyName(x, i18n.locale).localeCompare(currencyName(y, i18n.locale)),
  )
  return (
    <Dialog.Outer control={control}>
      <Dialog.Handle />
      <Dialog.ScrollableInner label={l`Currency`} style={web({maxWidth: 400})}>
        <Text style={[a.text_2xl, a.font_bold, a.pb_md, a.pr_2xl]}>
          <Trans>Currency</Trans>
        </Text>
        <Toggle.Group
          label={l`Currency`}
          type="radio"
          values={[value]}
          onChange={([code]) => {
            if (code) control.close(() => onCurrencyChosen(code))
          }}>
          {codes.map(code => (
            <Toggle.Item
              key={code}
              testID={`currency-${code}`}
              name={code}
              label={currencyName(code, i18n.locale)}
              style={[a.py_sm, gtMobile && a.px_xs]}>
              <Toggle.Radio />
              <Toggle.LabelText style={[a.flex_1, a.text_md]}>
                {currencyName(code, i18n.locale)}
              </Toggle.LabelText>
              <Text style={[a.text_sm, a.font_semi_bold]}>{code}</Text>
            </Toggle.Item>
          ))}
        </Toggle.Group>
        <Dialog.Close />
      </Dialog.ScrollableInner>
    </Dialog.Outer>
  )
}
