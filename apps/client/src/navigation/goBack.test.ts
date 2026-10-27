import {expect, test} from 'bun:test'

import {backChain, backFallback, goBack} from './goBack'

test('each pushed page falls back to its parent when there is no history', () => {
  expect(backFallback({name: 'Person', params: {personId: 'p'}})).toEqual({name: 'People'})
  expect(backFallback({name: 'Group', params: {groupId: 'g'}})).toEqual({name: 'Groups'})
  expect(backFallback({name: 'Settle', params: {groupId: 'g'}})).toEqual({name: 'Group', params: {groupId: 'g'}})
  expect(backFallback({name: 'EditExpense', params: {expenseId: 'e'}})).toEqual({name: 'Expense', params: {expenseId: 'e'}})
  expect(backFallback({name: 'SettingsSection', params: {section: 'regional'}})).toEqual({name: 'Settings'})
  expect(backFallback({name: 'CreateGroup'})).toEqual({name: 'Groups'})
  for (const name of ['Expense', 'AddExpense', 'AddFriend', 'Profile', 'Settings', 'Somewhere'] as const)
    expect(backFallback({name})).toEqual({name: 'People'})
})

test('a deep link gets its parents under it so Back runs the fallback (audit M16)', () => {
  const names = (route: {name: string; params?: object}) => backChain(route).map(r => r.name)
  expect(names({name: 'Settle', params: {groupId: 'g1'}})).toEqual(['People', 'Groups', 'Group', 'Settle'])
  expect(names({name: 'Group', params: {groupId: 'g1'}})).toEqual(['People', 'Groups', 'Group'])
  expect(names({name: 'EditExpense', params: {expenseId: 'e1'}})).toEqual(['People', 'Expense', 'EditExpense'])
  expect(names({name: 'SettingsSection', params: {section: 'regional'}})).toEqual(['People', 'Settings', 'SettingsSection'])
  expect(names({name: 'AddExpense'})).toEqual(['People', 'AddExpense'])
  expect(names({name: 'People'})).toEqual(['People'])
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
