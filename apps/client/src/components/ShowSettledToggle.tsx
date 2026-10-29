import {Trans, useLingui} from '@lingui/react/macro'

import {atoms as a} from '#/alf'
import * as Toggle from '#/components/forms/Toggle'

/**
 * The "Show settled" switch of the Home and Groups filter sheets (owner 90, 112; F-1413). Off by default:
 * friends and groups with nothing open leave the list. The counts line still says how many are settled and
 * no balance changes. The choice is a preference, so it survives a reload.
 */
export function ShowSettledToggle({value, onChange}: {value: boolean; onChange: (v: boolean) => void}) {
  const {t: l} = useLingui()
  return (
    <Toggle.Item type="switch" testID="filter-settled-toggle" name="showSettled" label={l`Show settled`} value={value} onChange={onChange} style={[a.w_full]}>
      <Toggle.LabelText style={[a.flex_1, a.text_md, a.font_semi_bold, a.pr_md]}>
        <Trans>Show settled</Trans>
      </Toggle.LabelText>
      <Toggle.Switch />
    </Toggle.Item>
  )
}
