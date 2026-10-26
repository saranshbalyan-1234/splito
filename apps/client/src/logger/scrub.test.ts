import {expect, test} from 'bun:test'

import {isOpaqueId, scrubAttributes, scrubMetadata, scrubText} from './scrub'

test('scrubText removes emails, phone numbers, amounts and URL tokens, keeping the shape', () => {
  expect(scrubText('mail riya@example.com now')).toBe('mail [email] now')
  expect(scrubText('call +91 98765 43210')).toBe('call [number]')
  expect(scrubText('paid 1,250.50 for dinner')).toBe('paid [number] for dinner')
  expect(scrubText('open https://splito.app/join/AbCdEf123456?code=99&x=1#frag')).toBe('open https://splito.app/join/:token')
  expect(scrubText('upi://pay?pa=riya@okaxis&am=12.00')).toBe('upi://pay')
  expect(scrubText('/groups/1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed/settle')).toBe('/groups/:id/settle')
  // Short counts and codes stay readable.
  expect(scrubText('PAYERS_MISMATCH on step 3')).toBe('PAYERS_MISMATCH on step 3')
})

test('scrubMetadata redacts personal keys at any depth and scrubs every string', () => {
  const out = scrubMetadata({
    where: 'AddFriend.save',
    name: 'Riya Sharma',
    nested: {title: 'Goa villa', notes: 'room 4', amount: 4000000n, currency: 'INR', count: 3},
    list: ['riya@example.com', 7],
    error: new Error('Could not save Riya: 1200.50'),
  })
  expect(out).toEqual({
    where: 'AddFriend.save',
    name: '[redacted]',
    nested: {title: '[redacted]', notes: '[redacted]', amount: '[redacted]', currency: 'INR', count: 3},
    list: ['[email]', 7],
    error: 'Error: Could not save Riya: [number]',
  })
})

test('scrubMetadata never throws on cycles, bigints or odd values', () => {
  const a: Record<string, unknown> = {x: 1n}
  a.self = a
  expect(() => scrubMetadata(a)).not.toThrow()
  expect(scrubMetadata(a)).toEqual({x: '[redacted]', self: '[cycle]'})
})

test('metric attributes keep only enums, booleans and small numbers', () => {
  expect(scrubAttributes({outcome: 'saved', ms: 42, cached: true, title: 'Dinner at Thalassa', who: 'riya@example.com', big: 10n})).toEqual({
    outcome: 'saved',
    ms: 42,
    cached: true,
  })
})

test('only opaque ids identify anyone: never an email, a phone or a name', () => {
  expect(isOpaqueId('1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed')).toBe(true)
  expect(isOpaqueId('acct_8f3a2b1c9d')).toBe(true)
  expect(isOpaqueId('riya@example.com')).toBe(false)
  expect(isOpaqueId('+919876543210')).toBe(false)
  expect(isOpaqueId('Riya Sharma')).toBe(false)
  expect(isOpaqueId('riya')).toBe(false)
})
