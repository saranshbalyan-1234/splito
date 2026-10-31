import {expect, test} from 'bun:test'

import {fabParams} from './fab'

test('the FAB shows on the main screens, their pushed copies, a Person and a Group, with what Add expense pre-selects (owner 190)', () => {
  for (const name of ['People', 'Groups', 'Analytics', 'Activity', 'PushedPeople', 'PushedGroups', 'PushedActivity'])
    expect(fabParams({name})).toEqual({})
  // A tab copied by link keeps the FAB, however its address reads.
  expect(fabParams({name: 'Groups', params: {from: 'people', sort: 'name'}})).toEqual({})
  expect(fabParams({name: 'Person', params: {personId: 'p1'}})).toEqual({personId: 'p1'})
  expect(fabParams({name: 'Group', params: {groupId: 'g1'}})).toEqual({groupId: 'g1'})
})

test('it is hidden on Profile (which holds Settings, owner 220), the Settings sections, detail pages, forms and the composer', () => {
  for (const name of ['SettingsSection', 'Profile', 'Expense', 'Repayment', 'EditExpense', 'AddExpense', 'AddFriend', 'CreateGroup', 'Settle', 'FriendsAndInvites', 'SignIn', 'Invite', 'Search', 'Sheet', 'Unknown'])
    expect(fabParams({name})).toBeNull()
})
