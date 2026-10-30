import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {atoms as a, useTheme} from '#/alf'
import * as Toggle from '#/components/forms/Toggle'
import {Text} from '#/components/Typography'

/** The "Disputed only" switch in a list's filter sheet (F-1210): only records with an open dispute or hold. Not remembered. */
export function DisputedOnlyToggle({value, onChange}: {value: boolean; onChange: (v: boolean) => void}) {
  const t = useTheme()
  const {t: l} = useLingui()
  return (
    <Toggle.Item type="switch" testID="filter-disputed" name="disputedOnly" label={l`Disputed only`} value={value} onChange={onChange} style={[a.w_full]}>
      <View style={[a.flex_1, a.gap_2xs, a.pr_md]}>
        <Toggle.LabelText style={[a.text_md, a.font_semi_bold]}>
          <Trans>Disputed only</Trans>
        </Toggle.LabelText>
        <Text style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
          <Trans>Show only what has an open dispute or is on hold.</Trans>
        </Text>
      </View>
      <Toggle.Switch />
    </Toggle.Item>
  )
}
