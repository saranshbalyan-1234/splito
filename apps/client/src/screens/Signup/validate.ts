import {MIN_PASSWORD_LENGTH} from '@splito/domain'
import {parseContact} from '@splito/sync'

/**
 * What is wrong with the Create account form, as a code (ARCHITECTURE 7:
 * validators return codes, the screen words them). Fields are checked top to
 * bottom, so the first problem is the one shown. Null means every field is
 * valid.
 */
export type SignupIssue =
  | 'name-missing'
  | 'identifier-missing'
  | 'identifier-invalid'
  | 'password-missing'
  | 'password-short'

export function firstSignupIssue(
  fields: {name: string; identifier: string; password: string},
  region: string,
): SignupIssue | null {
  if (!fields.name.trim()) return 'name-missing'
  if (!fields.identifier.trim()) return 'identifier-missing'
  if (!parseContact(fields.identifier, region)) return 'identifier-invalid'
  if (!fields.password) return 'password-missing'
  if (fields.password.length < MIN_PASSWORD_LENGTH) return 'password-short'
  return null
}
