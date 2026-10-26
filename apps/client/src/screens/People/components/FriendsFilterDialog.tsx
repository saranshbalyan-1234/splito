import {useState} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {atoms as a, useTheme, web} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import * as Toggle from '#/components/forms/Toggle'
import * as FormSheet from '#/components/FormSheet'
import {Text} from '#/components/Typography'
import {type FriendFilter} from '../sort'

/** Everything the People filter sets; applied together with Apply. */
export type PeopleFilters = FriendFilter & {
  includeGroups: boolean
  sort: 'amount' | 'name' | 'recent'
}

/**
 * People's filters (owner: "filters option in friends, also add option for
 * include group there"): Include groups, one currency or all, which
 * balances to show, and the order. Nothing changes until Apply (spec:
 * filters use Apply); they drive the summary card and the list alike.
 */
export function FriendsFilterDialog({
  control,
  filters,
  currencies,
  onFiltersApplied,
}: {
  control: Dialog.DialogControlProps
  filters: PeopleFilters
  /** The currencies friends' balances are in. */
  currencies: string[]
  onFiltersApplied: (filters: PeopleFilters) => void
}) {
  const {t: l} = useLingui()
  return (
    <Dialog.Outer control={control} nativeOptions={{preventExpansion: true}}>
      <Dialog.Handle />
      <Dialog.ScrollableInner label={l`Filters`} style={web({maxWidth: 480})}>
        <Form
          filters={filters}
          currencies={currencies}
          onFiltersApplied={onFiltersApplied}
        />
        <Dialog.Close />
      </Dialog.ScrollableInner>
    </Dialog.Outer>
  )
}

function Form({
  filters,
  currencies,
  onFiltersApplied,
}: {
  filters: PeopleFilters
  currencies: string[]
  onFiltersApplied: (filters: PeopleFilters) => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const control = Dialog.useDialogContext()
  const [draft, setDraft] = useState(filters)
  const set = (patch: Partial<PeopleFilters>) =>
    setDraft(d => ({...d, ...patch}))

  return (
    <View style={[a.gap_lg]}>
      <Text style={[a.text_2xl, a.font_bold, a.leading_tight, a.pr_2xl]}>
        <Trans>Filters</Trans>
      </Text>
      <Toggle.Item
        testID="filter-include-groups"
        name="includeGroups"
        label={l`Include groups`}
        value={draft.includeGroups}
        onChange={includeGroups => set({includeGroups})}
        style={[a.w_full]}>
        <View style={[a.flex_1, a.gap_2xs, a.pr_md]}>
          <Toggle.LabelText style={[a.text_md, a.font_semi_bold]}>
            <Trans>Include groups</Trans>
          </Toggle.LabelText>
          <Text
            style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
            <Trans>
              Count balances from groups you share with each friend. Off shows
              only what is between you and them.
            </Trans>
          </Text>
        </View>
        <Toggle.Platform />
      </Toggle.Item>

      {currencies.length > 1 && (
        <Choices
          testID="filter-currency"
          title={l`Currency`}
          value={draft.currency}
          options={[
            {value: 'all', label: l`All`},
            ...currencies.map(c => ({value: c, label: c})),
          ]}
          onChange={currency => set({currency})}
        />
      )}
      <Choices
        testID="filter-show"
        title={l`Show`}
        value={draft.show}
        options={[
          {value: 'all', label: l`Everyone`},
          {value: 'owesYou', label: l`Owes you`},
          {value: 'youOwe', label: l`You owe`},
          {value: 'settled', label: l`Settled`},
        ]}
        onChange={show => set({show})}
      />
      <Choices
        testID="filter-sort"
        title={l`Sort by`}
        value={draft.sort}
        options={[
          {value: 'amount', label: l`Amount`},
          {value: 'name', label: l`Name`},
          {value: 'recent', label: l`Recent`},
        ]}
        onChange={sort => set({sort})}
      />

      <FormSheet.Actions
        saveTestID="filter-apply"
        cancelTestID="filter-cancel"
        saveLabel={l`Apply`}
        onCancel={() => control.close()}
        onSave={() => control.close(() => onFiltersApplied(draft))}
      />
    </View>
  )
}

/** One single-choice row of chips, as the split modes pick. */
export function Choices<V extends string>({
  testID,
  title,
  value,
  options,
  onChange,
}: {
  testID: string
  title: string
  value: V
  options: {value: V; label: string}[]
  onChange: (value: V) => void
}) {
  const t = useTheme()
  return (
    <View style={[a.gap_sm]}>
      <Text style={[a.text_sm, a.font_semi_bold, t.atoms.text_contrast_medium]}>
        {title}
      </Text>
      <View
        role="radiogroup"
        accessibilityLabel={title}
        style={[a.flex_row, a.flex_wrap, a.gap_xs]}>
        {options.map(option => {
          const isOn = option.value === value
          return (
            <Button
              key={option.value}
              testID={`${testID}-${option.value}`}
              label={option.label}
              role="radio"
              aria-checked={isOn}
              accessibilityState={{checked: isOn}}
              size="small"
              color={isOn ? 'primary' : 'secondary'}
              onPress={() => onChange(option.value)}>
              <ButtonText>{option.label}</ButtonText>
            </Button>
          )
        })}
      </View>
    </View>
  )
}
