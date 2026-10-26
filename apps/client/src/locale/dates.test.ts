/// <reference types="bun" />
import {expect, test} from 'bun:test'

import {
  formatLocalDate,
  resolveTimeZone,
  todayIn,
  utcOffsetLabel,
} from './dates'

test('explicit date formats never shift the calendar date', () => {
  expect(formatLocalDate('2026-03-07', 'dmy', 'en')).toBe('07/03/2026')
  expect(formatLocalDate('2026-03-07', 'mdy', 'en')).toBe('03/07/2026')
  expect(formatLocalDate('2026-03-07', 'ymd', 'en')).toBe('2026-03-07')
})

test('auto follows the locale and keeps the day', () => {
  expect(formatLocalDate('2026-01-01', 'auto', 'en-US')).toBe('Jan 1, 2026')
  expect(formatLocalDate('2026-01-01', 'auto', 'en-GB')).toBe('1 Jan 2026')
})

test('today is computed in the chosen timezone', () => {
  const lateUtc = new Date(Date.UTC(2026, 9, 26, 20, 0))
  expect(todayIn('UTC', lateUtc)).toBe('2026-10-26')
  expect(todayIn('Asia/Kolkata', lateUtc)).toBe('2026-10-27')
  expect(utcOffsetLabel('Asia/Kolkata', lateUtc)).toBe('GMT+5:30')
})

test('a pinned timezone wins over the device', () => {
  expect(resolveTimeZone('Asia/Tokyo')).toBe('Asia/Tokyo')
  expect(resolveTimeZone('device').length).toBeGreaterThan(0)
})
