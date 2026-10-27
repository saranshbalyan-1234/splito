import {expect, test} from 'bun:test'

import {dateInput, parseWhen, quickPicks, timeInput} from './when'

const local = (y: number, m: number, d: number, h = 9, min = 0) => new Date(y, m - 1, d, h, min).getTime()

test('a real local date and time parse; anything else is null', () => {
  expect(parseWhen('2026-11-03', '18:30')).toBe(local(2026, 11, 3, 18, 30))
  expect(parseWhen(' 2026-11-03 ', '9:05')).toBe(local(2026, 11, 3, 9, 5))
  for (const [d, t] of [['2026-02-30', '09:00'], ['2026-13-01', '09:00'], ['2026-11-03', '24:00'], ['2026-11-03', '09:60'], ['11/03/2026', '09:00'], ['2026-11-03', 'noon'], ['', '']])
    expect(parseWhen(d!, t!)).toBeNull()
})

test('the field strings round-trip', () => {
  const at = local(2026, 3, 7, 7, 5)
  expect(dateInput(at)).toBe('2026-03-07')
  expect(timeInput(at)).toBe('07:05')
  expect(parseWhen(dateInput(at), timeInput(at))).toBe(at)
})

test('quick picks are at 9:00: tomorrow, in 3 days, next Monday, next month', () => {
  // Tuesday 27 October 2026, 14:00.
  const now = local(2026, 10, 27, 14)
  const [tomorrow, in3, week, month] = quickPicks(now)
  expect(tomorrow!.at).toBe(local(2026, 10, 28))
  expect(in3!.at).toBe(local(2026, 10, 30))
  expect(week!.at).toBe(local(2026, 11, 2))
  expect(month!.at).toBe(local(2026, 11, 27))
})

test('next Monday is never today, and next month clamps to a short month', () => {
  // Monday 2 November 2026 asks for the Monday after.
  expect(quickPicks(local(2026, 11, 2, 8))[2]!.at).toBe(local(2026, 11, 9))
  // Sunday 1 November: tomorrow is that Monday.
  expect(quickPicks(local(2026, 11, 1, 8))[2]!.at).toBe(local(2026, 11, 2))
  // 31 January -> 28 February.
  expect(quickPicks(local(2026, 1, 31, 8))[3]!.at).toBe(local(2026, 2, 28))
})
