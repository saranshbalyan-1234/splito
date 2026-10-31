import {type Router} from '@react-navigation/native'

/*
 * Tabs stay mounted (owner 166): popping back to the start tab used to unmount Groups, Analytics or Activity and
 * remount them on the next visit (and every row's exit animation ran: Analytics -> People was 600 ms, 5.9 s at 6x
 * CPU). A tab the stack drops is parked among the router's `preloadedRoutes` instead: the same key keeps its
 * tree, state and scroll, `NAVIGATE` / `PUSH` to it re-uses the key, and the view renders it hidden. The start tab is
 * pinned already (the navigator keeps it mounted). Only `state.routes` is the URL, so history is unaffected.
 *
 * Pure (no React), so the rules are unit-tested with the real `StackRouter` (parkTabs.test.ts).
 */
export type RouteLike = {key: string; name: string; path?: string; params?: object}
// oxlint-disable-next-line typescript/no-explicit-any -- the router's state and action types are generic here
type AnyRouter = Router<any, any>
type Params = Record<string, unknown> | undefined

export const PARKED_TABS: ReadonlySet<string> = new Set(['People', 'Groups', 'Analytics', 'Activity', 'Settings'])
/** Actions that remove routes from the stack (a pushed page popped, a tab popped to, Back). */
const DROPPING = new Set(['POP', 'POP_TO', 'POP_TO_TOP', 'GO_BACK', 'NAVIGATE'])

export function shallowEqual(a: object | undefined, b: object | undefined) {
  const x = (a ?? {}) as Record<string, unknown>
  const y = (b ?? {}) as Record<string, unknown>
  const keys = Object.keys(x)
  return keys.length === Object.keys(y).length && keys.every(k => Object.is(x[k], y[k]))
}

/**
 * A main screen opened from a link or a push is a copy of the tab that carries where it came from (`from`,
 * `pushed`), identical to the tab except for Back (owners 184/190). It is never the tab: never parked, never
 * revived in the tab's place.
 */
export function isPushedCopy(params: Params) {
  return params?.from != null || params?.pushed != null
}

/** Only the plain tab is parked: a copy, or a route with list state in its address, is dropped like any page. */
function isPlainTab(route: RouteLike) {
  return Object.keys(route.params ?? {}).length === 0
}

/**
 * `getId` for the tab screens: the plain tab has one id, a pushed copy another per origin, so the stack
 * router's by-name matching (`navigate` / `push` / `popTo` and the preloaded lookup) never confuses them.
 */
export function tabId({params}: {params?: object}) {
  const p = params as Params
  return isPushedCopy(p) ? `pushed:${String(p?.from ?? p?.pushed)}` : 'tab'
}

type Options = {routeGetIdList?: Record<string, ((o: {params?: object}) => string | undefined) | undefined>}

/** The router with parking, over `original` (and over what a caller's own `UNSTABLE_router` made of it). */
export function parkTabs(
  original: AnyRouter,
  caller?: (original: AnyRouter) => Partial<AnyRouter>,
  parkable: ReadonlySet<string> = PARKED_TABS,
): AnyRouter {
  const base: AnyRouter = {...original, ...(caller?.(original) ?? {})}
  return {
    ...base,
    getStateForAction(state, action, options) {
      const getId = (name: string) => (options as Options).routeGetIdList?.[name]
      const payload = (action as {payload?: {name?: string; pop?: boolean; params?: object}}).payload
      const name = payload?.name
      /*
       * `navigate(..., {pop: true})` to a parked tab is a no-op in the stack router (it looks for the route in
       * `routes` only and never adds the preloaded one), so it is a `PUSH`, which re-uses the parked key.
       */
      let rewritten = action
      if (action.type === 'NAVIGATE' && payload?.pop && name && parkable.has(name)) {
        const id = getId(name)?.({params: payload.params})
        const matches = (r: RouteLike) => r.name === name && getId(name)?.({params: r.params}) === id
        if (!state.routes.some(matches) && state.preloadedRoutes.some(matches)) rewritten = {...action, type: 'PUSH'}
      }
      const made = base.getStateForAction(state, rewritten, options)
      if (!made || made === state) return made
      if (action.type === 'RESET') return adoptParked(state, made, parkable)
      if (!DROPPING.has(action.type)) return made
      /*
       * A route navigated to with the params it already has stays the same object: the stack router makes a new
       * one on every `navigate`, which re-renders the whole screen behind it (its `route` prop changed) when you
       * return to a tab you left, however little changed.
       */
      const before = new Map<string, RouteLike>(
        [...state.routes, ...state.preloadedRoutes].map((r: RouteLike) => [r.key, r]),
      )
      const same = (r: RouteLike) => {
        const old = before.get(r.key)
        return old && old.name === r.name && old.path === r.path && shallowEqual(old.params, r.params) ? old : r
      }
      const next = {...made, routes: made.routes.map(same), preloadedRoutes: made.preloadedRoutes.map(same)}
      const kept = new Set(next.routes.map((r: RouteLike) => r.key))
      return park(
        next,
        state.routes.filter((r: RouteLike) => parkable.has(r.name) && isPlainTab(r) && !kept.has(r.key)),
      )
    },
  }
}

/** `dropped` into `preloadedRoutes`, the last one per name (an older parked tree of that name is released). */
// oxlint-disable-next-line typescript/no-explicit-any -- navigation state is generic here
function park(next: any, dropped: RouteLike[]) {
  if (!dropped.length) return next
  const last = new Map<string, RouteLike>(dropped.map(r => [r.name, r]))
  return {
    ...next,
    preloadedRoutes: [
      ...next.preloadedRoutes.filter((r: RouteLike) => !last.has(r.name)),
      ...last.values(),
    ],
  }
}

/**
 * A reset (browser Back or Forward restoring a history entry) carries no parked routes and may carry the tab
 * under another key. A parked tree is adopted by the plain tab of its name (the route takes the parked key), and
 * what the reset leaves out is parked again, so history navigation does not remount a tab either.
 */
// oxlint-disable-next-line typescript/no-explicit-any -- navigation state is generic here
function adoptParked(state: any, made: any, parkable: ReadonlySet<string>) {
  const known = new Map<string, RouteLike>(
    [...state.routes, ...state.preloadedRoutes]
      .filter((r: RouteLike) => parkable.has(r.name) && isPlainTab(r))
      .map((r: RouteLike) => [r.key, r]),
  )
  const claimed = new Set<string>()
  const routes = made.routes.map((r: RouteLike) => {
    if (!parkable.has(r.name) || !isPlainTab(r)) return r
    if (known.has(r.key)) {
      claimed.add(r.key)
      return r
    }
    // A plain tab under a key we have never seen: adopt the live tree of that name, if one is free.
    const free = [...known.values()].find(k => k.name === r.name && !claimed.has(k.key))
    if (!free) return r
    claimed.add(free.key)
    return {...r, key: free.key}
  })
  const keys = new Set(routes.map((r: RouteLike) => r.key))
  const left = [...known.values()].filter(k => !keys.has(k.key))
  return park({...made, routes, index: made.index, preloadedRoutes: []}, left)
}
