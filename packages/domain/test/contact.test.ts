import {describe, expect, test} from 'bun:test'

import {
  contactKey,
  detectContactKind,
  isContactEmail,
  isSignInCode,
  normalizePhone,
} from '../src/contact'

describe('sign-in fields', () => {
  test('email: one @, a dotted domain, no spaces', () => {
    expect(isContactEmail('riya@example.com')).toBe(true)
    expect(isContactEmail('riya.sharma+trip@mail.co.in')).toBe(true)
    expect(isContactEmail('riya@localhost')).toBe(false)
    expect(isContactEmail('riya example.com')).toBe(false)
    expect(isContactEmail('@example.com')).toBe(false)
    expect(isContactEmail('')).toBe(false)
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

test('kind is detected while typing, before the value is valid', () => {
  expect(detectContactKind('riya@')).toBe('email')
  expect(detectContactKind('+91 98')).toBe('phone')
  expect(detectContactKind('Riya')).toBeNull()
  expect(detectContactKind('')).toBeNull()
})

test('contact email shape and keys', () => {
  expect(isContactEmail('a@b.co')).toBe(true)
  expect(isContactEmail('riya@example')).toBe(false)
  expect(contactKey({kind: 'phone', value: '+919876543210'})).toBe('phone:+919876543210')
})
