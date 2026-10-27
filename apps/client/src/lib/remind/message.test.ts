import {expect, test} from 'bun:test'

import {buildRemindMessage, type RemindWords, upiLinkWithoutPlaceholderName, whatsappUrl} from './message'

const words: RemindWords = {
  greeting: name => `Hi ${name},`,
  oweOne: (amount, group) => `A friendly reminder from Splito: you owe me ${amount}${group ? ` for ${group}` : ''}.`,
  oweMany: group => `A friendly reminder from Splito: you owe me${group ? ` for ${group}` : ''}:`,
  payUpi: id => `Pay by UPI to ${id}:`,
  payLink: () => 'Pay here:',
  thanks: () => 'Thanks!',
}

test('one currency reads as one sentence, with the group', () => {
  expect(buildRemindMessage({name: 'Riya', amounts: {INR: 45000n}, groupName: 'Goa', locale: 'en', words })).toBe(
    ['Hi Riya,', 'A friendly reminder from Splito: you owe me ₹450.00 for Goa.', '', 'Thanks!'].join('\n'),
  )
})

test('several currencies are listed one per line in code order, never summed', () => {
  const text = buildRemindMessage({name: 'Riya', amounts: {USD: 1050n, INR: 45000n, JPY: 1200n, BHD: 12345n}, locale: 'en', words })
  expect(text.split('\n')).toEqual([
    'Hi Riya,',
    'A friendly reminder from Splito: you owe me:',
    '• BHD\u00a012.345',
    '• ₹450.00',
    '• ¥1,200',
    '• $10.50',
    '',
    'Thanks!',
  ])
})

test('amounts follow the number locale', () => {
  expect(buildRemindMessage({name: 'Riya', amounts: {INR: 12345600n}, locale: 'hi-IN', words })).toContain('₹1,23,456.00')
})

test('the UPI link is added only when rupees are owed and a UPI id is known', () => {
  const upi = {id: 'me@okaxis', link: 'upi://pay?pa=me%40okaxis&am=450.00&cu=INR'}
  const withUpi = buildRemindMessage({name: 'Riya', amounts: {INR: 45000n}, locale: 'en', upi, words })
  expect(withUpi).toContain('Pay by UPI to me@okaxis:\nupi://pay?pa=me%40okaxis&am=450.00&cu=INR')
  expect(buildRemindMessage({name: 'Riya', amounts: {USD: 1000n}, locale: 'en', upi, words })).not.toContain('upi://')
  expect(buildRemindMessage({name: 'Riya', amounts: {INR: 45000n}, locale: 'en', words })).not.toContain('upi://')
})

test('a payment link I gave is its own line', () => {
  expect(buildRemindMessage({name: 'Riya', amounts: {EUR: 2000n}, locale: 'en', paymentLink: 'https://paypal.me/me', words })).toContain('Pay here:\nhttps://paypal.me/me')
})

test('nothing owed is not a message', () => {
  expect(() => buildRemindMessage({name: 'Riya', amounts: {}, locale: 'en', words })).toThrow('nothing is owed')
})

test('WhatsApp links keep the digits of any phone spelling and encode the text', () => {
  expect(whatsappUrl('+91 98765-43210', 'Hi Riya,\nthanks & bye')).toBe('https://wa.me/919876543210?text=Hi%20Riya%2C%0Athanks%20%26%20bye')
  expect(whatsappUrl(null, 'x')).toBeNull()
  expect(whatsappUrl('abc', 'x')).toBeNull()
})

test('the UPI link drops the payee name while mine is the placeholder, and keeps a real one', () => {
  const link = 'upi://pay?pa=me%40okaxis&pn=Me&am=450.00&cu=INR&tn=Splito'
  expect(upiLinkWithoutPlaceholderName(link, 'Me')).toBe('upi://pay?pa=me%40okaxis&am=450.00&cu=INR&tn=Splito')
  expect(upiLinkWithoutPlaceholderName(link, ' ')).toBe('upi://pay?pa=me%40okaxis&am=450.00&cu=INR&tn=Splito')
  const named = 'upi://pay?pa=me%40okaxis&pn=Saransh&am=450.00&cu=INR&tn=Splito'
  expect(upiLinkWithoutPlaceholderName(named, 'Saransh')).toBe(named)
})
