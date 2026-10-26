import {type AnalyticsScope} from '@splito/sync'

/**
 * What Analytics counts (ARCHITECTURE 26.16, one scope control): non-group
 * expenses on or off, plus every group (`'all'`, so groups made later are
 * counted too) or a chosen list. Never empty.
 */
export type Scope = {nonGroup: boolean; groups: 'all' | string[]}

export const EVERYTHING: Scope = {nonGroup: true, groups: 'all'}

/** Up to this many chosen groups the chip names the first ("Goa trip + 2"); beyond, a count. */
const NAMED_UP_TO = 3

/** Whether a record in `groupId` (null: not in a group) is counted. */
export function inScope(groupId: string | null, s: Scope) {
  return groupId === null
    ? s.nonGroup
    : s.groups === 'all' || s.groups.includes(groupId)
}

export function isEverything(s: Scope) {
  return s.nonGroup && s.groups === 'all'
}

export function scopeToPref(s: Scope): AnalyticsScope {
  return isEverything(s) ? 'everything' : s
}

/**
 * The stored scope, checked against the groups on this device (26.16 / 10:
 * restored selections pass the picker's rule): gone groups drop out, and a
 * scope left empty falls back to Everything.
 */
export function scopeFromPref(
  v: AnalyticsScope | undefined,
  groupIds: string[],
): Scope {
  if (!v || v === 'everything') return EVERYTHING
  if (v.groups === 'all') return v
  const known = new Set(groupIds)
  const groups = v.groups.filter(id => known.has(id))
  return v.nonGroup || groups.length > 0
    ? {nonGroup: v.nonGroup, groups}
    : EVERYTHING
}

/**
 * The sheet's ticks as a scope, in the sheet's order. Everything ticked is
 * Everything (groups made later count too); any other set stays the list
 * ticked, so one group is named rather than called "all". Null when nothing
 * is ticked.
 */
export function scopeFromTicks(
  nonGroup: boolean,
  ticked: string[],
  groupIds: string[],
): Scope | null {
  const on = new Set(ticked)
  const groups = groupIds.filter(id => on.has(id))
  if (nonGroup && groups.length === groupIds.length) return EVERYTHING
  return nonGroup || groups.length > 0 ? {nonGroup, groups} : null
}

/** The sheet's starting ticks: `'all'` ticks every group. */
export function ticksOf(s: Scope, groupIds: string[]) {
  return {
    nonGroup: s.nonGroup,
    groups: s.groups === 'all' ? groupIds : s.groups,
  }
}

export type ScopeSummary =
  | {kind: 'everything'}
  | {kind: 'nonGroup'}
  | {kind: 'allGroups'}
  /** One group by name, and how many more ("Goa trip + 1"). */
  | {kind: 'group'; groupId: string; more: number}
  | {kind: 'groups'; count: number}
  /** Non-group plus `count` groups; `groupId` names the first when there is one. */
  | {kind: 'nonGroupPlus'; groupId: string; count: number}

/** What the chip says, with `groupIds` in the sheet's order (the first chosen one is named). */
export function scopeSummary(s: Scope, groupIds: string[]): ScopeSummary {
  if (s.groups === 'all')
    return s.nonGroup ? {kind: 'everything'} : {kind: 'allGroups'}
  const on = new Set(s.groups)
  const chosen = groupIds.filter(id => on.has(id))
  const [first] = chosen
  if (first === undefined) return {kind: 'nonGroup'}
  if (s.nonGroup)
    return {kind: 'nonGroupPlus', groupId: first, count: chosen.length}
  return chosen.length <= NAMED_UP_TO
    ? {kind: 'group', groupId: first, more: chosen.length - 1}
    : {kind: 'groups', count: chosen.length}
}
