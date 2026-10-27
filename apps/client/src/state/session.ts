/*
 * The one place screens ask "is someone signed in?" (Bluesky's
 * `#/state/session` hook shape: `useSession().hasSession`). Splito has no
 * auth backend yet (BACKLOG F-2101..F-2105), so this answers signed out on
 * every device; the sign-in screens say so honestly and never fake a
 * session. When auth lands, a provider replaces this module.
 */

export type SessionState = {
  hasSession: boolean
  /** Set once sign-in exists; feedback prefills the reply email from it. */
  currentAccount: {email?: string} | undefined
}

const SIGNED_OUT: SessionState = {hasSession: false, currentAccount: undefined}

/** Signed out until the auth backend exists. */
export function useSession(): SessionState {
  return SIGNED_OUT
}
