import {CommonActions, StackActions} from '@react-navigation/native'

import {type LinkTarget} from '#/lib/links/resolve'
import {isGlobalSheet, pathParamNames} from '#/lib/links/table'
import {type SheetMarker} from '#/lib/routes/types'
import {IS_WEB} from '#/env'
import {navigationRef} from '#/navigation/ref'

/**
 * Sheets as URLs (ARCHITECTURE 26.3, F-241). On web a sheet is a `Sheet` marker route above its page in the one
 * flat stack, so opening pushes the URL, the browser's Back removes the marker and closes the sheet, and a
 * pasted URL arrives with the marker already there. On a phone there is no address bar and the native sheet
 * has its own dismiss, so a sheet stays plain dialog state; a deep link to one is held here (`queueSheets`)
 * until the page it covers mounts and its `useDialogControl({url})` takes it.
 */

export type Owner = {name: string; params: Record<string, string>} | null

type Marker = {key: string; data: SheetMarker}

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
  navigationRef.addListener('state', notify)
}

/** The `Sheet` markers on top of the stack (web), oldest first. */
export function markersOnTop(): Marker[] {
  watch()
  if (!navigationRef.isReady()) return []
  const routes = navigationRef.getRootState()?.routes ?? []
  const out: Marker[] = []
  for (let i = routes.length - 1; i >= 0 && routes[i]!.name === 'Sheet'; i--) {
    out.unshift({key: routes[i]!.key, data: routes[i]!.params as SheetMarker})
  }
  return out
}

export function sameChain(a: readonly string[], b: readonly string[]) {
  return a.length === b.length && a.every((s, i) => s === b[i])
}

function startsWith(chain: readonly string[], prefix: readonly string[]) {
  return prefix.every((s, i) => chain[i] === s)
}

/** A page's own params, as the marker keeps them: the path params only, so list state never splits a page in two. */
export function ownerOf(route: {name: string; params?: object}): NonNullable<Owner> {
  const params = (route.params ?? {}) as Record<string, string | undefined>
  return {name: route.name, params: Object.fromEntries(pathParamNames(route.name).flatMap(n => (params[n] ? [[n, params[n]!]] : [])))}
}

function ownsMarker(owner: Owner, chain: readonly string[], m: SheetMarker) {
  if (owner === null || isGlobalSheet(chain)) return true
  const page = ownerOf({name: m.page, params: m.pageParams})
  return page.name === owner.name && Object.entries(owner.params).every(([k, v]) => page.params[k] === v)
}

/** The marker that opens exactly this sheet over this owner, if the stack has one. */
export function markerFor(owner: Owner, chain: readonly string[]): SheetMarker | undefined {
  return markersOnTop()
    .map(m => m.data)
    .find(m => sameChain(m.sheets, chain) && ownsMarker(owner, chain, m))
}

/** Pushes the markers that open `chain` (its parents first) over `owner`, or over the page now showing for a shell sheet. */
export function openSheetMarkers(owner: Owner, chain: readonly string[], query?: Record<string, string>) {
  if (!navigationRef.isReady()) return
  const here = focusedPage()
  if (!here) return
  const present = markersOnTop().map(m => m.data)
  /* A picker inside a sheet keeps the page snapshot (list state included) its sheet was opened with. */
  const params = present.find(m => ownsMarker(owner, chain, m))?.pageParams ?? here.params
  for (let n = 1; n <= chain.length; n++) {
    const prefix = chain.slice(0, n)
    if (present.some(m => sameChain(m.sheets, prefix) && ownsMarker(owner, prefix, m))) continue
    const marker: SheetMarker = {page: here.name, pageParams: params, sheets: [...prefix], ...(n === chain.length && query ? {query} : {})}
    navigationRef.dispatch(StackActions.push('Sheet', marker))
  }
}

/** Removes the markers of `chain` and of every sheet opened inside it. */
export function closeSheetMarkers(owner: Owner, chain: readonly string[]) {
  if (!navigationRef.isReady()) return
  const top = markersOnTop()
  const gone = new Set(top.filter(m => startsWith(m.data.sheets, chain) && ownsMarker(owner, chain, m.data)).map(m => m.key))
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

/* Native: a deep link's sheets wait here for the page to mount. One slot; a new link replaces it. */
type Pending = {owner: Owner; chain: string[]; query: Record<string, string>; depth: number}
let pending: Pending | null = null

/** Holds a link's sheets for the page it opens (native); on web the markers in the stack do this. */
export function queueSheets(target: LinkTarget) {
  if (IS_WEB) return
  const next = target.sheets.length > 0 ? {owner: isGlobalSheet(target.sheets) ? null : {name: target.name, params: pickPath(target)}, chain: target.sheets, query: target.query, depth: 0} : null
  pending = next
  notify()
}

function pickPath(target: LinkTarget) {
  return ownerOf({name: target.name, params: target.params}).params
}

/** The queued link's query when it is this sheet's turn (its parents are open), else undefined. Takes it. */
export function takePending(owner: Owner, chain: readonly string[]): Record<string, string> | undefined {
  const p = pending
  if (!p || chain.length !== p.depth + 1 || !startsWith(p.chain, chain)) return undefined
  if (p.owner && owner && (p.owner.name !== owner.name || !Object.entries(p.owner.params).every(([k, v]) => owner.params[k] === v))) return undefined
  p.depth = chain.length
  if (p.depth >= p.chain.length) pending = null
  return p.query
}

export function hasPending() {
  return pending !== null
}
