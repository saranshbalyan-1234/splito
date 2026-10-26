import {describe, expect, test} from 'bun:test'

import {isEmail, isSignInCode, normalizePhone} from '../src/contact'

describe('sign-in fields', () => {
  test('email: one @, a dotted domain, no spaces', () => {
    expect(isEmail('riya@example.com')).toBe(true)
    expect(isEmail('  riya.sharma+trip@mail.co.in ')).toBe(true)
    expect(isEmail('riya@localhost')).toBe(false)
    expect(isEmail('riya example.com')).toBe(false)
    expect(isEmail('@example.com')).toBe(false)
    expect(isEmail('')).toBe(false)
  })
  test('phone: international digits, spaces and dashes dropped; 8 to 15 digits', () => {
    expect(normalizePhone('+91 98765-43210')).toBe('+919876543210')
    expect(normalizePhone('+1 (415) 555 0100')).toBe('+14155550100')
    expect(normalizePhone('98765 43210')).toBeNull()
    expect(normalizePhone('+12')).toBeNull()
    expect(normalizePhone('+91 98765x43210')).toBeNull()
  })
  test('code: exactly six digits', () => {
    expect(isSignInCode('042195')).toBe(true)
    expect(isSignInCode(' 042195 ')).toBe(true)
    expect(isSignInCode('42195')).toBe(false)
    expect(isSignInCode('04219a')).toBe(false)
  })
})
