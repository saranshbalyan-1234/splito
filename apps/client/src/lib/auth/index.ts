import {type SessionAccount} from '#/state/session'
import {type AuthClient, AuthError} from './types'
import {unavailableAuthClient} from './unavailable'

export * from './types'

/** The real auth API (F-2101/F-2102). Builds for stage and prod refuse to build without it (`scripts/authConfig.ts`). */
export const AUTH_API_URL: string | undefined = process.env.EXPO_PUBLIC_AUTH_API_URL || undefined

/** Dev and e2e builds only: the labelled "Continue with a dev account" and the local AuthClient (production folds both away). */
export const hasDevAuth = __DEV__ || process.env.EXPO_PUBLIC_ENV === 'e2e'

/**
 * The AuthClient of this build. The dev client is a lazy chunk reached only where `__DEV__` or the e2e env says so, so a
 * production bundle holds none of it (checked by `e2e-pwa/bundle.spec.ts`). ponytail: the HTTP client joins here with F-2101.
 */
export async function getAuthClient(): Promise<AuthClient> {
  if (__DEV__ || process.env.EXPO_PUBLIC_ENV === 'e2e') return (await import('#/lib/auth/dev')).devAuthClient
  return unavailableAuthClient
}

/** "Continue with a dev account" (dev and e2e builds only): the labelled local account. Anywhere else it refuses. */
export async function getDevAccount(): Promise<SessionAccount> {
  if (__DEV__ || process.env.EXPO_PUBLIC_ENV === 'e2e') {
    const {DEV_ACCOUNT: d} = await import('#/lib/auth/dev')
    return {id: d.id, name: d.name, email: d.email, phone: d.phone}
  }
  throw new AuthError('unavailable')
}
