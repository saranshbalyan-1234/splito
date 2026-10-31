import {navigateToTarget} from '#/lib/links/open'
import {resolveLink} from '#/lib/links/resolve'
import {requestTour} from './registry'

const openPeople = () => navigateToTarget(resolveLink('/people').target, {plain: true})

/**
 * "Take the tour" (Settings > Support): asks the one `TourHost` to run, and takes the app to the plain People tab,
 * where the tour starts (a link would open a pushed copy with Back instead, owner 179).
 */
export function replayTour() {
  requestTour()
  openPeople()
}
