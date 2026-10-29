import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {atoms as a, useTheme} from '#/alf'
import * as Toggle from '#/components/forms/Toggle'
import {Text} from '#/components/Typography'

/**
 * The "Show settled" switch of the Home and Groups filter sheets (owner 90, 112; F-1413). Off by default:
 * friends and groups with nothing open leave the list. The counts line still says how many are settled and
 * no balance changes. The choice is a preference, so it survives a reload.
 */
export function ShowSettledToggle({value, onChange}: {value: boolean; onChange: (v: boolean) => void}) {
  const t = useTheme()
  const {t: l} = useLingui()
  return (
    <Toggle.Item testID="filter-settled-toggle" name="showSettled" label={l`Show settled`} value={value} onChange={onChange} style={[a.w_full]}>
      <View style={[a.flex_1, a.gap_2xs, a.pr_md]}>
        <Toggle.LabelText style={[a.text_md, a.font_semi_bold]}>
          <Trans>Show settled</Trans>
        </Toggle.LabelText>
        <Text style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
          <Trans>Keep friends and groups with nothing open in the list. Their balances count either way.</Trans>
        </Text>
      </View>
      <Toggle.Switch />
    </Toggle.Item>
  )
}
