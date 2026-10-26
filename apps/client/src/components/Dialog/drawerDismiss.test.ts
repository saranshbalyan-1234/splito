import {describe, expect, test} from 'bun:test'

import {shouldDismissDrawer} from './drawerDismiss'

describe('shouldDismissDrawer (owner rule 26.8: past ~30% or a flick down)', () => {
  test('a slow release past 30% of the height closes; short of it springs back', () => {
    expect(shouldDismissDrawer({dy: 301, height: 1000, velocity: 0})).toBe(true)
    expect(shouldDismissDrawer({dy: 299, height: 1000, velocity: 0})).toBe(false)
  })
  test('a fast flick is decided by its direction, however short', () => {
    expect(shouldDismissDrawer({dy: 40, height: 1000, velocity: 900})).toBe(true)
    expect(shouldDismissDrawer({dy: 400, height: 1000, velocity: -900})).toBe(false)
  })
  test('a pull upwards never closes', () =>
    expect(shouldDismissDrawer({dy: -50, height: 1000, velocity: 0})).toBe(false))
})
