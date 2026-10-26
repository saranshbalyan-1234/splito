import {useState} from 'react'
import {ScrollView, View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {useNavigation} from '@react-navigation/native'
import {getCurrency} from '@splito/domain'
import {createGroup, type Group, type Person} from '@splito/sync'

import {type NavigationProp} from '#/lib/routes/types'
import {useEntities, useMutationCtx, usePref, useStore} from '#/data/hooks'
import {UserAvatar} from '#/view/com/util/UserAvatar'
import {atoms as a, useBreakpoints, useTheme, web} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import * as Composer from '#/components/Composer'
import * as Dialog from '#/components/Dialog'
import {Divider} from '#/components/Divider'
import {type Props as SVGIconProps} from '#/components/icons/common'
import {DateDialog} from '#/components/split/DateDialog'
import {DetailRow, FieldError, PlainInput} from '#/components/split/fields'
import {CalendarIcon, CoupleIcon, GroupIcon, HomeIcon, TripIcon, WalletIcon} from '#/components/split/icons'
import {PeopleDialog} from '#/components/split/PeopleDialog'
import {CurrencyDialog} from '#/components/split/pickers'
import {SectionLabel, useDisplayName, useErrorText, useFormatDay} from '#/components/split/shared'
import * as Toast from '#/components/Toast'
import {Text} from '#/components/Typography'

type Kind = Group['kind']

/**
 * New group: name, type, currency, members and (for trips) dates. Presented
 * like the Add expense composer; saving opens the new group.
 */
export function CreateGroupScreen() {
  const t = useTheme()
  const {t: l} = useLingui()
  const {gtMobile} = useBreakpoints()
  const navigation = useNavigation<NavigationProp>()
  const store = useStore()
  const ctx = useMutationCtx()
  const name = useDisplayName()
  const errorText = useErrorText()
  const formatDay = useFormatDay()
  const people = useEntities<Person>('person')
  const [defaultCurrency = 'INR'] = usePref('defaultCurrency')

  const [title, setTitle] = useState('')
  const [kind, setKind] = useState<Kind>('trip')
  const [currency, setCurrency] = useState<string>()
  const [members, setMembers] = useState<string[]>([ctx.actor])
  const [startDate, setStartDate] = useState<string | null>(null)
  const [endDate, setEndDate] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const currencyControl = Dialog.useDialogControl()
  const membersControl = Dialog.useDialogControl()
  const startControl = Dialog.useDialogControl()
  const endControl = Dialog.useDialogControl()

  const code = currency ?? defaultCurrency
  const friends = (people ?? [])
    .filter(p => !p.data.isMe)
    .sort((x, y) => x.data.name.localeCompare(y.data.name))
    .map(p => p.id)
  const isTrip = kind === 'trip'
  const isDateOrderWrong = isTrip && !!startDate && !!endDate && endDate < startDate
  const canSave = !!title.trim() && !isDateOrderWrong && !isSaving

  const kinds: Array<{kind: Kind; label: string; icon: React.ComponentType<SVGIconProps>}> = [
    {kind: 'trip', label: l`Trip`, icon: TripIcon},
    {kind: 'home', label: l`Home`, icon: HomeIcon},
    {kind: 'couple', label: l`Couple`, icon: CoupleIcon},
    {kind: 'other', label: l`Other`, icon: GroupIcon},
  ]

  const close = () => {
    if (navigation.canGoBack()) navigation.goBack()
    else navigation.navigate('Groups')
  }

  const save = async () => {
    if (!canSave) return
    setIsSaving(true)
    try {
      const group = await createGroup(store, ctx, {
        name: title,
        kind,
        currency: code,
        startDate: isTrip ? startDate : null,
        endDate: isTrip ? endDate : null,
        memberIds: members,
      })
      close()
      navigation.navigate('Group', {groupId: group.id})
      Toast.show(l`${group.data.name} created`, {type: 'success'})
    } catch (e) {
      setIsSaving(false)
      Toast.show(errorText((e as {code?: string}).code ?? ''), {type: 'error'})
    }
  }

  const others = members.filter(id => id !== ctx.actor)
  const membersValue = others.length === 0 ? l`Just you` : others.length <= 2 ? [name(ctx.actor), ...others.map(name)].join(', ') : l`You and ${others.length} others`

  return (
    <Composer.Outer testID="screen-create-group" onDismiss={close}>
      <Composer.TopBar
        onCancel={close}
        onSave={() => void save()}
        canSave={canSave}
        isSaving={isSaving}
        saveLabel={l`Create group`}
        cancelHint={l`Closes without creating a group`}>
        <Text style={[a.text_sm, a.pr_sm, t.atoms.text_contrast_medium]}>
          <Trans>New group</Trans>
        </Text>
      </Composer.TopBar>
      <ScrollView keyboardShouldPersistTaps="handled" style={[a.flex_1, web([a.flex_shrink, {minHeight: 0}])]} contentContainerStyle={[a.pb_2xl]}>
        <View style={[a.flex_row, a.align_center, a.gap_md, a.px_lg, a.pt_sm, a.pb_md]}>
          <UserAvatar size={42} name={title.trim() || '?'} type="list" />
          <PlainInput
            testID="group-name"
            value={title}
            onChangeText={setTitle}
            placeholder={l`Group name`}
            accessibilityLabel={l`Group name`}
            autoFocus={gtMobile}
            maxLength={60}
            style={[a.flex_1, a.text_xl, a.font_medium, {paddingVertical: 4}]}
          />
        </View>

        <SectionLabel>
          <Trans>Type</Trans>
        </SectionLabel>
        <View style={[a.flex_row, a.flex_wrap, a.px_lg, {marginHorizontal: -4}]} accessibilityRole="radiogroup">
          {kinds.map(k => {
            const isSelected = k.kind === kind
            const Icon = k.icon
            return (
              <View key={k.kind} style={[a.p_xs, {width: gtMobile ? '25%' : '50%'}]}>
                <Button
                  testID={`group-kind-${k.kind}`}
                  label={k.label}
                  role="radio"
                  accessibilityState={{selected: isSelected}}
                  onPress={() => setKind(k.kind)}
                  hoverStyle={isSelected ? undefined : t.atoms.bg_contrast_25}
                  style={[
                    a.w_full,
                    a.flex_row,
                    a.align_center,
                    a.justify_start,
                    a.gap_sm,
                    a.px_md,
                    a.py_md,
                    a.rounded_md,
                    a.border,
                    isSelected ? {borderColor: t.palette.primary_500, backgroundColor: t.palette.primary_25} : t.atoms.border_contrast_low,
                  ]}>
                  <Icon size="md" fill={isSelected ? t.palette.primary_500 : t.atoms.text_contrast_medium.color} />
                  <Text style={[a.text_md, a.font_medium, isSelected && {color: t.palette.primary_600}]}>{k.label}</Text>
                </Button>
              </View>
            )
          })}
        </View>

        <View style={[a.pt_lg]}>
          <Divider />
          <DetailRow
            testID="group-currency"
            icon={WalletIcon}
            label={l`Currency`}
            value={`${getCurrency(code).symbol} ${code}`}
            onPress={() => currencyControl.open()}
          />
          <DetailRow testID="group-members" icon={GroupIcon} label={l`Members`} value={membersValue} onPress={() => membersControl.open()} />
          {isTrip ? (
            <>
              <DetailRow
                testID="group-start"
                icon={CalendarIcon}
                label={l`Starts`}
                value={startDate ? formatDay(startDate, {relative: false}) : l`Not set`}
                onPress={() => startControl.open()}
              />
              <DetailRow
                testID="group-end"
                icon={CalendarIcon}
                label={l`Ends`}
                value={endDate ? formatDay(endDate, {relative: false}) : l`Not set`}
                onPress={() => endControl.open()}
              />
            </>
          ) : null}
          <Divider />
        </View>

        <View style={[a.px_lg, a.pt_md, a.gap_sm]}>
          {isDateOrderWrong ? <FieldError testID="group-date-error">{l`The trip can’t end before it starts`}</FieldError> : null}
          {isTrip && (startDate || endDate) ? (
            <Button
              testID="group-clear-dates"
              label={l`Clear trip dates`}
              size="small"
              variant="ghost"
              color="secondary"
              style={[a.self_start, {marginLeft: -12}]}
              onPress={() => {
                setStartDate(null)
                setEndDate(null)
              }}>
              <ButtonText>
                <Trans>Clear dates</Trans>
              </ButtonText>
            </Button>
          ) : null}
          <Text style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
            {isTrip ? (
              <Trans>Trip dates are optional. Expenses can still be added before or after them.</Trans>
            ) : (
              <Trans>Members can change later. Past expenses keep the people they were split with.</Trans>
            )}
          </Text>
        </View>
      </ScrollView>

      <CurrencyDialog control={currencyControl} value={code} onSelect={setCurrency} />
      <PeopleDialog
        control={membersControl}
        title={l`Members`}
        description={l`Pick friends, or type a new name to add someone without an account.`}
        candidates={[ctx.actor, ...friends]}
        selected={members}
        lockedIds={[ctx.actor]}
        allowNew
        onChange={setMembers}
      />
      <DateDialog control={startControl} title={l`Trip starts`} value={startDate ?? ''} onSelect={setStartDate} />
      <DateDialog control={endControl} title={l`Trip ends`} value={endDate ?? startDate ?? ''} onSelect={setEndDate} />
    </Composer.Outer>
  )
}
