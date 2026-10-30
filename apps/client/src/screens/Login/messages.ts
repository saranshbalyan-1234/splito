import {useLingui} from '@lingui/react/macro'

import {type AuthErrorCode} from '#/lib/auth'

/** The sentence for an auth failure (ARCHITECTURE 7: the client says why in a code, the screen words it). */
export function useAuthErrorText() {
  const {t: l} = useLingui()
  return (code: AuthErrorCode | 'unknown'): string =>
    ({
      unavailable: l`Sign-in arrives with sync. Your data stays safe on this device.`,
      offline: l`Signing in needs a connection. Check yours and try again.`,
      'bad-password': l`That password isn’t right. Try again, or use a code instead.`,
      'bad-token': l`That check expired. Please enter a new code.`,
      'bad-code': l`That code isn’t right. Check the 6 digits and try again.`,
      'no-account': l`We couldn’t find that account.`,
      taken: l`That email or phone number belongs to another account.`,
      unknown: l`Something went wrong. Please try again.`,
    })[code]
}
