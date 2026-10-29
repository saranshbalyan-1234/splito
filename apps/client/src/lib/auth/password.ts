import {MIN_PASSWORD_LENGTH} from '@splito/domain'

/** 0 too short, 1 weak, 2 fair, 3 strong: how many of length 12+, mixed case, a digit and a symbol it has, from a valid length. */
export type PasswordStrength = 0 | 1 | 2 | 3

export function passwordStrength(password: string): PasswordStrength {
  if (password.length < MIN_PASSWORD_LENGTH) return 0
  const points =
    Number(password.length >= 12) +
    Number(/[a-z]/.test(password) && /[A-Z]/.test(password)) +
    Number(/\d/.test(password)) +
    Number(/[^A-Za-z0-9]/.test(password))
  return points >= 3 ? 3 : points >= 1 ? 2 : 1
}
