import {expect, test} from 'bun:test'

import {deletedAge} from './deletedAge'

const NOW = Date.UTC(2026, 9, 28, 12, 0, 0)
const ago = (ms: number) => deletedAge(NOW - ms, NOW)
const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

test('under a minute is just now, and a clock behind the record never reads as the past', () => {
  expect(ago(0)).toEqual({unit: 'now'})
  expect(ago(59_999)).toEqual({unit: 'now'})
  expect(ago(-5 * MIN)).toEqual({unit: 'now'})
})

test('minutes, hours and days round down', () => {
  expect(ago(MIN)).toEqual({unit: 'minute', value: 1})
  expect(ago(59 * MIN + 59_000)).toEqual({unit: 'minute', value: 59})
  expect(ago(HOUR)).toEqual({unit: 'hour', value: 1})
  expect(ago(2 * HOUR + 59 * MIN)).toEqual({unit: 'hour', value: 2})
  expect(ago(DAY)).toEqual({unit: 'day', value: 1})
  expect(ago(29 * DAY + 23 * HOUR)).toEqual({unit: 'day', value: 29})
})

test('months up to a year, then a plain date', () => {
  expect(ago(30 * DAY)).toEqual({unit: 'month', value: 1})
  expect(ago(11 * 30 * DAY + DAY)).toEqual({unit: 'month', value: 11})
  expect(ago(12 * 30 * DAY)).toEqual({unit: 'date'})
})
