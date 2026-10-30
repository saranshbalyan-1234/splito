import {expect, test} from 'bun:test'

import {resolveStartTab} from './startTab'

test('the launch tab: startTab, else the old homeTab key (its people meant Home), else Home', () => {
  expect(resolveStartTab(undefined, undefined)).toBe('home')
  expect(resolveStartTab(undefined, 'people')).toBe('home')
  expect(resolveStartTab(undefined, 'groups')).toBe('groups')
  expect(resolveStartTab('people', 'groups')).toBe('people')
  expect(resolveStartTab('nonsense', undefined)).toBe('home')
})
