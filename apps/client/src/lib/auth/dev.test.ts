import {expect, mock, test} from 'bun:test'

;(globalThis as {__DEV__?: boolean}).__DEV__ = false

/* MMKV is native; a Map stands in for it (the dev client keeps its accounts in device storage). */
mock.module('react-native-mmkv', () => ({
  MMKV: class {
    m = new Map<string, string>()
    set(k: string, v: string) {
      this.m.set(k, v)
    }
    getString(k: string) {
      return this.m.get(k)
    }
    delete(k: string) {
      this.m.delete(k)
    }
    getAllKeys() {
      return [...this.m.keys()]
    }
    clearAll() {
      this.m.clear()
    }
    addOnValueChangedListener() {
      return {remove() {}}
    }
  },
}))
mock.module('expo-crypto', () => ({randomUUID: () => crypto.randomUUID()}))

const {devAuthClient} = await import('./dev')
const {currentDevCode} = await import('./devCodes')
const {AuthError} = await import('./types')

/* The contract F-2101 implements: verifyCode answers a one-use token, and the account calls take tokens, never codes. */
const email = {kind: 'email', value: 'tokens@example.com'} as const
const phone = {kind: 'phone', value: '+919876500555'} as const

async function verified(contact: typeof email | typeof phone) {
  await devAuthClient.sendCode(contact, 'signup')
  return (await devAuthClient.verifyCode(contact, currentDevCode()!.code, 'signup')).token
}

async function codeOf(promise: Promise<unknown>) {
  try {
    await promise
  } catch (e) {
    return e instanceof AuthError ? e.code : 'other'
  }
  return 'ok'
}

const account = (emailToken: string, phoneToken: string) => ({name: 'Tok', password: 'longpassword1', email: email.value, emailToken, phone: phone.value, phoneToken})

test('a made-up token, a token for the other contact and a reused token are refused; the right two make the account', async () => {
  expect(await codeOf(devAuthClient.createAccount(account('nope', 'nope')))).toBe('bad-token')
  const [e, p] = [await verified(email), await verified(phone)]
  expect(await codeOf(devAuthClient.createAccount(account(p, e)))).toBe('bad-token')
  // Both tokens were spent by that refusal: they cannot be tried again.
  expect(await codeOf(devAuthClient.createAccount(account(e, p)))).toBe('bad-token')
  const [e2, p2] = [await verified(email), await verified(phone)]
  expect(await codeOf(devAuthClient.createAccount(account(e2, p2)))).toBe('ok')
  expect((await devAuthClient.lookup(email)).exists).toBe(true)
})

test('a code verifies once: it is spent by verifyCode', async () => {
  await devAuthClient.sendCode({kind: 'email', value: 'once@example.com'}, 'signup')
  const code = currentDevCode()!.code
  expect(await codeOf(devAuthClient.verifyCode({kind: 'email', value: 'once@example.com'}, code, 'signup'))).toBe('ok')
  expect(await codeOf(devAuthClient.verifyCode({kind: 'email', value: 'once@example.com'}, code, 'signup'))).toBe('bad-code')
})
