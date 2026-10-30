import {useState} from 'react'
import {View} from 'react-native'
import {useLingui} from '@lingui/react/macro'
import {ACTIVITY_TYPE_IDS, type ActivityTypeId} from '@splito/sync'

import {atoms as a} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import * as FormSheet from '#/components/FormSheet'
import {Text} from '#/components/Typography'

/**
 * Activity's Filters (owner 173): which types of change to list, any number. Nothing chosen is every type.
 * Nothing changes until Apply, as every list's filters (26.12); the tabs All / Me / Others sit on the page.
 */
export function ActivityFilterDialog({
  control,
  types,
  group,
  person,
  onFiltersApplied,
}: {
  control: Dialog.DialogControlProps
  types: readonly ActivityTypeId[]
  /** The group or friend the list is scoped to (owner 194), shown as a removable chip. */
  group?: {name: string}
  person?: {name: string}
  onFiltersApplied: (types: ActivityTypeId[], scope: {group: boolean; person: boolean}) => void
}) {
  return (
    <FormSheet.Outer control={control} testID="activity-filters-sheet">
      <Form types={types} group={group} person={person} onFiltersApplied={onFiltersApplied} />
    </FormSheet.Outer>
  )
}

function Form({types, group, person, onFiltersApplied}: {types: readonly ActivityTypeId[]; group?: {name: string}; person?: {name: string}; onFiltersApplied: (types: ActivityTypeId[], scope: {group: boolean; person: boolean}) => void}) {
  const {t: l} = useLingui()
  const control = Dialog.useDialogContext()
  const [draft, setDraft] = useState<readonly ActivityTypeId[]>(types)
  const [isGroupOn, setIsGroupOn] = useState(!!group)
  const [isPersonOn, setIsPersonOn] = useState(!!person)
  const labels: Record<ActivityTypeId, string> = {
    expenses: l`Expenses`,
    payments: l`Payments`,
    comments: l`Comments`,
    groups: l`Groups`,
    friends: l`Friends and invites`,
    reminders: l`Reminders`,
    disputes: l`Disputes`,
  }
  const toggle = (id: ActivityTypeId) => setDraft(d => (d.includes(id) ? d.filter(x => x !== id) : ACTIVITY_TYPE_IDS.filter(x => x === id || d.includes(x))))

  return (
    <FormSheet.Inner
      deferBody
      title={l`Filters`}
      isDirty={draft.join() !== types.join() || isGroupOn !== !!group || isPersonOn !== !!person}
      footer={{
        saveLabel: l`Apply`,
        onSave: () => control.close(() => onFiltersApplied([...draft], {group: isGroupOn, person: isPersonOn})),
      }}>
      <View style={[a.gap_sm]}>
        {group || person ? (
          <View testID="filter-scope" style={[a.flex_row, a.flex_wrap, a.gap_xs]}>
            {person ? (
              <Button testID="filter-person" label={l`Only ${person.name}`} role="checkbox" aria-checked={isPersonOn} accessibilityState={{checked: isPersonOn}} size="small" color={isPersonOn ? 'primary' : 'secondary'} onPress={() => setIsPersonOn(x => !x)}>
                <ButtonText>{person.name}</ButtonText>
              </Button>
            ) : null}
            {group ? (
              <Button testID="filter-group" label={l`Only ${group.name}`} role="checkbox" aria-checked={isGroupOn} accessibilityState={{checked: isGroupOn}} size="small" color={isGroupOn ? 'primary' : 'secondary'} onPress={() => setIsGroupOn(x => !x)}>
                <ButtonText>{group.name}</ButtonText>
              </Button>
            ) : null}
          </View>
        ) : null}
        <Text style={[a.text_md, a.font_semi_bold, a.leading_snug]}>{l`Type`}</Text>
        <View role="group" accessibilityLabel={l`Type`} style={[a.flex_row, a.flex_wrap, a.gap_xs]}>
          {/* Nothing chosen is every type: "All" clears the choice. */}
          <Button
            testID="filter-type-all"
            label={l`All`}
            role="checkbox"
            aria-checked={draft.length === 0}
            accessibilityState={{checked: draft.length === 0}}
            size="small"
            color={draft.length === 0 ? 'primary' : 'secondary'}
            onPress={() => setDraft([])}>
            <ButtonText>{l`All`}</ButtonText>
          </Button>
          {ACTIVITY_TYPE_IDS.map(id => {
            const isOn = draft.includes(id)
            return (
              <Button
                key={id}
                testID={`filter-type-${id}`}
                label={labels[id]}
                role="checkbox"
                aria-checked={isOn}
                accessibilityState={{checked: isOn}}
                size="small"
                color={isOn ? 'primary' : 'secondary'}
                onPress={() => toggle(id)}>
                <ButtonText>{labels[id]}</ButtonText>
              </Button>
            )
          })}
        </View>
      </View>
    </FormSheet.Inner>
  )
}
