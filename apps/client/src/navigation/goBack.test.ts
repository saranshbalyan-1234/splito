import {expect, test} from 'bun:test'

import {backFallback, goBack} from './goBack'

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
