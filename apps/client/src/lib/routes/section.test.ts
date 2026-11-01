import {expect, test} from 'bun:test'

import {currentSection} from './section'

const stack = (...names: string[]) =>
  ({routes: names.map((name, i) => ({key: String(i), name}))}) as never

test('a pushed page keeps the section it was opened from lit', () => {
  expect(currentSection(stack('People', 'Person', 'Expense'))).toBe('People')
  expect(currentSection(stack('Groups', 'Expense'))).toBe('Groups')
  expect(currentSection(stack('People', 'Groups', 'Profile'))).toBe('Groups')
  /* Profile and the Settings pages are no nav item (owner 220): the tab they were opened from stays lit. */
  expect(currentSection(stack('Groups', 'Profile', 'SettingsSection'))).toBe(
    'Groups',
  )
  expect(currentSection(stack('People', 'Activity'))).toBe('Activity')
  expect(currentSection(undefined)).toBe('People')
})

test('the bottom bar keeps lit the tab a page that is in no bar was opened from', () => {
  const tabs = ['People', 'Groups', 'Analytics', 'Activity']
  expect(
    currentSection(
      stack('People', 'Groups', 'Profile', 'SettingsSection'),
      tabs,
    ),
  ).toBe('Groups')
  expect(currentSection(stack('Profile'), tabs)).toBe('People')
  /* A bar without People lights the tab a friend's page was opened from. */
  expect(currentSection(stack('People', 'Person'), ['Groups', 'Analytics'])).toBe('Groups')
})
