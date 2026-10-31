import {expect, test} from 'bun:test'

import {resolveStartTab, setStartTab, startPage} from './startTab'

test('the launch tab: startTab, else the old homeTab key, else People (owner 198: a saved home is People)', () => {
  expect(resolveStartTab(undefined, undefined)).toBe('people')
  expect(resolveStartTab(undefined, 'people')).toBe('people')
  expect(resolveStartTab(undefined, 'groups')).toBe('groups')
  expect(resolveStartTab('people', 'groups')).toBe('people')
  expect(resolveStartTab('nonsense', undefined)).toBe('people')
  expect(resolveStartTab('home', undefined)).toBe('people')
  expect(resolveStartTab('home', 'activity')).toBe('people')
})

test('every "Home" fallback is the start tab route', () => {
  expect(startPage()).toBe('People')
  setStartTab('analytics')
  expect(startPage()).toBe('Analytics')
  setStartTab('people')
})

test('the mirror sets the start tab whenever the preference changes, not only at launch (c-nohome review)', async () => {
  const mirror = await Bun.file(new URL('../../state/preferences/mirror.tsx', import.meta.url)).text()
  expect(mirror).toContain('setStartTab(startTab)')
  const web = await Bun.file(new URL('../../navigation/linking.web.ts', import.meta.url)).text()
  expect(web.indexOf('bootStartTab()')).toBeLessThan(web.indexOf("if (window.location.pathname === '/')"))
})
