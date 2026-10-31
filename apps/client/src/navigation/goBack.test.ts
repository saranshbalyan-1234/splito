import {expect, test} from 'bun:test'

import {setStartTab} from '#/lib/routes/startTab'
import {ROUTE_PATHS} from '#/routes'
import {backChain, backFallback, goBack, ROUTES_WITH_PARENT} from './goBack'

test('each page falls back to its fixed parent when there is no history (owner 184)', () => {
  expect(backFallback({name: 'Person', params: {personId: 'p'}})).toEqual({name: 'People'})
  expect(backFallback({name: 'Group', params: {groupId: 'g'}})).toEqual({name: 'Groups'})
  expect(backFallback({name: 'Settle', params: {groupId: 'g'}})).toEqual({name: 'Group', params: {groupId: 'g'}})
  expect(backFallback({name: 'EditExpense', params: {expenseId: 'e'}})).toEqual({name: 'Expense', params: {expenseId: 'e'}})
  expect(backFallback({name: 'SettingsSection', params: {section: 'regional'}})).toEqual({name: 'Settings'})
  expect(backFallback({name: 'Profile'})).toEqual({name: 'People'})
  expect(backFallback({name: 'FriendsAndInvites'})).toEqual({name: 'People'})
  expect(backFallback({name: 'AddFriend'})).toEqual({name: 'People'})
  expect(backFallback({name: 'CreateGroup'})).toEqual({name: 'Groups'})
  // The default is the start tab (owner 198: there is no Home), People unless the person chose another.
  for (const name of ['Expense', 'Repayment', 'AddExpense', 'Settings', 'People', 'Groups', 'Analytics', 'Activity', 'Somewhere'] as const)
    expect(backFallback({name})).toEqual({name: 'People'})
  setStartTab('analytics')
  expect(backFallback({name: 'Expense'})).toEqual({name: 'Analytics'})
  expect(backFallback({name: 'Groups'})).toEqual({name: 'Analytics'})
  // A saved link from before owner 198 says from=home: that is the start tab now.
  expect(backFallback({name: 'Groups', params: {from: 'home'}})).toEqual({name: 'Analytics'})
  setStartTab('people')
})

test('a main screen opened from a link goes back to the tab its from names (owner 179, 184)', () => {
  expect(backFallback({name: 'Activity', params: {from: 'people'}})).toEqual({name: 'People'})
  expect(backFallback({name: 'Groups', params: {from: 'analytics'}})).toEqual({name: 'Analytics'})
  // Analytics' custom range uses from for a date: not a tab, so the start tab.
  expect(backFallback({name: 'Analytics', params: {from: '2026-01-01', to: '2026-02-01'}})).toEqual({name: 'People'})
  expect(backChain({name: 'Activity', params: {from: 'groups'}}).map(r => r.name)).toEqual(['People', 'Groups', 'Activity'])
})

test('every route of the route table has a parent, so none falls through to the default by accident', () => {
  const missing = Object.keys(ROUTE_PATHS).filter(name => name !== 'Search' && !ROUTES_WITH_PARENT.includes(name))
  expect(missing).toEqual([])
  for (const name of ['PushedPeople', 'PushedGroups', 'PushedAnalytics', 'PushedActivity', 'PushedSettings', 'Tabs']) expect(ROUTES_WITH_PARENT).toContain(name)
  // Every chain ends at the start tab, so Back always has somewhere to go.
  for (const name of ROUTES_WITH_PARENT) expect(backChain({name}).at(0)!.name).toBe('People')
})

test('a deep link gets its parents under it so Back keeps climbing (audit M16, owner 184)', () => {
  const names = (route: {name: string; params?: object}) => backChain(route).map(r => r.name)
  expect(names({name: 'Settle', params: {groupId: 'g1'}})).toEqual(['People', 'Groups', 'Group', 'Settle'])
  expect(names({name: 'Group', params: {groupId: 'g1'}})).toEqual(['People', 'Groups', 'Group'])
  expect(names({name: 'EditExpense', params: {expenseId: 'e1'}})).toEqual(['People', 'Expense', 'EditExpense'])
  expect(names({name: 'SettingsSection', params: {section: 'regional'}})).toEqual(['People', 'Settings', 'SettingsSection'])
  expect(names({name: 'Profile'})).toEqual(['People', 'Profile'])
  expect(names({name: 'FriendsAndInvites'})).toEqual(['People', 'FriendsAndInvites'])
  expect(names({name: 'AddExpense'})).toEqual(['People', 'AddExpense'])
  expect(names({name: 'People'})).toEqual(['People'])
  // A friend's page sits on the People list, which is the start tab.
  expect(names({name: 'Person', params: {personId: 'p1'}})).toEqual(['People', 'Person'])
  // With another start tab the People list sits on it.
  setStartTab('groups')
  expect(names({name: 'Person', params: {personId: 'p1'}})).toEqual(['Groups', 'People', 'Person'])
  expect(names({name: 'Group', params: {groupId: 'g1'}})).toEqual(['Groups', 'Group'])
  setStartTab('people')
  // The leaf keeps its own route (params, path); parents take the fallback's.
  const leaf = {name: 'Settle', params: {groupId: 'g1'}}
  expect(backChain(leaf).at(-1)).toBe(leaf)
  expect(backChain(leaf)[2]).toEqual({name: 'Group', params: {groupId: 'g1'}})
})

test('goBack pops when it can, otherwise navigates to the fallback', () => {
  const calls: unknown[] = []
  const nav = (canGoBack: boolean) => ({
    canGoBack: () => canGoBack,
    goBack: () => calls.push('back'),
    navigate: (...args: unknown[]) => calls.push(args),
  })
  goBack(nav(true), {name: 'Groups'}, true)
  goBack(nav(false), {name: 'Group', params: {groupId: 'g'}}, true)
  expect(calls).toEqual(['back', ['Group', {groupId: 'g'}]])
  // Native: a tab fallback goes through Tabs (Settings moved into the tabs; c-nohome review).
  calls.length = 0
  goBack(nav(false), {name: 'Settings'}, false)
  goBack(nav(false), {name: 'Group', params: {groupId: 'g'}}, false)
  expect(calls).toEqual([['Tabs', {screen: 'Settings', params: undefined}], ['Group', {groupId: 'g'}]])
})

test('Profile goes back to the start tab; Support and Your data sit under Settings, the help pages under Support (owners 204-206)', () => {
  expect(backFallback({name: 'Profile'})).toEqual({name: 'People'})
  expect(backFallback({name: 'SettingsSection', params: {section: 'support'}})).toEqual({name: 'Settings'})
  expect(backFallback({name: 'SettingsSection', params: {section: 'data'}})).toEqual({name: 'Settings'})
  for (const section of ['feedback', 'help', 'about'])
    expect(backFallback({name: 'SettingsSection', params: {section}})).toEqual({name: 'SettingsSection', params: {section: 'support'}})
  // A refreshed help page keeps climbing: Support, then Settings, then the start tab.
  expect(backChain({name: 'SettingsSection', params: {section: 'about'}}).map(r => r.name)).toEqual(['People', 'Settings', 'SettingsSection', 'SettingsSection'])
  expect(backChain({name: 'SettingsSection', params: {section: 'data'}}).map(r => r.name)).toEqual(['People', 'Settings', 'SettingsSection'])
  // Settings is a tab: from a link it goes back to the tab it names.
  expect(backFallback({name: 'Settings', params: {from: 'groups'}})).toEqual({name: 'Groups'})
})
