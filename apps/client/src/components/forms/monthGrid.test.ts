/// <reference types="bun" />
import {expect, test} from 'bun:test'

import {monthGrid, shiftMonth} from './monthGrid'

test('a month is whole weeks, padded with null, starting on the chosen weekday', () => {
  // 1 Oct 2026 is a Thursday.
  const mon = monthGrid('2026-10', 1)
  expect(mon.length % 7).toBe(0)
  expect(mon.slice(0, 4)).toEqual([null, null, null, '2026-10-01'])
  expect(mon.filter(Boolean).length).toBe(31)
  expect(monthGrid('2026-10', 0).slice(0, 5)).toEqual([null, null, null, null, '2026-10-01'])
  expect(monthGrid('2026-10', 6).slice(0, 6)).toEqual([null, null, null, null, null, '2026-10-01'])
})

test('a month that starts on the first weekday has no lead padding; February knows leap years', () => {
  // 1 Feb 2027 is a Monday.
  expect(monthGrid('2027-02', 1)[0]).toBe('2027-02-01')
  expect(monthGrid('2027-02', 1).length).toBe(28)
  expect(monthGrid('2028-02', 1).filter(Boolean).length).toBe(29)
})

test('months shift across a year end', () => {
  expect(shiftMonth('2026-12', 1)).toBe('2027-01')
  expect(shiftMonth('2026-01', -1)).toBe('2025-12')
  expect(shiftMonth('2026-10', -22)).toBe('2024-12')
})
