import {randomUUID} from 'expo-crypto'
import {type Contact, isSignInCode, MIN_PASSWORD_LENGTH} from '@splito/domain'

import {type SessionAccount, type SessionApi} from '#/state/session'
import {device} from '#/storage'
import {showDevCode} from './devCodes'
import {isOffline} from './online'
import {AuthError, type AuthClient, type CodePurpose, type NewAccount} from './types'

/*
 * The dev AuthClient (dev and e2e builds only; ARCHITECTURE 26.15): accounts live in device storage and codes are shown
 * in the Continue flow's dev banner, so the whole flow runs with no server. Never reachable from a production bundle.
 * ponytail: plain-text passwords in device storage are fine for a labelled local fake; the real client never stores one.
 */
type DevAccount = SessionAccount & {password?: string}

/** "Continue with a dev account" signs in here; e2e's `signIn()` too. */
export const DEV_ACCOUNT: DevAccount = {
  id: 'dev',
  name: 'Dev account',
  email: 'dev@splito.test',
  phone: '+919876500001',
  password: 'devpassword',
}

const read = (): DevAccount[] => {
  const raw = device.get(['devAccounts'])
  const list = raw ? (JSON.parse(raw) as DevAccount[]) : []
  return list.some(a => a.id === DEV_ACCOUNT.id) ? list : [DEV_ACCOUNT, ...list]
}
const write = (list: DevAccount[]) => device.set(['devAccounts'], JSON.stringify(list))
const publicOf = ({password: _password, ...account}: DevAccount): SessionAccount => account
const find = (list: DevAccount[], c: Contact) => list.find(a => (c.kind === 'email' ? a.email : a.phone) === c.value)

const codes = new Map<string, string>()
const keyOf = (c: Contact) => `${c.kind}:${c.value}`

function online() {
  if (isOffline()) throw new AuthError('offline')
}

function checkCode(c: Contact, code: string) {
  if (!isSignInCode(code) || codes.get(keyOf(c)) !== code.trim()) throw new AuthError('bad-code')
}

export const devAuthClient: AuthClient = {
  async lookup(contact) {
    online()
    const account = find(read(), contact)
    return {exists: !!account, hasPassword: !!account?.password}
  },
  async sendCode(contact, purpose: CodePurpose) {
    online()
    const code = String(Math.floor(100000 + Math.random() * 900000))
    codes.set(keyOf(contact), code)
    showDevCode({to: contact.value, code, purpose})
  },
  async verifyCode(contact, code) {
    online()
    checkCode(contact, code)
  },
  async signInWithPassword(contact, password) {
    online()
    const account = find(read(), contact)
    if (!account?.password || account.password !== password) throw new AuthError('bad-password')
    return publicOf(account)
  },
  async signInWithCode(contact, code) {
    online()
    checkCode(contact, code)
    const account = find(read(), contact)
    if (!account) throw new AuthError('no-account')
    codes.delete(keyOf(contact))
    return publicOf(account)
  },
  async createAccount(input: NewAccount) {
    online()
    const list = read()
    if (find(list, {kind: 'email', value: input.email}) || find(list, {kind: 'phone', value: input.phone})) throw new AuthError('taken')
    if (input.password.length < MIN_PASSWORD_LENGTH) throw new AuthError('bad-password')
    const account: DevAccount = {id: randomUUID(), name: input.name.trim(), email: input.email, phone: input.phone, password: input.password}
    write([...list, account])
    return publicOf(account)
  },
  async resetPassword(contact, code, password) {
    online()
    checkCode(contact, code)
    const list = read()
    const account = find(list, contact)
    if (!account) throw new AuthError('no-account')
    if (password.length < MIN_PASSWORD_LENGTH) throw new AuthError('bad-password')
    account.password = password
    write(list)
    codes.delete(keyOf(contact))
  },
  async addContact(session, contact, code) {
    online()
    checkCode(contact, code)
    const list = read()
    if (find(list, contact)) throw new AuthError('taken')
    const account = list.find(a => a.id === session.id)
    if (!account) throw new AuthError('no-account')
    account[contact.kind === 'email' ? 'email' : 'phone'] = contact.value
    write(list)
    codes.delete(keyOf(contact))
    return publicOf(account)
  },
}

type Hooks = Record<string, unknown>

/**
 * E2E builds only: `window.__splitoTest.signIn()` signs in the dev account (and marks the intro seen, which e2e runs
 * never show), so every spec starts inside the app; `signOut()` ends the session; `seedAccount()` adds a local account
 * (an older email-only one, say) to sign in to through the real screens.
 */
export function installAuthTestHook(api: SessionApi) {
  if (typeof window === 'undefined') return
  const w = window as unknown as {__splitoTest?: Hooks}
  w.__splitoTest = {
    ...w.__splitoTest,
    signIn: () => {
      device.set(['tourSeen'], true)
      write(read())
      api.signIn(publicOf(DEV_ACCOUNT))
    },
    signOut: () => api.signOut(),
    seedAccount: (account: Omit<DevAccount, 'id'>) => write([...read(), {...account, id: randomUUID()}]),
  }
}
