import {recordFriction} from '#/logger'
import {IS_WEB} from '#/env'
import {navigationRef, resetToRoot} from '#/navigation/ref'
import {openSheetMarkers, ownerOf, queueSheets} from '#/navigation/sheets'
import {TAB_NAMES} from '#/lib/routes/tabs'
import {holdLinkIntent, isSignInRequired} from './intent'
import {holdForDemoSwitch} from './gate'
import {buildPath, type LinkTarget, resolveLink, touchesRealData} from './resolve'
import {isGlobalSheet} from './table'

export type OpenResult = 'opened' | 'unknown' | 'held-for-sign-in' | 'held-for-demo' | 'not-ready'

/**
 * Takes the navigator to a link's screen from inside the app: one function behind push taps, reminders, invite
 * and QR links, shares, Ask answers and Search results (F-254). Cold starts and the browser's address bar go
 * through the same resolver in `navigation/linking`. A link only navigates; it never performs an action.
 */
export function navigateToTarget(target: LinkTarget): boolean {
  if (!navigationRef.isReady()) return false
  const go = navigationRef.navigate as (name: string, params?: object) => void
  const isTab = (TAB_NAMES as readonly string[]).includes(target.name)
  const params = Object.keys(target.params).length > 0 ? target.params : undefined
  if (IS_WEB) {
    /* Search & Ask belongs to no page: it opens over the one now showing. Every other link names its page. */
    if (target.sheets[0] !== 'search') go(target.name, params)
    if (target.sheets.length > 0) {
      openSheetMarkers(isGlobalSheet(target.sheets) ? null : ownerOf({name: target.name, params: target.params}), target.sheets, target.query)
    }
    return true
  }
  queueSheets(target)
  if (target.sheets[0] !== 'search') {
    if (isTab) go('Tabs', {screen: target.name, params})
    else go(target.name, params)
  }
  return true
}

/**
 * Opens a link or path. `isDemo` says demo mode is on: a link to real data then waits for the person to switch
 * back (the prompt is `LinkGate`). Signed out (F-250) it is held and resumed after sign-in.
 */
export function openLink(input: string, options: {isDemo?: boolean} = {}): OpenResult {
  const {isKnown, target} = resolveLink(input)
  if (!isKnown) recordFriction('dead_link')
  const path = buildPath(target)
  if (isSignInRequired()) {
    holdLinkIntent(path)
    return 'held-for-sign-in'
  }
  if (options.isDemo && touchesRealData(target)) {
    holdForDemoSwitch(path)
    return 'held-for-demo'
  }
  if (!navigateToTarget(target)) return 'not-ready'
  return isKnown ? 'opened' : 'unknown'
}

/** `openLink`, retried until the navigator exists: a notification tap can arrive before the first screen. */
export function openLinkWhenReady(input: string, options: {isDemo?: boolean} = {}, tries = 0) {
  if (openLink(input, options) === 'not-ready' && tries < 40) setTimeout(() => openLinkWhenReady(input, options, tries + 1), 250)
}

/**
 * The address a web page was loaded with is shown by the navigator before the app knows its mode; this checks it
 * once it does (F-254): a dead link is friction, and a link to real data in demo mode, or any link while signed
 * out, is held and the page falls back to Home, so the question or the sign-in comes first.
 */
export function checkInitialLink(path: string, options: {isDemo: boolean}) {
  const {isKnown, target} = resolveLink(path)
  if (!isKnown) {
    recordFriction('dead_link')
    return
  }
  const held = buildPath(target)
  if (isSignInRequired()) holdLinkIntent(held)
  else if (options.isDemo && touchesRealData(target)) holdForDemoSwitch(held)
  else return
  whenReady(resetToRoot)
}

/** Runs `fn` once the navigator exists (a link can arrive before the first screen). */
export function whenReady(fn: () => void, tries = 0) {
  if (navigationRef.isReady()) fn()
  else if (tries < 40) setTimeout(() => whenReady(fn, tries + 1), 250)
}
