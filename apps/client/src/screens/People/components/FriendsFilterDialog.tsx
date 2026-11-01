import {useState} from 'react'
import {View} from 'react-native'
import {useLingui} from '@lingui/react/macro'

import {ShowHiddenToggle} from '#/features/hidden/ShowHidden'
import {ShowSettledToggle} from '#/components/ShowSettledToggle'
import {atoms as a} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import {IncludeGroupsToggle} from '#/components/IncludeGroupsToggle'
import * as FormSheet from '#/components/FormSheet'
import {Text} from '#/components/Typography'
import {type FriendFilter} from '../sort'

/** Everything the People filter sets; applied together with Apply. */
export type PeopleFilters = FriendFilter & {
  includeGroups: boolean
  /** The one "Show hidden" switch (decision 105): the removed friends I hid come back. */
  showHidden: boolean
  /** "Show settled" (decision 90, 112): off, friends settled up leave the list. */
  showSettled: boolean
}

/**
 * People's filters (owner: "filters option in friends, also add option for
 * include group there"): Include groups, one currency or all, which
 * balances to show. The order is its own Sort button (owner 199). Nothing changes until Apply (spec:
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
  const {t: l} = useLingui()
  const control = Dialog.useDialogContext()
  const [draft, setDraft] = useState(filters)
  const set = (patch: Partial<PeopleFilters>) =>
    setDraft(d => ({...d, ...patch}))

  return (
    <FormSheet.Inner
      deferBody
      title={l`Filters`}
      isDirty={JSON.stringify(draft) !== JSON.stringify(filters)}
      footer={{
        saveLabel: l`Apply`,
        onSave: () => control.close(() => onFiltersApplied(draft)),
      }}>
      <View style={[a.gap_lg]}>
        <IncludeGroupsToggle value={draft.includeGroups} onChange={includeGroups => set({includeGroups})} />

        <ShowSettledToggle value={draft.showSettled} onChange={showSettled => set({showSettled})} />
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
          ]}
          onChange={show => set({show})}
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
