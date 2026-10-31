/// <reference types="bun" />
import {expect, test} from 'bun:test'

import {dayBucket, dayOfInstant} from './dayLabel'

test('an instant lands on its day in the Timezone preference, not the device zone', () => {
  // 23:30 UTC on the 26th is already the 27th in Kolkata, still the 26th in Los Angeles.
  const at = Date.UTC(2026, 9, 26, 23, 30)
  expect(dayOfInstant(at, 'Asia/Kolkata')).toBe('2026-10-27')
  expect(dayOfInstant(at, 'UTC')).toBe('2026-10-26')
  expect(dayOfInstant(at, 'America/Los_Angeles')).toBe('2026-10-26')
  // 08:00 UTC on the 27th: the 26th in Los Angeles (the m23 case).
  expect(dayOfInstant(Date.UTC(2026, 9, 27, 8), 'America/Los_Angeles')).toBe(
    '2026-10-27',
  )
  expect(dayOfInstant(Date.UTC(2026, 9, 27, 6), 'America/Los_Angeles')).toBe(
    '2026-10-26',
  )
})

test('the day rolls over at local midnight across a year end and a leap day', () => {
  expect(dayOfInstant(Date.UTC(2026, 11, 31, 18, 30), 'Asia/Kolkata')).toBe(
    '2027-01-01',
  )
  expect(dayOfInstant(Date.UTC(2028, 1, 28, 23, 0), 'Pacific/Auckland')).toBe(
    '2028-02-29',
  )
})

test('buckets: today, yesterday, weekday within the week, then the date', () => {
  const today = '2026-10-27'
  expect(dayBucket('2026-10-27', today)).toBe('today')
  expect(dayBucket('2026-10-26', today)).toBe('yesterday')
  expect(dayBucket('2026-10-25', today)).toBe('weekday')
  expect(dayBucket('2026-10-21', today)).toBe('weekday')
  expect(dayBucket('2026-10-20', today)).toBe('date')
  expect(dayBucket('2025-10-27', today)).toBe('date')
  // Still ahead of today: named by its weekday, never a negative count.
  expect(dayBucket('2026-10-28', today)).toBe('weekday')
})

test('a daylight-saving day of 25 hours still counts as one calendar day', () => {
  // 2026-11-01 is 25 hours long in Los Angeles: 06:30 UTC on the 2nd is 22:30 on the 1st.
  const today = dayOfInstant(Date.UTC(2026, 10, 2, 8, 30), 'America/Los_Angeles')
  const lateYesterday = dayOfInstant(
    Date.UTC(2026, 10, 2, 6, 30),
    'America/Los_Angeles',
  )
  expect(today).toBe('2026-11-02')
  expect(lateYesterday).toBe('2026-11-01')
  expect(dayBucket(lateYesterday, today)).toBe('yesterday')
  // And a 23-hour day (2026-03-08): the 7th is yesterday on the 9th... two days back is a weekday.
  expect(dayBucket('2026-03-08', '2026-03-09')).toBe('yesterday')
  expect(dayBucket('2026-03-07', '2026-03-09')).toBe('weekday')
})

test('the same instant is worded for the zone chosen: Comments and Activity agree', () => {
  // 03:00 UTC on the 27th: 08:30 on the 27th in Kolkata, 20:00 on the 26th in Los Angeles.
  const at = Date.UTC(2026, 9, 27, 3)
  const todayKolkata = dayOfInstant(at + 60_000, 'Asia/Kolkata')
  const todayLosAngeles = dayOfInstant(at + 60_000, 'America/Los_Angeles')
  expect(todayKolkata).toBe('2026-10-27')
  expect(todayLosAngeles).toBe('2026-10-26')
  expect(dayBucket(dayOfInstant(at, 'Asia/Kolkata'), todayKolkata)).toBe('today')
  expect(dayBucket(dayOfInstant(at, 'America/Los_Angeles'), todayLosAngeles)).toBe(
    'today',
  )
  // Mixing zones is the bug this rule removes: Los Angeles' day seen from Kolkata's clock is a day behind.
  expect(dayBucket(dayOfInstant(at, 'America/Los_Angeles'), todayKolkata)).toBe(
    'yesterday',
  )
})
