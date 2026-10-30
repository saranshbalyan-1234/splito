import {expect, test} from 'bun:test'

import {resolveStartTab, setStartTab, startPage} from './startTab'

test('the launch tab: startTab, else the old homeTab key, else People (owner 198: a saved home is People)', () => {
  expect(resolveStartTab(undefined, undefined)).toBe('people')
  expect(resolveStartTab(undefined, 'people')).toBe('people')
  expect(resolveStartTab(undefined, 'groups')).toBe('groups')
  expect(resolveStartTab('people', 'groups')).toBe('people')
  expect(resolveStartTab('nonsense', undefined)).toBe('people')
  expect(resolveStartTab('home', undefined)).toBe('people')
  expect(resolveStartTab('home', 'activity')).toBe('activity')
})

test('every "Home" fallback is the start tab route', () => {
  expect(startPage()).toBe('People')
  setStartTab('analytics')
  expect(startPage()).toBe('Analytics')
  setStartTab('people')
})
