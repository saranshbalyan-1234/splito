import {randomUUID} from 'expo-crypto'
import {createPerson, ensureMe} from '@splito/sync'

import {device} from '#/storage'
import {openStore} from '#/data/store'
import {LEGACY_STORE} from '#/data/storeNames'

/**
 * E2E builds only: `window.__splitoTest.seedLegacy(['Asha'])` writes friends into the pre-account database, as an
 * older build would have left it, so the "Move this device's data" offer (F-2104) can be tested from a signed-out start.
 */
export function installLegacyTestHook() {
  if (typeof window === 'undefined') return
  const w = window as unknown as {__splitoTest?: Record<string, unknown>}
  w.__splitoTest = {
    ...w.__splitoTest,
    seedLegacy: async (names: string[]) => {
      let actor = device.get(['meId'])
      if (!actor) device.set(['meId'], (actor = randomUUID()))
      const ctx = {deviceId: 'legacy', actor, now: () => Date.now(), newId: () => randomUUID()}
      const store = await openStore(undefined, LEGACY_STORE)
      try {
        await ensureMe(store, ctx, 'Me')
        for (const name of names) await createPerson(store, ctx, {name})
      } finally {
        await store.close()
      }
    },
  }
}
