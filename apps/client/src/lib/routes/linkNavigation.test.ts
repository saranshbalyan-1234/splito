import {describe, expect, test} from 'bun:test'

import {getTabState, isPushedCopy, isStateAtTabRoot, tabLink, TabState} from './helpers'

const params = {currency: 'GBP'}

describe('tabLink: a link to a tab pressed on a pushed screen (Profile tile, Overview card)', () => {
  test('native pops back to the root `Tabs` screen and selects the tab with its params', () => {
    for (const tab of ['People', 'Groups', 'Analytics'])
      expect(tabLink(tab, params, false)).toEqual({kind: 'popTo', name: 'Tabs', params: {screen: tab, params}})
  })

  test('web navigates to the tab route with its params', () => {
    for (const tab of ['People', 'Groups', 'Analytics'])
      expect(tabLink(tab, params, true)).toEqual({kind: 'navigate', name: tab, params})
  })

  test('every other route is pushed on the stack', () => {
    for (const route of ['Person', 'Group', 'Settings', 'Expense', 'Profile'])
      for (const isWeb of [true, false]) expect(tabLink(route, undefined, isWeb)).toBeNull()
  })
})

describe('a main screen opened from a link is a pushed copy with Back (owner 179)', () => {
  const link = {type: 'transactions', group: 'g1'}

  test('Activity is pushed with back=1: its own route on web, the root `ActivityPage` route on a phone', () => {
    expect(tabLink('Activity', link, true)).toEqual({kind: 'push', name: 'Activity', params: {...link, back: '1'}})
    expect(tabLink('Activity', link, false)).toEqual({kind: 'push', name: 'ActivityPage', params: {...link, back: '1'}})
    expect(tabLink('Activity', undefined, true)?.params).toEqual({back: '1'})
  })

  test('the flag marks the copy: not the tab root, not the tab\'s own press target', () => {
    const state = (params?: object) => ({index: 0, routes: [{name: 'Activity', params}]}) as never
    expect(isPushedCopy({back: '1'})).toBe(true)
    expect(isPushedCopy({tab: 'me'})).toBe(false)
    expect(isPushedCopy(undefined)).toBe(false)
    expect(isStateAtTabRoot(state())).toBe(true)
    expect(isStateAtTabRoot(state({back: '1'}))).toBe(false)
    expect(getTabState(state(), 'Activity')).toBe(TabState.InsideAtRoot)
    expect(getTabState(state({back: '1'}), 'Activity')).toBe(TabState.Inside)
  })
})
