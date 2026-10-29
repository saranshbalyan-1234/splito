import {AuthError, type AuthClient} from './types'

/** The client of every build without the auth API (production today): nothing works and nothing pretends to, so the screens say "arrives with sync". */
const refuse = (): Promise<never> => Promise.reject(new AuthError('unavailable'))

export const unavailableAuthClient: AuthClient = {
  lookup: refuse,
  sendCode: refuse,
  verifyCode: refuse,
  signInWithPassword: refuse,
  signInWithCode: refuse,
  createAccount: refuse,
  resetPassword: refuse,
  addContact: refuse,
}
