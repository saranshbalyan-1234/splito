import {describe, expect, test} from 'bun:test'

import {isPushedTabRoute, tabLink} from './helpers'

const params = {currency: 'GBP'}
const TABS = ['Home', 'People', 'Groups', 'Analytics', 'Activity']

describe('tabLink: a main screen opened from a link is a pushed copy with Back (owner 179)', () => {
  test('native pushes the Pushed<Tab> twin of the screen with its params', () => {
    for (const tab of TABS) expect(tabLink(tab, params, false)).toEqual({kind: 'push', name: `Pushed${tab}`, params})
  })

  test('web pushes the tab route itself, marked as pushed (the marker stays out of the address)', () => {
    for (const tab of TABS) expect(tabLink(tab, params, true)).toEqual({kind: 'push', name: tab, params: {...params, pushed: '1'}})
  })

  test('every other route is pushed on the stack as it is', () => {
    for (const route of ['Person', 'Group', 'Settings', 'Expense', 'Profile'])
      for (const isWeb of [true, false]) expect(tabLink(route, undefined, isWeb)).toBeNull()
  })

  test('a pushed copy is recognised by its native name or its web marker, a plain tab never', () => {
    expect(isPushedTabRoute({name: 'PushedGroups'})).toBe(true)
    expect(isPushedTabRoute({name: 'Groups', params: {pushed: '1'}})).toBe(true)
    expect(isPushedTabRoute({name: 'Groups'})).toBe(false)
    expect(isPushedTabRoute({name: 'Groups', params: {sort: 'name'}})).toBe(false)
  })
})
