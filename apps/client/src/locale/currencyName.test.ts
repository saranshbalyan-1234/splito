/// <reference types="bun" />
import {afterEach, expect, test} from 'bun:test'

import {currencyName} from './currencyName'

const intl = Intl as {DisplayNames?: unknown}
const original = intl.DisplayNames

afterEach(() => {
  intl.DisplayNames = original
})

test('names a currency in the language', () => {
  expect(currencyName('EUR', 'en')).toBe('Euro')
})

test('never throws on an unknown or malformed code', () => {
  expect(currencyName('ZZZ', 'en')).toBeString()
  expect(currencyName('not a code', 'en')).toBe('not a code')
  expect(currencyName('', 'en')).toBe('')
})

test('falls back to the catalog name, then the code, when DisplayNames is missing', () => {
  delete intl.DisplayNames
  expect(currencyName('EUR', 'fallback-no-displaynames')).toBe('Euro')
  expect(currencyName('ZZZ', 'fallback-no-displaynames')).toBe('ZZZ')
})
