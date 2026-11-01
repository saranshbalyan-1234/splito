import {expect, test} from 'bun:test'

import {
  EVERYTHING,
  inScope,
  scopeFromParam,
  scopeFromPref,
  scopeFromTicks,
  scopeSummary,
  scopeToParam,
  scopeToPref,
  ticksOf,
} from './scope'

const GROUPS = ['goa', 'lisbon', 'flat']

test('Everything counts non-group expenses and every group, new ones included', () => {
  expect(inScope(null, EVERYTHING)).toBe(true)
  expect(inScope('goa', EVERYTHING)).toBe(true)
  expect(inScope('made-later', EVERYTHING)).toBe(true)
})

test('non-group only, all groups only, and a chosen list', () => {
  const nonGroup = {nonGroup: true, groups: []}
  expect(inScope(null, nonGroup)).toBe(true)
  expect(inScope('goa', nonGroup)).toBe(false)

  const allGroups = {nonGroup: false, groups: 'all' as const}
  expect(inScope(null, allGroups)).toBe(false)
  expect(inScope('lisbon', allGroups)).toBe(true)

  const two = {nonGroup: false, groups: ['goa', 'lisbon']}
  expect(inScope('goa', two)).toBe(true)
  expect(inScope('flat', two)).toBe(false)
  expect(inScope(null, two)).toBe(false)
})

test('the stored pref round-trips; Everything is stored as its name', () => {
  expect(scopeToPref(EVERYTHING)).toBe('everything')
  expect(scopeFromPref('everything', GROUPS)).toEqual(EVERYTHING)
  expect(scopeFromPref(undefined, GROUPS)).toEqual(EVERYTHING)
  const s = {nonGroup: true, groups: ['goa']}
  expect(scopeFromPref(scopeToPref(s), GROUPS)).toEqual(s)
})

test('a restored scope drops groups that are gone, and falls back to Everything when nothing is left', () => {
  expect(
    scopeFromPref({nonGroup: false, groups: ['goa', 'deleted']}, GROUPS),
  ).toEqual({nonGroup: false, groups: ['goa']})
  expect(scopeFromPref({nonGroup: false, groups: ['deleted']}, GROUPS)).toEqual(
    EVERYTHING,
  )
  expect(scopeFromPref({nonGroup: true, groups: ['deleted']}, GROUPS)).toEqual({
    nonGroup: true,
    groups: [],
  })
})

test('ticking everything is Everything, so groups made later are counted too', () => {
  expect(scopeFromTicks(true, ['flat', 'goa', 'lisbon'], GROUPS)).toEqual(
    EVERYTHING,
  )
  /* Every group without non-group stays the list ticked: a lone group is named, not "All groups". */
  expect(scopeFromTicks(false, ['flat', 'goa', 'lisbon'], GROUPS)).toEqual({
    nonGroup: false,
    groups: GROUPS,
  })
  expect(scopeFromTicks(false, ['goa'], ['goa'])).toEqual({
    nonGroup: false,
    groups: ['goa'],
  })
  /* Kept in the sheet's order, whatever order they were ticked in. */
  expect(scopeFromTicks(false, ['lisbon', 'goa'], GROUPS)).toEqual({
    nonGroup: false,
    groups: ['goa', 'lisbon'],
  })
  /* No groups yet: non-group ticked is everything there is, and later groups count. */
  expect(scopeFromTicks(true, [], [])).toEqual(EVERYTHING)
  expect(scopeFromTicks(false, [], GROUPS)).toBeNull()
})

test('ticks expand "all" to every group for the sheet', () => {
  expect(ticksOf(EVERYTHING, GROUPS)).toEqual({nonGroup: true, groups: GROUPS})
  expect(ticksOf({nonGroup: false, groups: ['goa']}, GROUPS)).toEqual({
    nonGroup: false,
    groups: ['goa'],
  })
})

test('the chip names what is counted', () => {
  expect(scopeSummary(EVERYTHING, GROUPS)).toEqual({kind: 'everything'})
  expect(scopeSummary({nonGroup: true, groups: []}, GROUPS)).toEqual({
    kind: 'nonGroup',
  })
  expect(scopeSummary({nonGroup: false, groups: 'all'}, GROUPS)).toEqual({
    kind: 'allGroups',
  })
  expect(scopeSummary({nonGroup: false, groups: ['lisbon']}, GROUPS)).toEqual({
    kind: 'group',
    groupId: 'lisbon',
    more: 0,
  })
  /* The first group in the sheet's order leads: "Goa trip + 1". */
  expect(
    scopeSummary({nonGroup: false, groups: ['lisbon', 'goa']}, GROUPS),
  ).toEqual({kind: 'group', groupId: 'goa', more: 1})
  expect(
    scopeSummary({nonGroup: false, groups: ['flat', 'lisbon', 'goa']}, [
      ...GROUPS,
      'x',
    ]),
  ).toEqual({kind: 'group', groupId: 'goa', more: 2})
  /* Four or more: a count, so the chip stays short. */
  expect(
    scopeSummary({nonGroup: false, groups: ['a', 'b', 'c', 'd']}, [
      'a',
      'b',
      'c',
      'd',
      'e',
    ]),
  ).toEqual({kind: 'groups', count: 4})
  expect(scopeSummary({nonGroup: true, groups: ['flat']}, GROUPS)).toEqual({
    kind: 'nonGroupPlus',
    groupId: 'flat',
    count: 1,
  })
  expect(
    scopeSummary({nonGroup: true, groups: ['flat', 'goa']}, GROUPS),
  ).toEqual({kind: 'nonGroupPlus', groupId: 'goa', count: 2})
})

test('scope round-trips and everything prints nothing', () => {
  expect(scopeToParam({nonGroup: true, groups: 'all'})).toBeUndefined()
  expect(scopeToParam({nonGroup: false, groups: ['g1', 'g2']})).toBe('0:g1,g2')
  expect(scopeFromParam('0:g1,g2')).toEqual({nonGroup: false, groups: ['g1', 'g2']})
  expect(scopeFromParam('1:all')).toEqual({nonGroup: true, groups: 'all'})
  expect(scopeFromParam('0:')).toEqual({nonGroup: true, groups: 'all'})
  expect(scopeFromParam('junk')).toBeUndefined()
})
