/*
 * Sign-in field checks, shared by the client's sign-in screens and (M2) the
 * API, so both accept the same input.
 */

/** A plausible email address: something@domain.tld, no spaces. */
export function isEmail(input: string): boolean {
  return /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(input.trim())
}

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

/** A one-time sign-in code: exactly six digits. */
export function isSignInCode(input: string): boolean {
  return /^\d{6}$/.test(input.trim())
}
