import {expect, test} from 'bun:test'

import {parseLocalDate} from '../src/date'

test('valid leap day', () => expect(parseLocalDate('2028-02-29')).toBe('2028-02-29'))
test('dates outside October 2026', () => {
  expect(parseLocalDate('2031-01-15')).toBe('2031-01-15')
  expect(parseLocalDate('1900-01-01')).toBe('1900-01-01')
  expect(parseLocalDate('2200-12-31')).toBe('2200-12-31')
})
test('invalid dates rejected', () => {
  for (const bad of ['2026-02-30', '2027-02-29', '2100-02-29', '1899-12-31', '2201-01-01', '2026-1-5', 'x', '2026-13-01'])
    expect(() => parseLocalDate(bad)).toThrow('INVALID_DATE')
})
