import {useLingui} from '@lingui/react/macro'

import {type Scope, scopeSummary} from '#/screens/Analytics/scope'

/**
 * What the scope chip says ("Everything", "Non-group only", "Goa trip + 1" ...), so the chip and the Export
 * sheet's Group picker name a scope the same way. `name` gives a group's name.
 */
export function useScopeLabel(scope: Scope, groupIds: string[], name: (groupId: string) => string): string {
  const {t: l} = useLingui()
  const summary = scopeSummary(scope, groupIds)
  switch (summary.kind) {
    case 'everything':
      return l`Everything`
    case 'nonGroup':
      return l`Non-group only`
    case 'allGroups':
      return l`All groups`
    case 'group':
      return summary.more === 0 ? name(summary.groupId) : l`${name(summary.groupId)} + ${summary.more}`
    case 'groups':
      return l`${summary.count} groups`
    case 'nonGroupPlus':
      return summary.count === 1 ? l`Non-group + ${name(summary.groupId)}` : l`Non-group + ${summary.count} groups`
  }
}
