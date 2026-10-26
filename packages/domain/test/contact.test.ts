import {describe, expect, test} from 'bun:test'

import {
  contactKey,
  detectContactKind,
  formatContact,
  isContact,
  isEmail,
  isSignInCode,
  normalizePhone,
  parseContact,
} from '../src/contact'

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

test('emails are trimmed and lower-cased', () => {
  expect(parseContact('  Riya.Sharma@Example.COM ', 'IN')).toEqual({kind: 'email', value: 'riya.sharma@example.com'})
})

test('a bad email is not a contact', () => {
  for (const raw of ['riya@', '@example.com', 'riya@example', 'a b@example.com', '']) expect(parseContact(raw, 'IN')).toBeNull()
})

test('local mobile numbers take the region; international ones keep their own', () => {
  expect(parseContact('98765 43210', 'IN')).toEqual({kind: 'phone', value: '+919876543210'})
  expect(parseContact('+1 (415) 555-0134', 'IN')).toEqual({kind: 'phone', value: '+14155550134'})
  expect(parseContact('(415) 555-0134', 'US')).toEqual({kind: 'phone', value: '+14155550134'})
})

test('too short or junk numbers are rejected', () => {
  expect(parseContact('12345', 'IN')).toBeNull()
  expect(parseContact('98765abc', 'IN')).toBeNull()
})

test('kind is detected while typing, before the value is valid', () => {
  expect(detectContactKind('riya@')).toBe('email')
  expect(detectContactKind('+91 98')).toBe('phone')
  expect(detectContactKind('Riya')).toBeNull()
  expect(detectContactKind('')).toBeNull()
})

test('formatting and keys', () => {
  expect(formatContact({kind: 'phone', value: '+919876543210'})).toBe('+91 98765 43210')
  expect(formatContact({kind: 'email', value: 'a@b.co'})).toBe('a@b.co')
  expect(contactKey({kind: 'phone', value: '+919876543210'})).toBe('phone:+919876543210')
  expect(isContact({kind: 'phone', value: '+919876543210'})).toBe(true)
  expect(isContact({kind: 'phone', value: '98765'})).toBe(false)
  expect(isContact({kind: 'fax', value: '1'})).toBe(false)
})
