import {useLingui} from '@lingui/react/macro'

import * as Toggle from '#/components/forms/Toggle'

/** The "Disputed only" switch in a list's filter sheet (F-1210): only records with an open dispute or hold. Not remembered. */
export function DisputedOnlyToggle({value, onChange}: {value: boolean; onChange: (v: boolean) => void}) {
  const {t: l} = useLingui()
  return (
    <Toggle.SwitchRow
      testID="filter-disputed"
      name="disputedOnly"
      label={l`Disputed only`}
      hint={l`Show only what has an open dispute or is on hold.`}
      value={value}
      onChange={onChange}
    />
  )
}
