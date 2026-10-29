import {CommonActions, StackActions} from '@react-navigation/native'

import * as held from '#/lib/links/pending'
import {type LinkTarget} from '#/lib/links/resolve'
import {isGlobalSheet, isPageSheet} from '#/lib/links/table'
import {type SheetMarker} from '#/lib/routes/types'
import {IS_WEB} from '#/env'
import {navigationRef} from '#/navigation/ref'

/**
 * Sheets as URLs (ARCHITECTURE 26.3, F-241). On web a sheet is a `Sheet` marker route above its page in the one
 * flat stack, so opening pushes the URL, the browser's Back removes the marker and closes the sheet, and a
 * pasted URL arrives with the marker already there. A marker belongs to the page route directly under the run of
 * markers (its route key), so a second mounted copy of the same page (Group under Settle under Group) never opens
 * it too. On a phone there is no address bar and the native sheet has its own dismiss, so a sheet stays plain
 * dialog state; a link's sheet is held (`lib/links/pending`) until the dialog of its page opens.
 */

/** A page: its name, its path params, and (web) the key of its route, which is what a marker is matched by. */
export type Owner = {name: string; params: Record<string, string>; key?: string} | null

type Marker = {key: string; data: SheetMarker}
type Run = {markers: Marker[]; belowKey: string | undefined}

const listeners = new Set<() => void>()
let version = 0
function notify() {
  version++
  listeners.forEach(l => l())
}
export const subscribeSheets = (l: () => void) => {
  listeners.add(l)
  return () => void listeners.delete(l)
}
export const sheetsVersion = () => version

let isWatching = false
function watch() {
  if (isWatching) return
  isWatching = true
  navigationRef.addListener('state', () => {
    /* The page changed: a phone's held sheet for the page just left is dropped. */
    if (!IS_WEB && held.hasPending()) held.focusChanged(focusedPage())
    notify()
  })
}

/** The `Sheet` markers on top of the stack (web), oldest first, and the key of the route under them. */
export function markerRun(): Run {
  watch()
  if (!navigationRef.isReady()) return {markers: [], belowKey: undefined}
  const routes = navigationRef.getRootState()?.routes ?? []
  const markers: Marker[] = []
  let i = routes.length - 1
  for (; i >= 0 && routes[i]!.name === 'Sheet'; i--) markers.unshift({key: routes[i]!.key, data: routes[i]!.params as SheetMarker})
  return {markers, belowKey: routes[i]?.key}
}

export function sameChain(a: readonly string[], b: readonly string[]) {
  return a.length === b.length && a.every((s, i) => s === b[i])
}

function startsWith(chain: readonly string[], prefix: readonly string[]) {
  return prefix.every((s, i) => chain[i] === s)
}

/** A page's own params, as a marker keeps them: the path params only, so list state never splits a page in two. */
export function ownerOf(route: {name: string; params?: object; key?: string}): NonNullable<Owner> {
  const params = (route.params ?? {}) as Record<string, string | undefined>
  return {name: route.name, params: held.pickPathParams(route.name, params), ...(route.key ? {key: route.key} : {})}
}

/**
 * Whether `owner` is the page this run of markers sits on. By route key when the owner has one, so only the page
 * directly under the markers matches; a shell sheet (Search, the drawer) matches whatever page it covers.
 */
function ownsRun(owner: Owner, chain: readonly string[], run: Run, marker?: SheetMarker) {
  if (isGlobalSheet(chain)) return true
  if (owner === null) return false
  if (owner.key !== undefined) return owner.key === run.belowKey
  if (!marker) return false
  const page = ownerOf({name: marker.page, params: marker.pageParams})
  return page.name === owner.name && Object.entries(owner.params).every(([k, v]) => page.params[k] === v)
}

/** The marker that opens exactly this sheet over this owner, if the stack has one. */
export function markerFor(owner: Owner, chain: readonly string[]): SheetMarker | undefined {
  const run = markerRun()
  return run.markers.map(m => m.data).find(m => sameChain(m.sheets, chain) && ownsRun(owner, chain, run, m))
}

/** The route key of the page now showing under any markers (the one a new sheet would belong to). */
function topPageKey(): string | undefined {
  return markerRun().belowKey
}

/**
 * Whether opening `chain` for `owner` may push an address: a shell sheet always; a page's sheet only when the
 * table lists it for that page and the owner is the page showing. Anything else opens as a plain dialog with no
 * address (a copy of the page further down the stack, a dialog rendered outside any page, a sheet the table
 * does not list for this page).
 */
export function canPushSheet(owner: Owner, chain: readonly string[]): boolean {
  if (!navigationRef.isReady()) return false
  if (isGlobalSheet(chain)) return true
  return owner !== null && isPageSheet(owner.name, chain, owner.params) && owner.key !== undefined && owner.key === topPageKey()
}

/** Pushes the markers that open `chain` (its parents first) over `owner`, or over the page now showing for a shell sheet. */
export function openSheetMarkers(owner: Owner, chain: readonly string[], query?: Record<string, string>) {
  if (!navigationRef.isReady()) return
  const here = focusedPage()
  if (!here) return
  const run = markerRun()
  const present = run.markers.map(m => m.data)
  /* A picker inside a sheet keeps the page snapshot (list state included) its sheet was opened with. */
  const params = present.find(m => ownsRun(owner, chain, run, m))?.pageParams ?? here.params
  for (let n = 1; n <= chain.length; n++) {
    const prefix = chain.slice(0, n)
    if (present.some(m => sameChain(m.sheets, prefix) && ownsRun(owner, prefix, run, m))) continue
    const marker: SheetMarker = {page: here.name, pageParams: params, sheets: [...prefix], ...(n === chain.length && query ? {query} : {})}
    navigationRef.dispatch(StackActions.push('Sheet', marker))
  }
}

/** Removes the markers of `chain` and of every sheet opened inside it. */
export function closeSheetMarkers(owner: Owner, chain: readonly string[]) {
  if (!navigationRef.isReady()) return
  const run = markerRun()
  const gone = new Set(run.markers.filter(m => startsWith(m.data.sheets, chain) && ownsRun(owner, chain, run, m.data)).map(m => m.key))
  if (gone.size === 0) return
  navigationRef.dispatch(state => {
    const routes = state.routes
    const tail = routes.slice(routes.length - gone.size)
    /* The usual case: they are the top routes, so this is a plain pop (one history step back). */
    if (tail.every(r => gone.has(r.key))) return StackActions.pop(gone.size)
    const kept = routes.filter(r => !gone.has(r.key))
    return CommonActions.reset({...state, routes: kept, index: kept.length - 1})
  })
}

/** Replaces the query in a sheet's address (Search & Ask switching to Ask) without adding a history entry. */
export function setSheetQuery(chain: readonly string[], query: Record<string, string>) {
  if (!navigationRef.isReady()) return
  const marker = markerRun().markers.find(m => sameChain(m.data.sheets, chain))
  if (marker) navigationRef.dispatch({...CommonActions.setParams({query}), source: marker.key})
}

/** The page under the markers: its name and every param it has (list state included). */
function focusedPage(): {name: string; params: Record<string, string>} | null {
  if (!navigationRef.isReady()) return null
  type Node = {routes: {name: string; params?: object; state?: unknown}[]; index?: number}
  const focused = (state: Node): {name: string; params?: object} => {
    let i = state.index ?? state.routes.length - 1
    while (i > 0 && state.routes[i]!.name === 'Sheet') i--
    const route = state.routes[i]!
    return (route.state as Node | undefined)?.routes ? focused(route.state as Node) : route
  }
  const root = navigationRef.getRootState()
  if (!root) return null
  const route = focused(root as Node)
  const params = Object.fromEntries(
    Object.entries((route.params ?? {}) as Record<string, unknown>).flatMap(([k, v]) =>
      typeof v === 'string' ? [[k, v]] : typeof v === 'number' || typeof v === 'boolean' ? [[k, String(v)]] : [],
    ),
  )
  return {name: route.name, params}
}

/* Phone: the held sheet (see `lib/links/pending`), with the store's change signal around it. */

/** Holds a link's sheet for the page it opens (native); on web the markers in the stack do this. */
export function queueSheets(target: LinkTarget) {
  if (IS_WEB) return
  watch()
  held.queue(target, Date.now())
  notify()
}

/** The held sheet's query when this dialog is the one it waits for, else undefined. Does not consume it. */
export function peekPending(owner: Owner, chain: readonly string[]) {
  return held.peek(owner && {name: owner.name, params: owner.params}, chain, Date.now())
}

/** The dialog opened (or was refused for good): the hold is over. */
export function donePending() {
  held.done()
}

export const hasPending = held.hasPending
