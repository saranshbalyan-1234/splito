import {perfMark} from '#/lib/perfMark'
import {syncNow} from '#/lib/sync/syncNow'

/** The spinner stays at least this long, so a refresh that finds nothing does not flash. */
export const MIN_SPINNER_MS = 400
/** And never longer than this, whatever the network does: a refresh must not hold the screen. */
const MAX_WAIT_MS = 3000

const wait = (ms: number) => new Promise<void>(done => setTimeout(done, ms))

/**
 * What pulling a screen down does (owners 167, 169, 170; simplest, owners 212, 213): kick `syncNow()` and hold the
 * spinner for at least `MIN_SPINNER_MS`. Nothing is re-read here: every projection already re-reads on each commit
 * (A-016), so the screen is current, and re-running them would redraw every parked tab for nothing. Offline it ends at
 * once (ARCHITECTURE 9.3), no minimum, no error. It never rejects and never blocks the screen: the person can keep
 * scrolling and tapping while it runs.
 */
export async function refreshAll(): Promise<void> {
  perfMark('refresh:start')
  // `navigator.onLine` is undefined on React Native, where the sync engine will ask the network state itself.
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false
  const work = syncNow().catch(() => {})
  await Promise.all([Promise.race([work, wait(MAX_WAIT_MS)]), offline ? undefined : wait(MIN_SPINNER_MS)])
  perfMark('refresh:end', {offline})
}
