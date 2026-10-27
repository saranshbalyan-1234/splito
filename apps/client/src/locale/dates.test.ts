/// <reference types="bun" />
import {expect, test} from 'bun:test'

import {
  allTimeZones,
  daysBetween,
  formatDay,
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

/* F-115 m24: day offsets are calendar arithmetic, not 24 h shifts (DST). */
test('yesterday and tomorrow are calendar days around a DST change', () => {
  // London springs forward on 2026-03-29; 23:30Z is already 00:30 on the 30th.
  const now = new Date('2026-03-29T23:30:00Z')
  expect(todayIn('Europe/London', now)).toBe('2026-03-30')
  expect(todayIn('Europe/London', now, -1)).toBe('2026-03-29')
  expect(todayIn('Europe/London', now, 1)).toBe('2026-03-31')
  expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2)
})

/* F-115 m28: Hermes has no Intl.supportedValuesOf; the picker needs every zone. */
test('the timezone list is complete without Intl.supportedValuesOf', () => {
  const zones = allTimeZones()
  expect(zones.length).toBeGreaterThan(300)
  for (const z of ['Asia/Kolkata', 'America/Los_Angeles', 'Europe/London', 'Pacific/Auckland', 'UTC'])
    expect(zones).toContain(z)
  // Every entry is a zone the runtime accepts.
  for (const z of zones) expect(() => new Intl.DateTimeFormat('en', {timeZone: z})).not.toThrow()
})

/* F-115 M18: one formatter for every calendar date, driven by the Date format preference. */
test('formatDay follows the Date format preference, with optional weekday', () => {
  expect(formatDay('2026-10-26', 'ymd', 'en')).toBe('2026-10-26')
  expect(formatDay('2026-10-26', 'dmy', 'en', {weekday: 'long'})).toBe('Monday, 26/10/2026')
  expect(formatDay('2026-10-26', 'auto', 'en-US', {day: 'numeric', month: 'short', year: 'numeric'})).toBe('Oct 26, 2026')
  expect(formatDay('2026-10-26', 'auto', 'en-US')).toBe('Oct 26, 2026')
})
