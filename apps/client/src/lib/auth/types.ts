import {type Contact} from '@splito/domain'

import {type SessionAccount} from '#/state/session'

/** Why an auth call failed; screens word each one (ARCHITECTURE 7: codes, not sentences). */
export type AuthErrorCode =
  | 'unavailable' // no auth API behind this build yet (production until F-2101/F-2102)
  | 'offline' // sign-in needs a connection
  | 'bad-password'
  | 'bad-code'
  | 'bad-token' // a verification token is unknown, used or expired
  | 'no-account'
  | 'taken' // the contact belongs to another account

export class AuthError extends Error {
  constructor(readonly code: AuthErrorCode) {
    super(code)
    this.name = 'AuthError'
  }
}

/** What the account lookup answers. A new contact and a wrong password are told apart only here, never on the password step. */
export type Lookup = {exists: boolean; hasPassword: boolean}

/** Why a code is asked for. The server words its message and rate-limits per purpose. */
export type CodePurpose = 'signin' | 'signup' | 'reset' | 'add-contact'

/** A short-lived proof that someone entered the right code for a contact (`verifyCode`); the account calls take it, never the code again. */
export type VerifiedContact = {token: string}

/** Both contacts arrive with the token `verifyCode` gave for each (owner 139): the server checks the tokens, never trusts the client's word. */
export type NewAccount = {name: string; password: string; email: string; emailToken: string; phone: string; phoneToken: string}

/**
 * Everything the Continue flow needs from an auth backend (owners 125, 138-144). The real HTTP client arrives with
 * F-2101/F-2102; until then dev and e2e builds get `lib/auth/dev.ts` and every other build the `unavailable` client,
 * so no screen fakes a session. Methods resolve with the account to sign in, or throw `AuthError`.
 */
export interface AuthClient {
  lookup(contact: Contact): Promise<Lookup>
  sendCode(contact: Contact, purpose: CodePurpose): Promise<void>
  /** Checks a code and answers a short-lived token for the contact (the new-account and add-contact steps verify before the account call). */
  verifyCode(contact: Contact, code: string, purpose: CodePurpose): Promise<VerifiedContact>
  signInWithPassword(contact: Contact, password: string): Promise<SessionAccount>
  signInWithCode(contact: Contact, code: string): Promise<SessionAccount>
  /** Both contacts were verified with `verifyCode` first; their tokens come with the call. */
  createAccount(account: NewAccount): Promise<SessionAccount>
  resetPassword(contact: Contact, code: string, password: string): Promise<void>
  /** Adds the missing email or phone to the signed-in account, with the token `verifyCode` gave for it. */
  addContact(account: SessionAccount, contact: Contact, token: string): Promise<SessionAccount>
}
