import {type CountryCode, isSupportedCountry, parsePhoneNumberFromString} from 'libphonenumber-js'

/** How to reach someone: a lower-cased email or an E.164 mobile number. */
export type Contact = {kind: 'email'; value: string} | {kind: 'phone'; value: string}

// ponytail: shape check only; the directory (or the mail server) is the real validator.
const EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[^\s@.]{2,}$/
const PHONE_CHARS = /^\+?[\d\s().-]+$/

/** What the user is typing into the one "Email or mobile number" field, before it is valid. */
export function detectContactKind(raw: string): Contact['kind'] | null {
  const v = raw.trim()
  if (v.includes('@')) return 'email'
  if (PHONE_CHARS.test(v) && /\d/.test(v)) return 'phone'
  return null
}

/**
 * One field, auto-detected: an email, or a phone number read with the user's
 * region as default (`98765 43210` in IN is `+919876543210`). Null until valid.
 */
export function parseContact(raw: string, region: string): Contact | null {
  const v = raw.trim()
  const kind = detectContactKind(v)
  if (kind === 'email') return EMAIL_RE.test(v) ? {kind, value: v.toLowerCase()} : null
  if (kind !== 'phone') return null
  const country = isSupportedCountry(region) ? (region as CountryCode) : undefined
  const n = parsePhoneNumberFromString(v, country)
  return n?.isValid() ? {kind, value: n.number} : null
}

/** True for a stored contact (already normalised). */
export function isContact(c: unknown): c is Contact {
  const x = c as Contact | null
  if (!x || typeof x.value !== 'string') return false
  if (x.kind === 'email') return EMAIL_RE.test(x.value) && x.value === x.value.toLowerCase()
  return x.kind === 'phone' && parsePhoneNumberFromString(x.value)?.number === x.value
}

/** Display form: `+91 98765 43210`, or the email as is. */
export function formatContact(c: Contact): string {
  return c.kind === 'email' ? c.value : (parsePhoneNumberFromString(c.value)?.formatInternational() ?? c.value)
}

/** Equality key: two contacts are the same person to the directory when keys match. */
export function contactKey(c: Contact): string {
  return `${c.kind}:${c.value}`
}
