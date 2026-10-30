import {expect, test} from 'bun:test'

import {realParentsFor} from './goBack'

test('an expense or payment sits on its group, else the one friend it is with, else Home (owner 184)', () => {
  expect(realParentsFor({groupId: 'g1', others: ['p1', 'p2']})).toEqual([{name: 'Home'}, {name: 'Groups'}, {name: 'Group', params: {groupId: 'g1'}}])
  expect(realParentsFor({groupId: null, others: ['p1']})).toEqual([{name: 'Home'}, {name: 'People'}, {name: 'Person', params: {personId: 'p1'}}])
  expect(realParentsFor({groupId: null, others: ['p1', 'p2']})).toEqual([{name: 'Home'}])
  expect(realParentsFor({groupId: null, others: []})).toEqual([{name: 'Home'}])
})
