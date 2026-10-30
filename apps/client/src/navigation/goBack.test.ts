import {expect, test} from 'bun:test'

import {ROUTE_PATHS} from '#/routes'
import {backChain, backFallback, goBack, ROUTES_WITH_PARENT} from './goBack'

test('each page falls back to its fixed parent when there is no history (owner 184)', () => {
  expect(backFallback({name: 'Person', params: {personId: 'p'}})).toEqual({name: 'People'})
  expect(backFallback({name: 'Group', params: {groupId: 'g'}})).toEqual({name: 'Groups'})
  expect(backFallback({name: 'Settle', params: {groupId: 'g'}})).toEqual({name: 'Group', params: {groupId: 'g'}})
  expect(backFallback({name: 'EditExpense', params: {expenseId: 'e'}})).toEqual({name: 'Expense', params: {expenseId: 'e'}})
  expect(backFallback({name: 'SettingsSection', params: {section: 'regional'}})).toEqual({name: 'Settings'})
  expect(backFallback({name: 'Profile'})).toEqual({name: 'Settings'})
  expect(backFallback({name: 'FriendsAndInvites'})).toEqual({name: 'People'})
  expect(backFallback({name: 'AddFriend'})).toEqual({name: 'People'})
  expect(backFallback({name: 'CreateGroup'})).toEqual({name: 'Groups'})
  // The default is Home, never People.
  for (const name of ['Expense', 'Repayment', 'AddExpense', 'Settings', 'People', 'Groups', 'Analytics', 'Activity', 'Somewhere'] as const)
    expect(backFallback({name})).toEqual({name: 'Home'})
})

test('a main screen opened from a link goes back to the tab its from names (owner 179, 184)', () => {
  expect(backFallback({name: 'Activity', params: {from: 'people'}})).toEqual({name: 'People'})
  expect(backFallback({name: 'Groups', params: {from: 'home'}})).toEqual({name: 'Home'})
  // Analytics' custom range uses from for a date: not a tab, so Home.
  expect(backFallback({name: 'Analytics', params: {from: '2026-01-01', to: '2026-02-01'}})).toEqual({name: 'Home'})
  expect(backChain({name: 'Activity', params: {from: 'people'}}).map(r => r.name)).toEqual(['Home', 'People', 'Activity'])
})

test('every route of the route table has a parent, so none falls through to the default by accident', () => {
  const missing = Object.keys(ROUTE_PATHS).filter(name => name !== 'Search' && !ROUTES_WITH_PARENT.includes(name))
  expect(missing).toEqual([])
  for (const name of ['PushedHome', 'PushedPeople', 'PushedGroups', 'PushedAnalytics', 'PushedActivity', 'Tabs']) expect(ROUTES_WITH_PARENT).toContain(name)
  // Every parent is itself a route with a parent or Home, so a chain always ends.
  for (const name of ROUTES_WITH_PARENT) expect(backChain({name}).at(0)!.name).toBe('Home')
})

test('a deep link gets its parents under it so Back keeps climbing (audit M16, owner 184)', () => {
  const names = (route: {name: string; params?: object}) => backChain(route).map(r => r.name)
  expect(names({name: 'Settle', params: {groupId: 'g1'}})).toEqual(['Home', 'Groups', 'Group', 'Settle'])
  expect(names({name: 'Group', params: {groupId: 'g1'}})).toEqual(['Home', 'Groups', 'Group'])
  expect(names({name: 'EditExpense', params: {expenseId: 'e1'}})).toEqual(['Home', 'Expense', 'EditExpense'])
  expect(names({name: 'SettingsSection', params: {section: 'regional'}})).toEqual(['Home', 'Settings', 'SettingsSection'])
  expect(names({name: 'Profile'})).toEqual(['Home', 'Settings', 'Profile'])
  expect(names({name: 'FriendsAndInvites'})).toEqual(['Home', 'People', 'FriendsAndInvites'])
  expect(names({name: 'AddExpense'})).toEqual(['Home', 'AddExpense'])
  expect(names({name: 'Home'})).toEqual(['Home'])
  // A friend's page sits on the People list, which sits on Home.
  expect(names({name: 'Person', params: {personId: 'p1'}})).toEqual(['Home', 'People', 'Person'])
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
  goBack(nav(true), {name: 'Groups'})
  goBack(nav(false), {name: 'Group', params: {groupId: 'g'}})
  expect(calls).toEqual(['back', ['Group', {groupId: 'g'}]])
})
