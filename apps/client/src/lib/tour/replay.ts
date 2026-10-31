import {navigateToTarget} from '#/lib/links/open'
import {resolveLink} from '#/lib/links/resolve'
import {navigationRef} from '#/navigation/ref'
import {requestTour} from './registry'

const openPeople = () => navigateToTarget(resolveLink('/people').target, {plain: true})

/**
 * "Take the tour" (Settings > Support > Help): asks the one `TourHost` to run, and takes the app to the plain People tab,
 * where the tour starts (a link would open a pushed copy with Back instead, owner 179).
 */
export function replayTour() {
  requestTour()
  openPeople()
}

/**
 * The first-run tour lives on People. Until Home is removed (F-271, owner 198) the app still opens on Home, so a tour
 * that is due moves from Home to People once; from any other page it waits for the person to get there.
 * Returns false while the navigator is not ready yet (try again), true when there is nothing more to do.
 */
// ponytail: delete the Home case with F-271, when People is the start tab.
export function openPeopleFromHome(): boolean {
  if (!navigationRef.isReady()) return false
  if (navigationRef.getCurrentRoute()?.name === 'Home') openPeople()
  return true
}
