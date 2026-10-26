import {expect, test} from 'bun:test'

import {currentSection} from './section'

const stack = (...names: string[]) =>
  ({routes: names.map((name, i) => ({key: String(i), name}))}) as never

test('a pushed page keeps the section it was opened from lit', () => {
  expect(currentSection(stack('People', 'Person', 'Expense'))).toBe('People')
  expect(currentSection(stack('People', 'Groups', 'Profile'))).toBe('Groups')
  expect(currentSection(stack('People', 'Settings', 'SettingsSection'))).toBe(
    'Settings',
  )
  expect(currentSection(stack('People', 'Activity'))).toBe('Activity')
  expect(currentSection(undefined)).toBe('People')
})

test('the bottom bar, which has no Settings, keeps lit the tab Settings was opened from', () => {
  const tabs = ['People', 'Groups', 'Analytics', 'Activity']
  expect(
    currentSection(stack('People', 'Groups', 'Settings', 'SettingsSection'), tabs),
  ).toBe('Groups')
  expect(currentSection(stack('Settings'), tabs)).toBe('People')
})
