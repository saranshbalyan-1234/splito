import {useLingui} from '@lingui/react/macro'

import * as Toggle from '#/components/forms/Toggle'

/**
 * The "Include groups" switch of the People and person filter sheets (F-274, one switch row for both). On
 * counts balances and history from groups shared with the friend; off shows only what is between the two of
 * you. `name` is the friend on a person page; People's list leaves it out and the hint speaks of each friend.
 */
export function IncludeGroupsToggle({value, onChange, name}: {value: boolean; onChange: (v: boolean) => void; name?: string}) {
  const {t: l} = useLingui()
  const hint = name
    ? l`Count expenses and payments from groups you share with ${name}. Off shows only what is between the two of you.`
    : l`Count balances from groups you share with each friend. Off shows only what is between you and them.`
  return <Toggle.SwitchRow testID="filter-include-groups" name="includeGroups" label={l`Include groups`} hint={hint} value={value} onChange={onChange} />
}
