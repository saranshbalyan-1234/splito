import {expect, test} from 'bun:test'

import {daysLeft} from './days'

const DAY = 86_400_000

test('days left counts whole days up, and never shows 0 while listed', () => {
  expect(daysLeft(0, 30, 0)).toBe(30)
  expect(daysLeft(0, 30, 5 * 3_600_000)).toBe(30)
  expect(daysLeft(0, 30, 2 * DAY)).toBe(28)
  expect(daysLeft(0, 7, 7 * DAY - 1)).toBe(1)
  expect(daysLeft(0, 7, 8 * DAY)).toBe(1)
})
