import {useState} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {useShowHidden} from '#/data/hiddenItems'
import {ShowHiddenToggle} from '#/features/hidden/ShowHidden'
import {DisputedOnlyToggle} from '#/components/disputes/DisputedOnlyToggle'
import {atoms as a, useTheme} from '#/alf'
import * as Dialog from '#/components/Dialog'
import {IncludeGroupsToggle} from '#/components/IncludeGroupsToggle'
import {Text} from '#/components/Typography'
import * as FormSheet from '#/components/FormSheet'

/**
 * The People and person pages' filter. Changes apply only on Apply (spec:
 * filters use Apply), to both the totals and the history. The starting
 * value comes from the "Include groups by default" preference. `name` is the
 * friend on a person page; People leaves it out.
 */
export function HistoryFilterDialog({
  control,
  name,
  includeGroups,
  onFilterApplied,
  disputed,
}: {
  control: Dialog.DialogControlProps
  name?: string
  includeGroups: boolean
  onFilterApplied: (includeGroups: boolean) => void
  /** The page's "Disputed only" choice (F-1210), applied with the rest. */
  disputed?: {value: boolean; onApply: (v: boolean) => void}
}) {
  return (
    <FormSheet.Outer control={control} testID="history-filter-sheet">
      <Form
        name={name}
        includeGroups={includeGroups}
        onFilterApplied={onFilterApplied}
        disputed={disputed}
      />
    </FormSheet.Outer>
  )
}

function Form({
  name,
  includeGroups,
  onFilterApplied,
  disputed,
}: {
  name?: string
  includeGroups: boolean
  onFilterApplied: (includeGroups: boolean) => void
  disputed?: {value: boolean; onApply: (v: boolean) => void}
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const control = Dialog.useDialogContext()
  const [draft, setDraft] = useState(includeGroups)
  const [showHidden, setShowHidden] = useShowHidden()
  const [draftHidden, setDraftHidden] = useState(showHidden)
  const [draftDisputed, setDraftDisputed] = useState(disputed?.value ?? false)

  return (
    <FormSheet.Inner
      title={l`Filter`}
      isDirty={draft !== includeGroups || draftHidden !== showHidden || draftDisputed !== (disputed?.value ?? false)}
      footer={{
        saveLabel: l`Apply`,
        onSave: () =>
          control.close(() => {
            onFilterApplied(draft)
            if (draftHidden !== showHidden) void setShowHidden(draftHidden)
            disputed?.onApply(draftDisputed)
          }),
      }}>
      <View style={[a.gap_lg]}>
        <IncludeGroupsToggle value={draft} onChange={setDraft} name={name} />
        {disputed ? <DisputedOnlyToggle value={draftDisputed} onChange={setDraftDisputed} /> : null}
        <ShowHiddenToggle value={draftHidden} onChange={setDraftHidden} />
        <Text style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
          <Trans>The starting value is set in Settings › Lists.</Trans>
        </Text>
      </View>
    </FormSheet.Inner>
  )
}
