import {describe, expect, test} from 'bun:test'

import {isPushedTabRoute, tabLink} from './helpers'

const params = {currency: 'GBP'}
const TABS = ['People', 'Groups', 'Analytics', 'Activity', 'Settings']

describe('tabLink: a main screen opened from a link is a pushed copy with Back (owners 179, 184)', () => {
  test('native pushes the Pushed<Tab> twin of the screen with its params', () => {
    for (const tab of TABS) expect(tabLink(tab, params, false)).toEqual({kind: 'push', name: `Pushed${tab}`, params})
  })

  test('web pushes the tab route itself with from=<the tab it was opened from>, which stays in the address', () => {
    for (const tab of TABS) expect(tabLink(tab, params, true)).toEqual({kind: 'push', name: tab, params: {...params, from: 'people'}})
    expect(tabLink('Activity', undefined, true, 'people')).toEqual({kind: 'push', name: 'Activity', params: {from: 'people'}})
    // Anything that is not a tab name falls back to the start tab.
    expect(tabLink('Activity', undefined, true, 'profile')).toEqual({kind: 'push', name: 'Activity', params: {from: 'people'}})
  })

  test('every other route is pushed on the stack as it is', () => {
    for (const route of ['Person', 'Group', 'SettingsSection', 'Expense', 'Profile'])
      for (const isWeb of [true, false]) expect(tabLink(route, undefined, isWeb)).toBeNull()
  })

  test('a pushed copy is recognised by its native name or its from, a plain tab never', () => {
    expect(isPushedTabRoute({name: 'PushedGroups'})).toBe(true)
    expect(isPushedTabRoute({name: 'Groups', params: {from: 'people'}})).toBe(true)
    expect(isPushedTabRoute({name: 'Groups'})).toBe(false)
    expect(isPushedTabRoute({name: 'Groups', params: {sort: 'name'}})).toBe(false)
    // Analytics' custom range is a from too, but a date, not a tab.
    expect(isPushedTabRoute({name: 'Analytics', params: {period: 'custom', from: '2026-01-01', to: '2026-02-01'}})).toBe(false)
    // A page that is not a main screen never is.
    expect(isPushedTabRoute({name: 'Person', params: {from: 'people'}})).toBe(false)
  })
})
