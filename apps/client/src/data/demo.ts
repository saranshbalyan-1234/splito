import {type MutationCtx, type Store} from '@splito/sync'

import {device} from '#/storage'
import {seedDemoData} from '#/data/demoSeed'
import {IS_DEV, IS_E2E} from '#/env'

/**
 * The demo set this load asked for: `?demo=1` / `?demo=large` on web,
 * `EXPO_PUBLIC_DEMO=1` / `large` for native dev builds; null for none.
 */
function demoRequested(): '1' | 'large' | null {
  const env = process.env.EXPO_PUBLIC_DEMO
  if (env === '1' || env === 'large') return env
  if (typeof window === 'undefined' || !window.location?.search) return null
  const q = new URLSearchParams(window.location.search).get('demo')
  return q === '1' || q === 'large' ? q : null
}

/**
 * Demo mode: a dev or e2e build opened with `?demo=1` (now or earlier on this
 * install). It seeds the demo data and swaps in the demo directory; production
 * builds are never in demo mode (the env check is first).
 */
export const IS_DEMO =
  (IS_DEV || IS_E2E) && (demoRequested() !== null || device.get(['demoMode']) === true)
if (IS_DEMO) device.set(['demoMode'], true)

/**
 * `EXPO_PUBLIC_DEMO_AUTO=large` (preview builds): load the large set when the
 * device holds nothing but "me", so a fresh browser opens on populated screens.
 */
async function isAutoLarge(store: Store, ctx: MutationCtx) {
  if (process.env.EXPO_PUBLIC_DEMO_AUTO !== 'large') return false
  const [people, groups, expenses] = await Promise.all([
    store.getAll('person'),
    store.count('group'),
    store.count('expense'),
  ])
  return people.every(p => p.id === ctx.actor) && groups === 0 && expenses === 0
}

/**
 * Dev and E2E builds only: with `?demo=large` (or the preview auto flag),
 * adds the large set (`demoLarge.ts`). With `?demo=1`, seeds the demo friends, groups and
 * expenses through the real mutations, once per local store. Production builds
 * never seed (the env check is first, so the URL is never read there).
 */
export async function seedDemoIfRequested(store: Store, ctx: MutationCtx) {
  if (!(IS_DEV || IS_E2E)) return
  const requested = demoRequested()
  if (
    requested === 'large' ||
    (!requested && (await isAutoLarge(store, ctx)))
  ) {
    // A year of data: written in the background with a progress toast, so the app opens at once.
    // The condition is spelled out so Metro folds it: a production bundle has no demo chunk.
    if (__DEV__ || process.env.EXPO_PUBLIC_ENV === 'e2e')
      void import('#/screens/Settings/DemoData').then(m =>
        m.runLargeDemo(store, ctx, 'add'),
      )
    return
  }
  // `?demo=1` marks the seed owed until it has finished, so a page left before then (a quick
  // navigation, a reload) is finished by the next load rather than left half-seeded.
  if (requested === '1') device.set(['demoPending'], true)
  if (!device.get(['demoPending'])) return
  // One run per page load, even if the store opens twice (dev remounts).
  seeding ??= seedDemoData(store, ctx).then(() => device.set(['demoPending'], false))
  return seeding
}

let seeding: Promise<void> | undefined
