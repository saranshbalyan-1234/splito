import {expect, test} from 'bun:test'

import {currentSection} from './section'

const stack = (...names: string[]) =>
  ({routes: names.map((name, i) => ({key: String(i), name}))}) as never

test('a pushed page keeps the section it was opened from lit', () => {
  expect(currentSection(stack('Home', 'People', 'Person', 'Expense'))).toBe('People')
  expect(currentSection(stack('Home', 'Expense'))).toBe('Home')
  expect(currentSection(stack('Home', 'Groups', 'Profile'))).toBe('Groups')
  expect(currentSection(stack('Home', 'Settings', 'SettingsSection'))).toBe(
    'Settings',
  )
  expect(currentSection(stack('Home', 'Activity'))).toBe('Activity')
  expect(currentSection(undefined)).toBe('Home')
})

test('the bottom bar, which has no Settings, keeps lit the tab Settings was opened from', () => {
  const tabs = ['Home', 'People', 'Groups', 'Analytics', 'Activity']
  expect(
    currentSection(
      stack('Home', 'Groups', 'Settings', 'SettingsSection'),
      tabs,
    ),
  ).toBe('Groups')
  expect(currentSection(stack('Settings'), tabs)).toBe('Home')
  /* A bar without People lights the tab a friend's page was opened from. */
  expect(currentSection(stack('Home', 'Person'), ['Home', 'Groups'])).toBe('Home')
})
