import {recordFriction} from '#/logger'
import {IS_WEB} from '#/env'
import {navigationRef, resetToRoot} from '#/navigation/ref'
import {openSheetMarkers, ownerOf, queueSheets} from '#/navigation/sheets'
import {originTab, tabLink} from '#/lib/routes/helpers'
import {TAB_NAMES} from '#/lib/routes/tabs'
import {StackActions} from '@react-navigation/native'
import {holdLinkIntent, isSignInRequired} from './intent'
import {holdForDemoSwitch} from './gate'
import {buildPath, type LinkTarget, resolveLink, touchesRealData} from './resolve'
import {isGlobalSheet} from './table'

export type OpenResult = 'opened' | 'unknown' | 'held-for-sign-in' | 'held-for-demo' | 'checking' | 'not-ready'

/** What `openLink` knows about the app: demo mode, and (in demo mode) how to ask whether the demo store holds what a link names. */
export type OpenOptions = {isDemo?: boolean; isInStore?: (target: LinkTarget) => Promise<boolean>}

/**
 * Takes the navigator to a link's screen from inside the app: one function behind push taps, reminders, invite
 * and QR links, shares, Ask answers and Search results (F-254). Cold starts and the browser's address bar go
 * through the same resolver in `navigation/linking`. A link only navigates; it never performs an action.
 *
 * A main screen (Home, People, Groups, Analytics, Activity) named by a link opens as a pushed copy with Back, never
 * as the plain tab (owner 179, `tabLink`); `plain` keeps the plain tab for what is no real link (an unknown address
 * falling back to Home) and a global sheet that only needs a page under it.
 */
export function navigateToTarget(target: LinkTarget, {plain = false}: {plain?: boolean} = {}): boolean {
  if (!navigationRef.isReady()) return false
  const go = navigationRef.navigate as (name: string, params?: object) => void
  const isTab = (TAB_NAMES as readonly string[]).includes(target.name)
  const params = Object.keys(target.params).length > 0 ? target.params : undefined
  const pushed = isTab && !plain && !(target.name === 'Home' && isGlobalSheet(target.sheets)) ? tabLink(target.name, params, IS_WEB, originTab(navigationRef.getRootState())) : null
  const open = () => {
    if (pushed) navigationRef.dispatch(StackActions.push(pushed.name, pushed.params))
    else if (IS_WEB) go(target.name, params)
    else if (isTab) go('Tabs', {screen: target.name, params})
    else go(target.name, params)
  }
  if (IS_WEB) {
    /* Search & Ask belongs to no page: it opens over the one now showing. Every other link names its page. */
    if (target.sheets[0] !== 'search') open()
    if (target.sheets.length > 0) {
      openSheetMarkers(isGlobalSheet(target.sheets) ? null : ownerOf({name: target.name, params: target.params}), target.sheets, target.query)
    }
    return true
  }
  queueSheets(target)
  if (target.sheets[0] !== 'search') open()
  return true
}

/**
 * Opens a link or path. `isDemo` says demo mode is on: a link to real data then waits for the person to switch
 * back (the prompt is `LinkGate`). Signed out (F-250) it is held and resumed after sign-in.
 */
export function openLink(input: string, options: OpenOptions = {}): OpenResult {
  const {isKnown, target} = resolveLink(input)
  if (!isKnown) recordFriction('dead_link')
  const path = buildPath(target)
  if (isSignInRequired()) {
    holdLinkIntent(path)
    return 'held-for-sign-in'
  }
  if (options.isDemo && touchesRealData(target)) {
    /* Something the demo store holds (its own friend, a reload of its own expense) opens as it is; anything else is real data. */
    if (options.isInStore) {
      void options.isInStore(target).then(found => (found ? navigateToTarget(target, {plain: !isKnown}) : holdForDemoSwitch(path)))
      return 'checking'
    }
    holdForDemoSwitch(path)
    return 'held-for-demo'
  }
  if (!navigateToTarget(target, {plain: !isKnown})) return 'not-ready'
  return isKnown ? 'opened' : 'unknown'
}

/** `openLink`, retried until the navigator exists: a notification tap can arrive before the first screen. */
export function openLinkWhenReady(input: string, options: OpenOptions = {}, tries = 0) {
  if (openLink(input, options) === 'not-ready' && tries < 40) setTimeout(() => openLinkWhenReady(input, options, tries + 1), 250)
}

/**
 * The address a web page was loaded with is shown by the navigator before the app knows its mode; this checks it
 * once it does (F-254): a dead link is friction, and a link to real data in demo mode, or any link while signed
 * out, is held and the page falls back to Home, so the question or the sign-in comes first.
 */
export function checkInitialLink(path: string, options: OpenOptions) {
  const {isKnown, target} = resolveLink(path)
  if (!isKnown) {
    recordFriction('dead_link')
    return
  }
  const held = buildPath(target)
  const fallBack = () => whenReady(resetToRoot)
  if (isSignInRequired()) {
    holdLinkIntent(held)
    fallBack()
  } else if (options.isDemo && touchesRealData(target)) {
    const hold = () => {
      holdForDemoSwitch(held)
      fallBack()
    }
    if (options.isInStore) void options.isInStore(target).then(found => !found && hold())
    else hold()
  }
}

/** Runs `fn` once the navigator exists (a link can arrive before the first screen). */
export function whenReady(fn: () => void, tries = 0) {
  if (navigationRef.isReady()) fn()
  else if (tries < 40) setTimeout(() => whenReady(fn, tries + 1), 250)
}
