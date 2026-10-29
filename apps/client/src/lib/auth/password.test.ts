import {expect, test} from 'bun:test'

import {passwordStrength} from './password'

test('under 8 characters is too short whatever it holds', () => {
  expect(passwordStrength('')).toBe(0)
  expect(passwordStrength('Aa1!Aa1')).toBe(0)
})

test('strength grows with length, case, digits and symbols', () => {
  expect(passwordStrength('abcdefgh')).toBe(1)
  expect(passwordStrength('abcdefg1')).toBe(2)
  expect(passwordStrength('Abcdefg1')).toBe(2)
  expect(passwordStrength('Abcdefg1!')).toBe(3)
  expect(passwordStrength('correct horse battery')).toBe(2)
})
