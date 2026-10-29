import {describe, expect, test} from 'bun:test'

import {linkNavigation} from './helpers'

describe('linkNavigation', () => {
  test('a tab (an Overview card opening Analytics in a currency) is navigated to, never pushed', () => {
    for (const tab of ['People', 'Groups', 'Analytics', 'Activity']) expect(linkNavigation(tab)).toBe('navigate')
  })

  test('every other route is pushed on the stack', () => {
    for (const route of ['Person', 'Group', 'Settings', 'Expense', 'Profile']) expect(linkNavigation(route)).toBe('push')
  })
})
