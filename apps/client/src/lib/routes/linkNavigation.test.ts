import {describe, expect, test} from 'bun:test'

import {tabLink} from './helpers'

const params = {currency: 'GBP'}

describe('tabLink: a link to a tab pressed on a pushed screen (Profile tile, Overview card)', () => {
  test('native pops back to the root `Tabs` screen and selects the tab with its params', () => {
    for (const tab of ['People', 'Groups', 'Analytics', 'Activity'])
      expect(tabLink(tab, params, false)).toEqual({kind: 'popTo', name: 'Tabs', params: {screen: tab, params}})
  })

  test('web navigates to the tab route with its params', () => {
    for (const tab of ['People', 'Groups', 'Analytics', 'Activity'])
      expect(tabLink(tab, params, true)).toEqual({kind: 'navigate', name: tab, params})
  })

  test('every other route is pushed on the stack', () => {
    for (const route of ['Person', 'Group', 'Settings', 'Expense', 'Profile'])
      for (const isWeb of [true, false]) expect(tabLink(route, undefined, isWeb)).toBeNull()
  })
})
