/**
 * Demo mode (ARCHITECTURE 26.1, F-228a): the app can run on a second, separate
 * local database (`splito-demo`: its own IndexedDB database / SQLite file)
 * holding the one demo dataset. It has its own preferences, history and outbox,
 * and nothing it does reaches the real database or any sync queue. The real
 * database's only footprint is one device preference row, `demo.mode`
 * (`demoSeed.ts`, with the seeding itself).
 *
 * Every build (owner 148): this module, the data behind it and the UI over it
 * are reached only through `import()` (the `demoStaticImport` rule), so the
 * start-up bundle holds none of it.
 */
import {randomUUID} from 'expo-crypto'
import {type DirectoryClient, demoDirectory, ensureMe, type MutationCtx, type StorageNotices, type Store} from '@splito/sync'

import {logger} from '#/logger'
import {DEMO_DIRECTORY, DEMO_ME, purgeLegacyDemo, resumeDemo as resume, seedDemo} from '#/data/demoSeed'
import {deleteStore, openStore} from '#/data/store'
import {IS_E2E} from '#/env'
import {clearStorageScope, device} from '#/storage'

export {readDemoMode, writeDemoMode} from '#/data/demoSeed'

/** The demo database's name (IndexedDB database, or the SQLite file `splito-demo.db`). */
export const DEMO_STORE = 'splito-demo'

export function demoCtx(real: MutationCtx): MutationCtx {
  return {deviceId: real.deviceId, actor: DEMO_ME, now: () => Date.now(), newId: () => randomUUID()}
}

/** An open demo database; `directory` says who is on Splito there. `StoreProvider` installs it (and the key scope) when it adopts the store, never earlier. */
export type Opened = {store: Store; ctx: MutationCtx; directory: DirectoryClient}

/** The prefix of the device-storage keys that belong to demo mode (see `setStorageScope`). */
export const DEMO_SCOPE = 'demo:'

/**
 * Opens the demo database, ensures its own "me" and seeds it when empty (always, after demo mode was turned off and
 * on again: turning it off erases it, `eraseDemo`). Touches nothing global: the directory and the key scope switch
 * only when the store is adopted. Closes the store again if anything fails.
 */
export async function openDemo(real: MutationCtx, notices?: StorageNotices, onProgress?: (done: number) => void): Promise<Opened> {
  const store = await openStore(notices, DEMO_STORE)
  const ctx = demoCtx(real)
  try {
    await ensureMe(store, ctx, 'Me')
    await seedDemo(store, ctx, onProgress)
    return {store, ctx, directory: demoDirectory(DEMO_DIRECTORY)}
  } catch (e) {
    await store.close()
    throw e
  }
}

/**
 * Turning demo mode off erases everything demo mode kept (owner 136): the demo database itself, and every device key under
 * its scope (drafts, search history, read marks, Ask chat, the reminders bookkeeping). Call it once the real store is showing
 * and the demo connection is closed; turning it on again seeds a fresh dataset.
 */
export async function eraseDemo(): Promise<void> {
  clearStorageScope(DEMO_SCOPE)
  await deleteStore(DEMO_STORE)
}

/**
 * A start with the mode on. When the demo database cannot be opened, the failure is
 * logged, the real database is told the mode is off and null comes back: the app must
 * never be locked in a mode it cannot open.
 */
export function resumeDemo(real: {store: Store; ctx: MutationCtx}, notices?: StorageNotices): Promise<Opened | null> {
  return resume(real, () => openDemo(real.ctx, notices), e => logger.error(e, {where: 'demoMode.resume'}))
}

/** Dev and e2e, once per device: erases the `demo-large-` rows older builds wrote into the real database. */
export async function purgeLegacy(real: Store): Promise<void> {
  try {
    await purgeLegacyDemo(real, {isDone: () => device.get(['demoLegacyPurged']) === true, markDone: () => device.set(['demoLegacyPurged'], true)})
  } catch (e) {
    logger.error(e, {where: 'demoMode.purgeLegacy'})
  }
}

/* -------------------------------------------------------------------------- */
/* E2E hook                                                                   */
/* -------------------------------------------------------------------------- */

type TestHooks = {demoMode?: (on: boolean) => Promise<void>; externalUrls?: string[]; sharedTexts?: string[]}

/** E2E builds only: `window.__splitoTest.demoMode(true | false)` runs the same switch as Settings > Data. */
export function installTestHook(setDemo: (on: boolean) => Promise<void>) {
  if (!IS_E2E || typeof window === 'undefined') return
  const w = window as unknown as {__splitoTest?: TestHooks}
  // The recorded hand-offs (lib/openExternal.ts, owner 118) live on the same object.
  w.__splitoTest = {externalUrls: [], sharedTexts: [], ...w.__splitoTest, demoMode: setDemo}
}
