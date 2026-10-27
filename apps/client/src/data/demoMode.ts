/**
 * Demo mode (ARCHITECTURE 26.1, F-228a): the app can run on a second, separate
 * local database (`splito-demo`: its own IndexedDB database / SQLite file)
 * holding the one demo dataset. It has its own preferences, history and outbox,
 * and nothing it does reaches the real database or any sync queue. The real
 * database's only footprint is one device preference row, `demo.mode`
 * (`demoSeed.ts`, with the seeding itself).
 *
 * Dev and e2e builds only: this module, the data behind it and the UI over it
 * are reached only through `import()` behind
 * `__DEV__ || EXPO_PUBLIC_ENV === 'e2e'` (the `demoStaticImport` rule), so a
 * production bundle holds none of it.
 */
import {randomUUID} from 'expo-crypto'
import {demoDirectory, ensureMe, type MutationCtx, type StorageNotices, type Store} from '@splito/sync'

import {DEMO_DIRECTORY, DEMO_ME, seedDemo, wipeDemo} from '#/data/demoSeed'
import {setDirectory} from '#/data/friends'
import {openStore} from '#/data/store'
import {IS_E2E} from '#/env'
import {setStorageScope} from '#/storage'

export {readDemoMode, writeDemoMode} from '#/data/demoSeed'

/** The demo database's name (IndexedDB database, or the SQLite file `splito-demo.db`). */
export const DEMO_STORE = 'splito-demo'

export function demoCtx(real: MutationCtx): MutationCtx {
  return {deviceId: real.deviceId, actor: DEMO_ME, now: () => Date.now(), newId: () => randomUUID()}
}

export type Opened = {store: Store; ctx: MutationCtx}

/**
 * Opens the demo database, ensures its own "me" and seeds it when empty (or
 * after `fresh`, a reset). Installs the demo directory (who is on Splito).
 * Closes the store again if anything fails.
 */
export async function openDemo(real: MutationCtx, notices?: StorageNotices, onProgress?: (done: number) => void, existing?: Store, fresh = false): Promise<Opened> {
  const store = existing ?? (await openStore(notices, DEMO_STORE))
  const ctx = demoCtx(real)
  try {
    if (fresh) await wipeDemo(store)
    await ensureMe(store, ctx, 'Me')
    await seedDemo(store, ctx, onProgress)
    setDirectory(demoDirectory(DEMO_DIRECTORY))
    // Search history, read marks and drafts typed here stay here.
    setStorageScope('demo:')
    return {store, ctx}
  } catch (e) {
    if (!existing) await store.close()
    throw e
  }
}

/* -------------------------------------------------------------------------- */
/* E2E hook                                                                   */
/* -------------------------------------------------------------------------- */

type TestHooks = {demoMode?: (on: boolean) => Promise<void>}

/** E2E builds only: `window.__splitoTest.demoMode(true | false)` runs the same switch as Settings > Data. */
export function installTestHook(setDemo: (on: boolean) => Promise<void>) {
  if (!IS_E2E || typeof window === 'undefined') return
  const w = window as unknown as {__splitoTest?: TestHooks}
  w.__splitoTest = {...w.__splitoTest, demoMode: setDemo}
}
