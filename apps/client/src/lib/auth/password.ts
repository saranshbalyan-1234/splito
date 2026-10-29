import {MIN_PASSWORD_LENGTH} from '@splito/domain'

/** 0 too short, 1 weak, 2 fair, 3 strong. */
export type PasswordStrength = 0 | 1 | 2 | 3

/** Long enough to use: padding spaces do not count towards the minimum (the form and the meter agree). */
export const isPasswordLongEnough = (password: string) => password.trim().length >= MIN_PASSWORD_LENGTH

/** A run such as `12345678`, `abcdefgh` or `87654321`: every step is one up or one down. */
function isSequential(s: string) {
  const steps = [...s].slice(1).map((c, i) => c.charCodeAt(0) - s.charCodeAt(i))
  return steps.every(d => d === 1) || steps.every(d => d === -1)
}

/**
 * How strong a password is, judged on the trimmed text. Length counts most (10, 14), then mixed case, a digit with
 * letters and a symbol; all digits, one repeated character and a sequential run are weak whatever their length.
 * ponytail: no dictionary or breach list; the server's own check (F-2102) is the real one.
 */
export function passwordStrength(password: string): PasswordStrength {
  const p = password.trim()
  if (p.length < MIN_PASSWORD_LENGTH) return 0
  if (/^\d+$/.test(p) || new Set(p).size === 1 || isSequential(p.toLowerCase())) return 1
  const points =
    Number(p.length >= 10) +
    Number(p.length >= 14) * 2 +
    Number(/[a-z]/.test(p) && /[A-Z]/.test(p)) +
    Number(/\d/.test(p) && /[A-Za-z]/.test(p)) +
    Number(/[^A-Za-z0-9\s]/.test(p))
  return points >= 3 ? 3 : points >= 1 ? 2 : 1
}
