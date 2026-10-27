import {expect, test} from 'bun:test'

import {daysLeft} from './days'

const DAY = 86_400_000

test('days left counts whole days up to the item\'s own end date, and never shows 0 while listed', () => {
  expect(daysLeft(30 * DAY, 0)).toBe(30)
  expect(daysLeft(30 * DAY, 5 * 3_600_000)).toBe(30)
  expect(daysLeft(30 * DAY, 2 * DAY)).toBe(28)
  expect(daysLeft(7 * DAY, 7 * DAY - 1)).toBe(1)
  expect(daysLeft(7 * DAY, 8 * DAY)).toBe(1)
})

test('an item deleted under 90 days keeps showing its 90 days whatever the setting is now', () => {
  // The caller passes the item's purgeAfter; the setting never enters.
  const deletedAt = 10 * DAY
  expect(daysLeft(deletedAt + 90 * DAY, deletedAt + DAY)).toBe(89)
})
