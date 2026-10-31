import {useLingui} from '@lingui/react/macro'

import * as Toggle from '#/components/forms/Toggle'

/**
 * The "Show settled" switch of the Home and Groups filter sheets (owner 90, 112; F-1413). Off by default:
 * friends and groups with nothing open leave the list. The counts line still says how many are settled and
 * no balance changes. The choice is a preference, so it survives a reload.
 */
export function ShowSettledToggle({value, onChange}: {value: boolean; onChange: (v: boolean) => void}) {
  const {t: l} = useLingui()
  return <Toggle.SwitchRow testID="filter-settled-toggle" name="showSettled" label={l`Show settled`} value={value} onChange={onChange} />
}
