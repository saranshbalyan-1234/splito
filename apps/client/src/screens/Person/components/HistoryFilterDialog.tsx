import {useState} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {atoms as a, useTheme, web} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import * as Toggle from '#/components/forms/Toggle'
import {Text} from '#/components/Typography'

/**
 * The person page's filter. Changes apply only on Apply (spec: filters use
 * Apply), to both the totals and the history. The starting value comes from
 * the "Include groups by default" preference.
 */
export function HistoryFilterDialog({
  control,
  name,
  includeGroups,
  onFilterApplied,
}: {
  control: Dialog.DialogControlProps
  name: string
  includeGroups: boolean
  onFilterApplied: (includeGroups: boolean) => void
}) {
  const {t: l} = useLingui()
  return (
    <Dialog.Outer control={control} nativeOptions={{preventExpansion: true}}>
      <Dialog.Handle />
      <Dialog.ScrollableInner label={l`Filter`} style={web({maxWidth: 400})}>
        <Form
          name={name}
          includeGroups={includeGroups}
          onFilterApplied={onFilterApplied}
        />
        <Dialog.Close />
      </Dialog.ScrollableInner>
    </Dialog.Outer>
  )
}

function Form({
  name,
  includeGroups,
  onFilterApplied,
}: {
  name: string
  includeGroups: boolean
  onFilterApplied: (includeGroups: boolean) => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const control = Dialog.useDialogContext()
  const [draft, setDraft] = useState(includeGroups)

  return (
    <View style={[a.gap_lg]}>
      <Text style={[a.text_2xl, a.font_bold, a.leading_tight, a.pr_2xl]}>
        <Trans>Filter</Trans>
      </Text>
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
            <Trans>
              Count expenses and payments from groups you share with {name}. Off
              shows only what is between the two of you.
            </Trans>
          </Text>
        </View>
        <Toggle.Platform />
      </Toggle.Item>
      <Text style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
        <Trans>The starting value is set in Settings › Lists.</Trans>
      </Text>
      <Button
        testID="filter-apply"
        label={l`Apply`}
        size="large"
        color="primary"
        onPress={() => control.close(() => onFilterApplied(draft))}>
        <ButtonText>
          <Trans>Apply</Trans>
        </ButtonText>
      </Button>
    </View>
  )
}
