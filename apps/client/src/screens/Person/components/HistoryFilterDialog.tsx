import {useState} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {useShowHidden} from '#/data/hiddenItems'
import {ShowHiddenToggle} from '#/features/hidden/ShowHidden'
import {atoms as a, useTheme} from '#/alf'
import * as Dialog from '#/components/Dialog'
import * as Toggle from '#/components/forms/Toggle'
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
}: {
  control: Dialog.DialogControlProps
  name?: string
  includeGroups: boolean
  onFilterApplied: (includeGroups: boolean) => void
}) {
  return (
    <FormSheet.Outer control={control} testID="history-filter-sheet">
      <Form
        name={name}
        includeGroups={includeGroups}
        onFilterApplied={onFilterApplied}
      />
    </FormSheet.Outer>
  )
}

function Form({
  name,
  includeGroups,
  onFilterApplied,
}: {
  name?: string
  includeGroups: boolean
  onFilterApplied: (includeGroups: boolean) => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const control = Dialog.useDialogContext()
  const [draft, setDraft] = useState(includeGroups)
  const [showHidden, setShowHidden] = useShowHidden()
  const [draftHidden, setDraftHidden] = useState(showHidden)

  return (
    <FormSheet.Inner
      title={l`Filter`}
      isDirty={draft !== includeGroups || draftHidden !== showHidden}
      footer={{
        saveLabel: l`Apply`,
        onSave: () =>
          control.close(() => {
            onFilterApplied(draft)
            if (draftHidden !== showHidden) void setShowHidden(draftHidden)
          }),
      }}>
      <View style={[a.gap_lg]}>
        <Toggle.Item
          testID="filter-include-groups"
          name="includeGroups"
          label={l`Include groups`}
          value={draft}
          onChange={setDraft}
          style={[a.w_full]}>
          <View style={[a.flex_1, a.gap_2xs, a.pr_md]}>
            <Toggle.LabelText style={[a.text_md, a.font_semi_bold]}>
              <Trans>Include groups</Trans>
            </Toggle.LabelText>
            <Text
              style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
              {name ? (
                <Trans>
                  Count expenses and payments from groups you share with {name}.
                  Off shows only what is between the two of you.
                </Trans>
              ) : (
                <Trans>
                  Count balances from groups you share with each friend. Off
                  shows only what is between you and them.
                </Trans>
              )}
            </Text>
          </View>
          <Toggle.Switch />
        </Toggle.Item>
        <ShowHiddenToggle value={draftHidden} onChange={setDraftHidden} />
        <Text style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
          <Trans>The starting value is set in Settings › Lists.</Trans>
        </Text>
      </View>
    </FormSheet.Inner>
  )
}
