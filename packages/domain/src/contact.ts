/*
 * Sign-in field checks, shared by the client's sign-in screens and (M2) the
 * API, so both accept the same input.
 */

/**
 * A phone number in international form ("+91 98765 43210"): the leading +
 * and country code are required, spaces, dashes, dots and brackets are
 * dropped, and 8 to 15 digits remain (E.164). Returns `+digits`, or null.
 */
export function normalizePhone(input: string): string | null {
  const s = input.trim()
  if (!s.startsWith('+')) return null
  const rest = s.slice(1)
  if (!/^[\d\s().-]+$/.test(rest)) return null
  const digits = rest.replace(/\D/g, '')
  return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null
}

/** The shortest password sign-up and password reset accept (Bluesky's rule). */
export const MIN_PASSWORD_LENGTH = 8

/** A one-time sign-in code: exactly six digits. */
export function isSignInCode(input: string): boolean {
  return /^\d{6}$/.test(input.trim())
}

/** How to reach someone: a lower-cased email or an E.164 mobile number. */
export type Contact = {kind: 'email'; value: string} | {kind: 'phone'; value: string}

// ponytail: shape check only; the directory (or the mail server) is the real validator.
const EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[^\s@.]{2,}$/

/** The one email check (sign-in, friends, feedback): name@domain.tld, a top-level domain of 2+ characters, no spaces. Callers trim first. */
export function isContactEmail(v: string): boolean {
  return EMAIL_RE.test(v)
}
const PHONE_CHARS = /^\+?[\d\s().-]+$/

/** What the user is typing into the one "Email or mobile number" field, before it is valid. */
export function detectContactKind(raw: string): Contact['kind'] | null {
  const v = raw.trim()
  if (v.includes('@')) return 'email'
  if (PHONE_CHARS.test(v) && /\d/.test(v)) return 'phone'
  return null
}

/** Equality key: two contacts are the same person to the directory when keys match. */
export function contactKey(c: Contact): string {
  return `${c.kind}:${c.value}`
}
