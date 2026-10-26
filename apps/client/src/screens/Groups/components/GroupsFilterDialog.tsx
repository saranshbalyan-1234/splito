import {useState} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {atoms as a, web} from '#/alf'
import * as Dialog from '#/components/Dialog'
import * as FormSheet from '#/components/FormSheet'
import {Text} from '#/components/Typography'
import {Choices} from '#/screens/People/components/FriendsFilterDialog'
import {type GroupFilters} from '../filter'

/**
 * Groups' filters (owner: "overview in both friends and groups, with search
 * and filters as well"): type, active or archived, one currency or all,
 * which balances to show, and the order. Nothing changes until Apply, as
 * People's filters; they drive the Overview and the list alike.
 */
export function GroupsFilterDialog({
  control,
  filters,
  currencies,
  onFiltersApplied,
}: {
  control: Dialog.DialogControlProps
  filters: GroupFilters
  /** The currencies my group balances are in. */
  currencies: string[]
  onFiltersApplied: (filters: GroupFilters) => void
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
  filters: GroupFilters
  currencies: string[]
  onFiltersApplied: (filters: GroupFilters) => void
}) {
  const {t: l} = useLingui()
  const control = Dialog.useDialogContext()
  const [draft, setDraft] = useState(filters)
  const set = (patch: Partial<GroupFilters>) =>
    setDraft(d => ({...d, ...patch}))

  return (
    <View style={[a.gap_lg]}>
      <Text style={[a.text_2xl, a.font_bold, a.leading_tight, a.pr_2xl]}>
        <Trans>Filters</Trans>
      </Text>
      <Choices
        testID="filter-type"
        title={l`Type`}
        value={draft.type}
        options={[
          {value: 'all', label: l`All`},
          {value: 'trip', label: l`Trip`},
          {value: 'home', label: l`Home`},
          {value: 'couple', label: l`Couple`},
          {value: 'other', label: l`Other`},
        ]}
        onChange={type => set({type})}
      />
      <Choices
        testID="filter-status"
        title={l`Status`}
        value={draft.status}
        options={[
          {value: 'active', label: l`Active`},
          {value: 'archived', label: l`Archived`},
        ]}
        onChange={status => set({status})}
      />
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
          {value: 'all', label: l`All`},
          {value: 'owed', label: l`You are owed`},
          {value: 'owe', label: l`You owe`},
          {value: 'settled', label: l`Settled`},
        ]}
        onChange={show => set({show})}
      />
      <Choices
        testID="filter-sort"
        title={l`Sort by`}
        value={draft.sort}
        options={[
          {value: 'recent', label: l`Recent activity`},
          {value: 'name', label: l`Name`},
          {value: 'amount', label: l`Amount`},
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
