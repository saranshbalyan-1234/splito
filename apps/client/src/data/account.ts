import {useEffect, useState} from 'react'
import {applyBackup, createBackup, type MutationCtx, sendableOps, type Store} from '@splito/sync'

import {sessionApi} from '#/state/session'
import {accountScope, clearStorageScope, device} from '#/storage'
import {useData, whenStoreClosed} from '#/data/StoreProvider'
import {deleteStore, openStore, storeExists} from '#/data/store'
import {accountStoreName, LEGACY_STORE} from '#/data/storeNames'

/**
 * Log out: the session ends first, which unmounts `StoreProvider` and closes the account's database; "erase" then
 * deletes that database and the account's device keys once it is closed. "Keep" leaves both for the next sign-in.
 * Unsynced changes are warned about in the prompt (`useUnsyncedCount`), never dropped silently.
 */
export async function logOut(accountId: string, erase: boolean) {
  // Web: the address belonged to this account's session; the next sign-in starts at Home.
  if (typeof window !== 'undefined') window.history?.replaceState(window.history.state, '', '/')
  sessionApi.signOut()
  if (!erase) return
  await whenStoreClosed()
  clearStorageScope(accountScope(accountId))
  await deleteStore(accountStoreName(accountId))
  // The demo database belongs to whoever turned it on; this device's data goes with it.
  await (await import('#/data/demoMode')).eraseDemo().catch(() => {})
}

/** How many changes of the open store have not reached a server (all of them, until sync exists). Undefined while counting. */
export function useUnsyncedCount(): number | undefined {
  const {store} = useData()
  const [count, setCount] = useState<number>()
  useEffect(() => {
    let isCurrent = true
    void sendableOps(store).then(ops => isCurrent && setCount(ops.length))
    return () => {
      isCurrent = false
    }
  }, [store])
  return count
}

/** Whether the pre-account database holds anything the person made (more than the "me" row), and the offer was not answered yet. */
export async function hasLegacyData(): Promise<boolean> {
  if (device.get(['legacyOffered']) || !(await storeExists(LEGACY_STORE))) return false
  const legacy = await openStore(undefined, LEGACY_STORE)
  try {
    const counts = await Promise.all([legacy.count('expense'), legacy.count('group'), legacy.count('repayment'), legacy.count('person')])
    return counts[0] + counts[1] + counts[2] > 0 || counts[3] > 1
  } finally {
    await legacy.close()
  }
}

/** The offer was answered (moved or not now): it is never made again. */
export const markLegacyAnswered = () => device.set(['legacyOffered'], true)

/**
 * "Move this device's data into your account" (F-2104): the old database is copied into the account's through the
 * backup path (the same checks as Settings > Import, nothing merged silently into another account), then deleted.
 * It is never run on its own: the person taps Move.
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
}

/** The Move action for the open account's store (the offer in `features/account/LegacyDataOffer`). */
export function useMoveLegacyData() {
  const {store, ctx} = useData()
  return () => moveLegacyData(store, ctx)
}
