import {expect, test} from 'bun:test'

import {scopeToExportGroup} from './exportScope'

test('Analytics scope becomes the Export sheet group filter', () => {
  expect(scopeToExportGroup({nonGroup: true, groups: 'all'})).toEqual({})
  expect(scopeToExportGroup({nonGroup: false, groups: ['goa']})).toEqual({groupId: 'goa'})
  const two = {nonGroup: false, groups: ['goa', 'flat']}
  expect(scopeToExportGroup(two)).toEqual({scope: two})
  const nonGroup = {nonGroup: true, groups: []}
  expect(scopeToExportGroup(nonGroup)).toEqual({scope: nonGroup})
  const nonGroupAndOne = {nonGroup: true, groups: ['goa']}
  expect(scopeToExportGroup(nonGroupAndOne)).toEqual({scope: nonGroupAndOne})
  const allGroups = {nonGroup: false, groups: 'all' as const}
  expect(scopeToExportGroup(allGroups)).toEqual({scope: allGroups})
})
