import {useSyncExternalStore} from 'react'

import {isAccountId} from '#/data/storeNames'
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
  /** The account's log out has begun: its data is being erased and nothing else shows until that is done (owner 186). */
  isLoggingOut: boolean
  /** Whether this account's changes can reach a server. False until the sync engine exists (F-2103), so rows stay "Saved on this device". */
  canSync: boolean
}

function readAccount(): SessionAccount | undefined {
  const s = device.get(['session'])
  /* An id that could not be a database name is no session (the account id becomes part of one). */
  return s && isAccountId(s.id) && typeof s.name === 'string' ? s : undefined
}

function stateFor(account: SessionAccount | undefined): SessionState {
  return {
    hasSession: !!account,
    currentAccount: account,
    missingContact: account && (!account.email ? 'email' : !account.phone ? 'phone' : undefined),
    isLoggingOut: !!account && device.get(['loggingOut']) === account.id,
    canSync: false,
  }
}

let state = stateFor(readAccount())
/* Before the first render: this account's device keys (first-frame theme copies, drafts, search history). */
if (state.currentAccount) setStorageScope(accountScope(state.currentAccount.id))
const listeners = new Set<() => void>()

function adopt(account: SessionAccount | undefined) {
  state = stateFor(account)
  setStorageScope(account ? accountScope(account.id) : '')
  listeners.forEach(l => l())
}

function set(account: SessionAccount | undefined) {
  if (account) device.set(['session'], account)
  else device.remove(['session'])
  adopt(account)
}

/*
 * Another tab signed in, out or in as someone else: this tab follows (web; a `storage` event never fires in the tab that
 * wrote). Signing out there closes this tab's database here too, through the same gate, and a tab never keeps showing
 * an account the device no longer holds.
 */
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('storage', e => {
    if (e.key !== null && !/\\(session|loggingOut)$/.test(e.key)) return
    const next = readAccount()
    const was = state.currentAccount
    if (next?.id === was?.id && next?.email === was?.email && next?.phone === was?.phone && stateFor(next).isLoggingOut === state.isLoggingOut) return
    adopt(next)
  })
}

/** Signs in (or updates the signed-in account's details, as the Add-missing step does). */
function signIn(account: SessionAccount) {
  /* Web: a sign-in from the intro's address (`/welcome/2`, the e2e hook) must not land the app on the intro's replay route. */
  if (typeof window !== 'undefined' && /^\/welcome(\/|$)/.test(window.location.pathname)) window.history.replaceState(window.history.state, '', '/')
  set(account)
}

/** Ends the session (the e2e hook, a tab following another one, and the last step of `logOut`). */
function signOut() {
  device.remove(['loggingOut'])
  set(undefined)
}

/** The log out starts: the account stays signed in, in a state that shows only "Logging out", until `signOut` ends it. */
function beginLogout() {
  if (!state.currentAccount) return
  device.set(['loggingOut'], state.currentAccount.id)
  adopt(state.currentAccount)
}

export const sessionApi = {signIn, signOut, beginLogout}
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

/** The name this account signed up with, for the "me" person of its database (a name typed at sign-up is not thrown away); 'Me' when there is none. */
export function accountName(accountId: string): string {
  const account = state.currentAccount
  return account && account.id === accountId && account.name.trim() ? account.name : 'Me'
}

/* E2E builds only: `window.__splitoTest.signIn()` and friends (the dev AuthClient's chunk is reached nowhere else). */
if (process.env.EXPO_PUBLIC_ENV === 'e2e') {
  void import('#/lib/auth/testHook').then(m => m.installAuthTestHook(sessionApi))
  void import('#/data/legacyTestHook').then(m => m.installLegacyTestHook())
}
