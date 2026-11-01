import {type StatementScope} from '@splito/domain'

import {isEverything, type Scope} from '#/lib/scope'

/**
 * Analytics' scope as the Export sheet's group filter: Everything is no filter, exactly one group (and no
 * non-group) is that group, anything else is the scope itself (the sheet names it in its Group picker).
 */
export function scopeToExportGroup(scope: Scope): {groupId?: string; scope?: StatementScope} {
  if (isEverything(scope)) return {}
  if (!scope.nonGroup && scope.groups !== 'all' && scope.groups.length === 1) return {groupId: scope.groups[0]}
  return {scope}
}
