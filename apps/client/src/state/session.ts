import {useSyncExternalStore} from 'react'

import {accountScope, device, setStorageScope} from '#/storage'

/*
 * The one place screens ask "is someone signed in?" (Bluesky's `#/state/session`
 * hook shape: `useSession()` and `useSessionApi()`). Sign-in is required
 * (ARCHITECTURE 26.15, F-250): signed out is the default and the whole app is
 * the logged-out flow. The account is kept in device storage; the real auth API
 * (F-2101/F-2102) adds a token beside it in the credential store (§ 11).
 * A module store, not a context: the gate, the e2e hook and `lib/links` read it
 * outside React too.
 */

/** The account this device is signed in to. */
export type SessionAccount = {
  id: string
  name: string
  email?: string
  phone?: string
}

export type SessionState = {
  hasSession: boolean
  currentAccount: SessionAccount | undefined
  /** A contact the account lacks (owner 139): the app stays blocked on "Add your ..." until it is added. */
  missingContact: 'phone' | 'email' | undefined
  /** Whether this account's changes can reach a server. False until the sync engine exists (F-2103), so rows stay "Saved on this device". */
  canSync: boolean
}

function readAccount(): SessionAccount | undefined {
  const s = device.get(['session'])
  return s && typeof s.id === 'string' && typeof s.name === 'string' ? s : undefined
}

function stateFor(account: SessionAccount | undefined): SessionState {
  return {
    hasSession: !!account,
    currentAccount: account,
    missingContact: account && (!account.email ? 'email' : !account.phone ? 'phone' : undefined),
    canSync: false,
  }
}

let state = stateFor(readAccount())
/* Before the first render: this account's device keys (first-frame theme copies, drafts, search history). */
if (state.currentAccount) setStorageScope(accountScope(state.currentAccount.id))
const listeners = new Set<() => void>()

function set(account: SessionAccount | undefined) {
  if (account) device.set(['session'], account)
  else device.remove(['session'])
  state = stateFor(account)
  setStorageScope(account ? accountScope(account.id) : '')
  listeners.forEach(l => l())
}

/** Signs in (or updates the signed-in account's details, as the Add-missing step does). */
function signIn(account: SessionAccount) {
  set(account)
}

/** Ends the session. Closing the account's database and the keep-or-erase choice are `logOut` in `#/data/account`. */
function signOut() {
  set(undefined)
}

export const sessionApi = {signIn, signOut}
export type SessionApi = typeof sessionApi

/** Who is signed in. */
export function useSession(): SessionState {
  return useSyncExternalStore(
    l => (listeners.add(l), () => void listeners.delete(l)),
    () => state,
  )
}

export const useSessionApi = () => sessionApi

/** Outside React (the link layer): whether anyone is signed in. */
export const isSignedIn = () => state.hasSession

/* E2E builds only: `window.__splitoTest.signIn()` and friends (the dev AuthClient's chunk is reached nowhere else). */
if (process.env.EXPO_PUBLIC_ENV === 'e2e') {
  void import('#/lib/auth/dev').then(m => m.installAuthTestHook(sessionApi))
  void import('#/data/legacyTestHook').then(m => m.installLegacyTestHook())
}
