/// <reference types="bun" />
import {afterEach, expect, test} from 'bun:test'

import {joinList} from './joinList'

const intl = Intl as {ListFormat?: unknown}
const original = intl.ListFormat

afterEach(() => {
  intl.ListFormat = original
})

test('joins names with the language’s own "and" where Intl.ListFormat exists', () => {
  expect(joinList(['Bob', 'Cy', 'Dee'], 'en')).toBe('Bob, Cy, and Dee')
  expect(joinList(['Bob'], 'en')).toBe('Bob')
  expect(joinList([], 'en')).toBe('')
})

test('falls back to commas when Intl.ListFormat is missing (Hermes)', () => {
  delete intl.ListFormat
  expect(typeof intl.ListFormat).toBe('undefined')
  expect(joinList(['Bob', 'Cy', 'Dee'], 'en')).toBe('Bob, Cy, Dee')
  expect(joinList(['Bob'], 'hi')).toBe('Bob')
})

test('falls back to commas when the constructor throws', () => {
  intl.ListFormat = function () {
    throw new RangeError('bad locale')
  }
  expect(joinList(['Bob', 'Cy'], 'xx')).toBe('Bob, Cy')
})
