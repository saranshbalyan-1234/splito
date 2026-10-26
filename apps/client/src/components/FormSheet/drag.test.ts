import {describe, expect, test} from 'bun:test'

import {shouldDismissSheet} from './drag'

describe('shouldDismissSheet', () => {
  test('past 30% of the height closes', () => {
    expect(shouldDismissSheet({dy: 301, height: 1000, velocity: 0})).toBe(true)
    expect(shouldDismissSheet({dy: 299, height: 1000, velocity: 0})).toBe(false)
  })
  test('a downward flick closes even when short', () =>
    expect(shouldDismissSheet({dy: 40, height: 1000, velocity: 1})).toBe(true))
  test('a tiny twitch never closes, however fast', () =>
    expect(shouldDismissSheet({dy: 4, height: 1000, velocity: 5})).toBe(false))
  test('dragging up or not at all never closes', () => {
    expect(shouldDismissSheet({dy: -200, height: 1000, velocity: -2})).toBe(
      false,
    )
    expect(shouldDismissSheet({dy: 0, height: 0, velocity: 0})).toBe(false)
  })
})
