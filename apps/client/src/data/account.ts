import {useEffect, useState, useSyncExternalStore} from 'react'
import {applyBackup, createBackup, type MutationCtx, type Store} from '@splito/sync'

import {type AppLanguage, i18n} from '#/locale/i18n'
import {logger} from '#/logger'
import {sessionApi} from '#/state/session'
import {accountScope, clearStorageScope, device} from '#/storage'
import {expectStoreClosed, useData} from '#/data/StoreProvider'
import {deleteStore, openStore, storeExists} from '#/data/store'
import {accountStoreName, LEGACY_STORE} from '#/data/storeNames'

/** Deleting a database can be refused while a connection is still ending; a few tries, then the failure is the caller's to show. */
async function deleteWithRetry(name: string) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await deleteStore(name)
    } catch (e) {
      if (attempt === 3) throw e
      await new Promise(resolve => setTimeout(resolve, 300 * attempt))
    }
  }
}

/** The data caches of the service worker (never the app shell's precache): copies of an account's data do not outlive it. Web only. */
async function clearDataCaches() {
  if (typeof caches === 'undefined') return
  for (const name of await caches.keys()) if (!name.startsWith('splito-precache-')) await caches.delete(name)
}

/** The device's choices that outlive an account (owner 186): the language in use and the theme, copied out of the account's own keys. */
function readDeviceChoices() {
  return {
    language: i18n.locale as AppLanguage,
    colorMode: device.get(['colorMode']),
    darkTheme: device.get(['darkTheme']),
    accent: device.get(['accent']),
  }
}
function keepDeviceChoices(c: ReturnType<typeof readDeviceChoices>) {
  device.set(['deviceLanguage'], c.language)
  if (c.colorMode) device.set(['colorMode'], c.colorMode)
  if (c.darkTheme) device.set(['darkTheme'], c.darkTheme)
  if (c.accent) device.set(['accent'], c.accent)
}

/**
 * Everything an account left on this device (owner 186), once its store is closed: its database (every store, outbox,
 * history), its demo database and demo-scoped keys, its account-scoped keys (drafts, search history, first-frame preference
 * copies), its "me" id and the service worker's data caches. Each step is safe to repeat, so a retry after a failure
 * finishes the job instead of leaving a half-erased state.
 */
async function eraseAccountData(accountId: string) {
  await deleteWithRetry(accountStoreName(accountId))
  await (await import('#/data/demoMode')).eraseDemo(accountId)
  clearStorageScope(accountScope(accountId))
  const ids = JSON.parse(device.get(['meIds']) ?? '{}') as Record<string, string>
  if (accountId in ids) {
    delete ids[accountId]
    device.set(['meIds'], JSON.stringify(ids))
  }
  await clearDataCaches()
}

type LogoutPhase = 'running' | 'failed'
let phase: LogoutPhase = 'running'
let isRunning = false
const phaseListeners = new Set<() => void>()
function setPhase(next: LogoutPhase) {
  phase = next
  phaseListeners.forEach(l => l())
}

/** The last step is the only one that signs out: until the erase has finished the account stays "logging out", and a restart resumes it. */
async function finishLogOut(accountId: string, closed: Promise<void>) {
  isRunning = true
  setPhase('running')
  try {
    await closed
    const choices = readDeviceChoices()
    await eraseAccountData(accountId)
    // The account's own keys are gone and the session ends; the device's language and theme stay.
    sessionApi.signOut()
    keepDeviceChoices(choices)
    // Web: the address belonged to this account's session; the next sign-in starts at Home.
    if (typeof window !== 'undefined') window.history?.replaceState(window.history.state, '', '/')
  } catch (e) {
    logger.error(e, {where: 'logOut'})
    setPhase('failed')
  } finally {
    isRunning = false
  }
}

/**
 * Log out (owner 186): erases everything the account left on this device, then shows the logged-out flow. The store is
 * closed first (`expectStoreClosed` is armed before the "logging out" screen unmounts `StoreProvider`; it settles when every
 * connection has really closed), then the data is deleted. A failure shows on the "Logging out" screen with Retry (`retryLogOut`);
 * the session is not ended until the erase has finished.
 */
export function logOut(accountId: string) {
  const closed = expectStoreClosed(accountId)
  sessionApi.beginLogout()
  return finishLogOut(accountId, closed)
}

/** Retry after a failure, or resume after a restart in the middle of a log out. */
export function retryLogOut(accountId: string) {
  if (isRunning) return
  void finishLogOut(accountId, expectStoreClosed(accountId))
}

/** Whether the erase of a log out is running or has failed (the "Logging out" screen). */
export function useLogoutPhase(): LogoutPhase {
  return useSyncExternalStore(
    l => (phaseListeners.add(l), () => void phaseListeners.delete(l)),
    () => phase,
  )
}

/**
 * How many changes of the open store have not reached a server: rows still pending, syncing or refused, counted from
 * the sync-status index (a count query; the outbox is never loaded). Undefined until it is known.
 */
export function useUnsyncedCount(): number | undefined {
  const {store} = useData()
  const [count, setCount] = useState<number>()
  useEffect(() => {
    let isCurrent = true
    void store.syncCounts().then(counts => {
      if (!isCurrent) return
      let n = 0
      for (const byStatus of Object.values(counts)) n += (byStatus?.pending ?? 0) + (byStatus?.syncing ?? 0) + (byStatus?.failed ?? 0)
      setCount(n)
    })
    return () => {
      isCurrent = false
    }
  }, [store])
  return count
}

/* ---------------------------------------------------------------------------------------------------------------- */
/* Data from before accounts (F-250, F-2104)                                                                        */
/* ---------------------------------------------------------------------------------------------------------------- */

const legacyListeners = new Set<() => void>()
const emitLegacy = () => legacyListeners.forEach(l => l())

/** Whether the pre-account database exists on this device (the Settings > Data row shows while it does). */
export function useHasLegacyStore(): boolean {
  const [has, setHas] = useState(false)
  useEffect(() => {
    let isCurrent = true
    const look = () => void storeExists(LEGACY_STORE).then(found => isCurrent && setHas(found))
    look()
    legacyListeners.add(look)
    return () => {
      isCurrent = false
      legacyListeners.delete(look)
    }
  }, [])
  return has
}

/** Whether the pre-account database holds anything the person made (more than the "me" row). */
export async function hasLegacyData(): Promise<boolean> {
  if (!(await storeExists(LEGACY_STORE))) return false
  const legacy = await openStore(undefined, LEGACY_STORE)
  try {
    const counts = await Promise.all([legacy.count('expense'), legacy.count('group'), legacy.count('repayment'), legacy.count('person')])
    return counts[0] + counts[1] + counts[2] > 0 || counts[3] > 1
  } finally {
    await legacy.close()
  }
}

/** The one-time offer was answered (Move, Not now, or there is no old database); it is not made again on its own. */
export const isLegacyAnswered = () => device.get(['legacyOffered']) === true
export function markLegacyAnswered() {
  device.set(['legacyOffered'], true)
}

/**
 * "Move this device's data into your account" (F-2104): the old database is copied into the account's through the
 * backup path (the same checks as Settings > Import; rows of another "me" are re-pointed at this account's), then deleted.
 * It never runs on its own: the person taps Move.
 */
export async function moveLegacyData(store: Store, ctx: MutationCtx) {
  const legacy = await openStore(undefined, LEGACY_STORE)
  try {
    await applyBackup(store, ctx, await createBackup(legacy, ctx), 'merge')
  } finally {
    await legacy.close()
  }
  await deleteStore(LEGACY_STORE)
  markLegacyAnswered()
  emitLegacy()
}

/** The Move action for the open account's store (the offer in `features/account/LegacyDataOffer`). */
export function useMoveLegacyData() {
  const {store, ctx} = useData()
  return () => moveLegacyData(store, ctx)
}
