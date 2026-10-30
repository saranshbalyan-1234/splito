import {randomUUID} from 'expo-crypto'
import {type Contact, isSignInCode} from '@splito/domain'

import {type SessionAccount} from '#/state/session'
import {device} from '#/storage'
import {showDevCode} from './devCodes'
import {isOffline} from './online'
import {isPasswordLongEnough} from './password'
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

export const readDevAccounts = (): DevAccount[] => {
  const raw = device.get(['devAccounts'])
  const list = raw ? (JSON.parse(raw) as DevAccount[]) : []
  return list.some(a => a.id === DEV_ACCOUNT.id) ? list : [DEV_ACCOUNT, ...list]
}
export const writeDevAccounts = (list: DevAccount[]) => device.set(['devAccounts'], JSON.stringify(list))
export const publicOf = ({password: _password, ...account}: DevAccount): SessionAccount => account
const find = (list: DevAccount[], c: Contact) => list.find(a => (c.kind === 'email' ? a.email : a.phone) === c.value)

const codes = new Map<string, string>()
/** Verification tokens (`verifyCode`): token -> the contact it proves and when it stops working. One use. */
const tokens = new Map<string, {key: string; expires: number}>()
const TOKEN_MS = 10 * 60_000
const keyOf = (c: Contact) => `${c.kind}:${c.value}`

function online() {
  if (isOffline()) throw new AuthError('offline')
}

function takeToken(token: string, c: Contact) {
  const found = tokens.get(token)
  tokens.delete(token)
  if (!found || found.key !== keyOf(c) || found.expires < Date.now()) throw new AuthError('bad-token')
}

function checkCode(c: Contact, code: string) {
  if (!isSignInCode(code) || codes.get(keyOf(c)) !== code.trim()) throw new AuthError('bad-code')
}

export const devAuthClient: AuthClient = {
  async lookup(contact) {
    online()
    const account = find(readDevAccounts(), contact)
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
    codes.delete(keyOf(contact))
    const token = `devtoken-${randomUUID()}`
    tokens.set(token, {key: keyOf(contact), expires: Date.now() + TOKEN_MS})
    return {token}
  },
  async signInWithPassword(contact, password) {
    online()
    const account = find(readDevAccounts(), contact)
    if (!account?.password || account.password !== password) throw new AuthError('bad-password')
    return publicOf(account)
  },
  async signInWithCode(contact, code) {
    online()
    checkCode(contact, code)
    const account = find(readDevAccounts(), contact)
    if (!account) throw new AuthError('no-account')
    codes.delete(keyOf(contact))
    return publicOf(account)
  },
  async createAccount(input: NewAccount) {
    online()
    const list = readDevAccounts()
    if (find(list, {kind: 'email', value: input.email}) || find(list, {kind: 'phone', value: input.phone})) throw new AuthError('taken')
    if (!isPasswordLongEnough(input.password)) throw new AuthError('bad-password')
    takeToken(input.emailToken, {kind: 'email', value: input.email})
    takeToken(input.phoneToken, {kind: 'phone', value: input.phone})
    const account: DevAccount = {id: randomUUID(), name: input.name.trim(), email: input.email, phone: input.phone, password: input.password}
    writeDevAccounts([...list, account])
    return publicOf(account)
  },
  async resetPassword(contact, code, password) {
    online()
    checkCode(contact, code)
    const list = readDevAccounts()
    const account = find(list, contact)
    if (!account) throw new AuthError('no-account')
    if (!isPasswordLongEnough(password)) throw new AuthError('bad-password')
    account.password = password
    writeDevAccounts(list)
    codes.delete(keyOf(contact))
  },
  async addContact(session, contact, token) {
    online()
    const list = readDevAccounts()
    if (find(list, contact)) throw new AuthError('taken')
    const account = list.find(a => a.id === session.id)
    if (!account) throw new AuthError('no-account')
    takeToken(token, contact)
    account[contact.kind === 'email' ? 'email' : 'phone'] = contact.value
    writeDevAccounts(list)
    return publicOf(account)
  },
}
