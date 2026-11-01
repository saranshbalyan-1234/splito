import {describe, expect, test} from 'bun:test'
import {StackRouter} from '@react-navigation/routers'

import {isPushedCopy, parkTabs, tabId} from '#/navigation/parkTabs'

const routeNames = ['People', 'Groups', 'Analytics', 'Activity', 'Group', 'Profile']
const getIds = {People: tabId, Groups: tabId, Analytics: tabId, Activity: tabId}

// oxlint-disable-next-line typescript/no-explicit-any -- the router's state and action types are generic in tests
const options: any = {routeNames, routeParamList: {}, routeGetIdList: getIds}
// oxlint-disable-next-line typescript/no-explicit-any -- as above
const original: any = StackRouter({initialRouteName: 'People'})
const router = parkTabs(original)

// oxlint-disable-next-line typescript/no-explicit-any -- as above
function start(): any {
  return router.getInitialState({routeNames, routeParamList: {}, routeGetIdList: getIds})
}
// oxlint-disable-next-line typescript/no-explicit-any -- as above
function go(state: any, action: any) {
  return router.getStateForAction(state, action, options) ?? state
}
/** Browser history restores a whole navigator state (`resetRoot`): full, not stale, with its own keys. */
// oxlint-disable-next-line typescript/no-explicit-any -- as above
const reset = (s: any, routes: Array<{name: string; key: string}>, index = routes.length - 1) => ({
  type: 'RESET',
  payload: {...s, index, routes, preloadedRoutes: []},
})
const tab = (name: string, params?: object) => ({type: 'NAVIGATE', payload: {name, params, pop: true}})
// oxlint-disable-next-line typescript/no-explicit-any -- as above
const names = (rs: any[]) => rs.map(r => r.name)

describe('parkTabs', () => {
  test('a tab popped to Home is parked, and navigating to it again revives the same route key (PUSH rewrite)', () => {
    let s = go(start(), tab('Groups'))
    const groupsKey = s.routes[1].key
    s = go(s, tab('People'))
    expect(names(s.routes)).toEqual(['People'])
    expect(s.preloadedRoutes.map((r: {key: string}) => r.key)).toEqual([groupsKey])
    s = go(s, tab('Groups'))
    expect(names(s.routes)).toEqual(['People', 'Groups'])
    expect(s.routes[1].key).toBe(groupsKey)
    expect(s.preloadedRoutes).toEqual([])
  })

  test('without the rewrite the stack router ignores a pop-navigate to a preloaded route', () => {
    let s = go(start(), tab('Groups'))
    s = go(s, tab('People'))
    const ignored = original.getStateForAction(s, tab('Groups'), options)
    expect(names(ignored.routes)).toEqual(['People'])
  })

  test('the same route object is kept when it is navigated to with the params it has', () => {
    let s = go(start(), tab('Groups'))
    s = go(s, tab('Analytics'))
    const groups = s.routes[1]
    s = go(s, tab('Groups'))
    expect(s.routes[1]).toBe(groups)
  })

  test('only the last dropped route of a name stays parked', () => {
    let s: any = start()
    s = go(s, reset(s, [{name: 'People', key: 'p'}, {name: 'Groups', key: 'g1'}, {name: 'Groups', key: 'g2'}]))
    s = go(s, tab('People'))
    expect(s.preloadedRoutes.map((r: {key: string}) => r.key)).toEqual(['g2'])
  })

  test('a pushed page, a pushed copy and a tab with params in its address are dropped, not parked', () => {
    let s = go(start(), {type: 'PUSH', payload: {name: 'Group', params: {id: 'g1'}}})
    s = go(s, {type: 'PUSH', payload: {name: 'Groups', params: {from: 'people'}}})
    s = go(s, {type: 'PUSH', payload: {name: 'Analytics', params: {sort: 'name'}}})
    s = go(s, tab('People'))
    expect(s.preloadedRoutes).toEqual([])
  })

  test('a pushed copy never captures the parked plain tab, and the plain tab never lands on a copy', () => {
    let s = go(start(), tab('Groups'))
    const plainKey = s.routes[1].key
    s = go(s, tab('People'))
    s = go(s, {type: 'PUSH', payload: {name: 'Groups', params: {from: 'people'}}})
    const copy = s.routes[1]
    expect(copy.key).not.toBe(plainKey)
    expect(s.preloadedRoutes.map((r: {key: string}) => r.key)).toEqual([plainKey])
    // The plain tab is asked for while the copy is on top: it is revived, the copy is not mistaken for it.
    s = go(s, tab('Groups'))
    expect(s.routes.at(-1).key).toBe(plainKey)
    // And a copy that is popped is never parked as the tab.
    s = go(s, tab('People'))
    expect(s.preloadedRoutes.map((r: {key: string}) => r.key)).toEqual([plainKey])
  })

  test('a replace drops a tab for good, and a reset adopts the parked tree for the plain tab', () => {
    let s = go(start(), tab('Groups'))
    const groupsKey = s.routes[1].key
    s = go(s, {type: 'REPLACE', payload: {name: 'Profile'}})
    expect(s.preloadedRoutes).toEqual([])
    s = go(start(), tab('Groups'))
    const parkedKey = s.routes[1].key
    s = go(s, tab('People'))
    expect(s.preloadedRoutes[0].key).toBe(parkedKey)
    // Browser Forward: the history entry says Home > Groups under a key the stack has not seen.
    s = go(s, reset(s, [{name: 'People', key: s.routes[0].key}, {name: 'Groups', key: 'Groups-history'}]))
    expect(names(s.routes)).toEqual(['People', 'Groups'])
    expect(s.routes[1].key).toBe(parkedKey)
    expect(s.preloadedRoutes).toEqual([])
    expect(groupsKey).toBeTruthy()
  })

  test('a reset that leaves a live tab out parks it again', () => {
    let s = go(start(), tab('Groups'))
    const groupsKey = s.routes[1].key
    s = go(s, reset(s, [{name: 'People', key: s.routes[0].key}]))
    expect(s.preloadedRoutes.map((r: {key: string}) => r.key)).toEqual([groupsKey])
  })

  test("a caller's own router is wrapped, not replaced", () => {
    const calls: string[] = []
    const wrapped = parkTabs(original, o => ({
      getStateForAction(state, action, opts) {
        calls.push(action.type)
        return o.getStateForAction(state, action, opts)
      },
    }))
    // oxlint-disable-next-line typescript/no-explicit-any -- as above
    const s: any = wrapped.getInitialState({routeNames, routeParamList: {}, routeGetIdList: getIds})
    wrapped.getStateForAction(s, tab('Groups'), options)
    expect(calls).toEqual(['NAVIGATE'])
  })

  test('tab ids: one for the plain tab, one per origin for a copy', () => {
    expect(tabId({})).toBe('tab')
    expect(tabId({params: {from: 'people'}})).toBe('pushed:people')
    expect(isPushedCopy({pushed: '1'})).toBe(true)
    expect(isPushedCopy({sort: 'name'})).toBe(false)
  })
})
