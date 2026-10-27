import {useState} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {ShowHiddenToggle} from '#/features/hidden/ShowHidden'
import {atoms as a, useTheme} from '#/alf'
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
  /** The one "Show hidden" switch (decision 105): the removed friends I hid come back. */
  showHidden: boolean
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
  return (
    <FormSheet.Outer control={control} testID="friends-filters-sheet">
      <Form
        filters={filters}
        currencies={currencies}
        onFiltersApplied={onFiltersApplied}
      />
    </FormSheet.Outer>
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
    <FormSheet.Inner
      title={l`Filters`}
      isDirty={JSON.stringify(draft) !== JSON.stringify(filters)}
      footer={{
        saveLabel: l`Apply`,
        onSave: () => control.close(() => onFiltersApplied(draft)),
      }}>
      <View style={[a.gap_lg]}>
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
          <Toggle.Switch />
        </Toggle.Item>

        <ShowHiddenToggle value={draft.showHidden} onChange={showHidden => set({showHidden})} />

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
      </View>
    </FormSheet.Inner>
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
  return (
    <View style={[a.gap_sm]}>
      {/* One section-label style for every block of the sheet, Include groups included. */}
      <Text style={[a.text_md, a.font_semi_bold, a.leading_snug]}>{title}</Text>
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
