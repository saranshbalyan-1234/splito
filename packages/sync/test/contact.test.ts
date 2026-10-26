import {expect, test} from 'bun:test'

import {formatContact, isContact, parseContact} from '../src/contact'

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

test('formatting and keys', () => {
  expect(formatContact({kind: 'phone', value: '+919876543210'})).toBe('+91 98765 43210')
  expect(formatContact({kind: 'email', value: 'a@b.co'})).toBe('a@b.co')
  expect(isContact({kind: 'phone', value: '+919876543210'})).toBe(true)
  expect(isContact({kind: 'phone', value: '98765'})).toBe(false)
  expect(isContact({kind: 'fax', value: '1'})).toBe(false)
})
