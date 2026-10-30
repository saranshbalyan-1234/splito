import {expect, test} from 'bun:test'

import {setStartTab} from '#/lib/routes/startTab'
import {realParentsFor} from './goBack'

test('an expense or payment sits on its group, else the one friend it is with, else the start tab (owner 184, 198)', () => {
  expect(realParentsFor({groupId: 'g1', others: ['p1', 'p2']})).toEqual([{name: 'People'}, {name: 'Groups'}, {name: 'Group', params: {groupId: 'g1'}}])
  // People is the start tab, so it is not listed twice.
  expect(realParentsFor({groupId: null, others: ['p1']})).toEqual([{name: 'People'}, {name: 'Person', params: {personId: 'p1'}}])
  expect(realParentsFor({groupId: null, others: ['p1', 'p2']})).toEqual([{name: 'People'}])
  expect(realParentsFor({groupId: null, others: []})).toEqual([{name: 'People'}])
  setStartTab('groups')
  expect(realParentsFor({groupId: 'g1', others: []})).toEqual([{name: 'Groups'}, {name: 'Group', params: {groupId: 'g1'}}])
  expect(realParentsFor({groupId: null, others: ['p1']})).toEqual([{name: 'Groups'}, {name: 'People'}, {name: 'Person', params: {personId: 'p1'}}])
  setStartTab('people')
})
