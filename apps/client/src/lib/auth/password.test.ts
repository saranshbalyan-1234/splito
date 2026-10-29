import {expect, test} from 'bun:test'

import {isPasswordLongEnough, passwordStrength} from './password'

test('under 8 characters is too short whatever it holds, and padding does not count', () => {
  expect(passwordStrength('')).toBe(0)
  expect(passwordStrength('Aa1!Aa1')).toBe(0)
  expect(passwordStrength('  abc  ')).toBe(0)
  expect(isPasswordLongEnough('   short  ')).toBe(false)
  expect(isPasswordLongEnough('longenough')).toBe(true)
})

test('all digits, one repeated character and a sequential run are weak at any length', () => {
  expect(passwordStrength('12345678901234567890')).toBe(1)
  expect(passwordStrength('aaaaaaaaaaaaaaaa')).toBe(1)
  expect(passwordStrength('abcdefghijkl')).toBe(1)
  expect(passwordStrength('987654321')).toBe(1)
})

test('strength grows with length, case, digits with letters and symbols', () => {
  expect(passwordStrength('abcdefgh')).toBe(1)
  expect(passwordStrength('qwertyui')).toBe(1)
  expect(passwordStrength('mkjqpzvw')).toBe(1)
  expect(passwordStrength('abcdefg1')).toBe(2)
  expect(passwordStrength('mkjqpzvwnb')).toBe(2)
  expect(passwordStrength('Mkjqpzv1!x')).toBe(3)
  expect(passwordStrength('correct horse battery')).toBe(3)
})
