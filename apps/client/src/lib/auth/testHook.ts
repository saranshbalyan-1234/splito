import {randomUUID} from 'expo-crypto'

import {type SessionApi} from '#/state/session'
import {device} from '#/storage'
import {DEV_ACCOUNT, publicOf, readDevAccounts, writeDevAccounts} from './dev'

/**
 * E2E builds only (`state/session.ts` imports this behind `EXPO_PUBLIC_ENV === 'e2e'`, so the preview export holds none
 * of it): `window.__splitoTest.signIn()` signs in the dev account (and marks the intro seen, which e2e runs never show), so
 * every spec starts inside the app; `signOut()` ends the session; `seedAccount()` adds a local account (an older
 * email-only one, say) to sign in to through the real screens.
 */
export function installAuthTestHook(api: SessionApi) {
  if (typeof window === 'undefined') return
  const w = window as unknown as {__splitoTest?: Record<string, unknown>}
  w.__splitoTest = {
    ...w.__splitoTest,
    signIn: () => {
      device.set(['tourSeen'], true)
      writeDevAccounts(readDevAccounts())
      api.signIn(publicOf(DEV_ACCOUNT))
    },
    signOut: () => api.signOut(),
    seedAccount: (account: {name: string; email?: string; phone?: string; password?: string}) => writeDevAccounts([...readDevAccounts(), {...account, id: randomUUID()}]),
  }
}
