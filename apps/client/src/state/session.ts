/*
 * The one place screens ask "is someone signed in?" (Bluesky's
 * `#/state/session` hook shape: `useSession().hasSession`). Splito has no
 * auth backend yet (BACKLOG F-2101..F-2105), so this answers signed out on
 * every device; the sign-in screens say so honestly and never fake a
 * session. When auth lands, a provider replaces this module.
 */

/** An account this device has signed in to before (Bluesky's `SessionAccount`, trimmed). */
export type SessionAccount = {
  id: string
  name: string
  /** The email or phone number the account signs in with. */
  contact: string
}

export type SessionState = {
  hasSession: false
  currentAccount: undefined
  /** Accounts remembered on this device; always empty until the auth backend exists. */
  accounts: ReadonlyArray<SessionAccount>
}

const NO_ACCOUNTS: ReadonlyArray<SessionAccount> = []
const SIGNED_OUT: SessionState = {
  hasSession: false,
  currentAccount: undefined,
  accounts: NO_ACCOUNTS,
}

/** Signed out until the auth backend exists. */
export function useSession(): SessionState {
  return SIGNED_OUT
}
