import {expect, test} from 'bun:test'

import {HOLD, intent, MAX_PULL, pullDistance, THRESHOLD} from './pullMath'

test('the content follows the finger with resistance and stops at the maximum', () => {
  expect(pullDistance(-20)).toBe(0)
  expect(pullDistance(100)).toBe(60)
  expect(pullDistance(10_000)).toBe(MAX_PULL)
  expect(HOLD).toBeLessThan(THRESHOLD)
})

test('only a mostly-downward move starts a pull', () => {
  expect(intent(1, 2)).toBe('pending')
  expect(intent(0, 12)).toBe('pull')
  expect(intent(0, -12)).toBe('ignore')
  expect(intent(20, 12)).toBe('ignore')
})
