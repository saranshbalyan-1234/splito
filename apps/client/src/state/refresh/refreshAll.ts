import {type Store} from '@splito/sync'

import {perfMark} from '#/lib/perfMark'
import {syncNow} from '#/lib/sync/syncNow'
import {refreshProjections} from '#/data/projections'

/** The spinner stays at least this long, so a refresh that finds nothing does not flash. */
export const MIN_SPINNER_MS = 400
/** And never longer than this, whatever the network does: a refresh must not hold the screen. */
const MAX_WAIT_MS = 3000

const wait = (ms: number) => new Promise<void>(done => setTimeout(done, ms))

/**
 * What pulling a screen down does (owners 167, 169, 170): re-read the local queries of the mounted screens and kick a
 * sync attempt, both at once, for at least `MIN_SPINNER_MS`. It never rejects and never blocks the screen: the person
 * can keep scrolling and tapping while it runs. `store` is null signed out, where there is nothing to re-read.
 */
export async function refreshAll(store: Store | null): Promise<void> {
  perfMark('refresh:start')
  let reloaded = 0
  const work = Promise.allSettled([store ? refreshProjections(store).then(n => (reloaded = n)) : undefined, syncNow()])
  await Promise.all([Promise.race([work, wait(MAX_WAIT_MS)]), wait(MIN_SPINNER_MS)])
  perfMark('refresh:end', {reloaded})
}
