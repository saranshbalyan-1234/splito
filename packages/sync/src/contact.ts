// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/components/contacts/phone-number.ts (normalizePhoneNumber)
import {type Contact, detectContactKind, isContactEmail} from '@splito/domain'
import {type CountryCode, isSupportedCountry, parsePhoneNumberFromString} from 'libphonenumber-js'

/*
 * Phone parsing needs libphonenumber's metadata, so it lives here rather
 * than in packages/domain, which imports nothing (ARCHITECTURE section 1).
 * The shape checks (Contact, detectContactKind, contactKey) stay in domain.
 */

/**
 * One field, auto-detected: an email, or a phone number read with the user's
 * region as default (`98765 43210` in IN is `+919876543210`). Null until valid.
 */
export function parseContact(raw: string, region: string): Contact | null {
  const v = raw.trim()
  const kind = detectContactKind(v)
  if (kind === 'email') return isContactEmail(v) ? {kind, value: v.toLowerCase()} : null
  if (kind !== 'phone') return null
  const country = isSupportedCountry(region) ? (region as CountryCode) : undefined
  const n = parsePhoneNumberFromString(v, country)
  return n?.isValid() ? {kind, value: n.number} : null
}

/** True for a stored contact (already normalised). */
export function isContact(c: unknown): c is Contact {
  const x = c as Contact | null
  if (!x || typeof x.value !== 'string') return false
  if (x.kind === 'email') return isContactEmail(x.value) && x.value === x.value.toLowerCase()
  return x.kind === 'phone' && parsePhoneNumberFromString(x.value)?.number === x.value
}

/** Display form: `+91 98765 43210`, or the email as is. */
export function formatContact(c: Contact): string {
  return c.kind === 'email' ? c.value : (parsePhoneNumberFromString(c.value)?.formatInternational() ?? c.value)
}

