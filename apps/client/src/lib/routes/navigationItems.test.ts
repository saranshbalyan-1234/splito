import {expect, test} from 'bun:test'
import {PREFS} from '@splito/sync'

import {
  bottomBarItems,
  IS_ASK_SPLITO_AVAILABLE,
  NAV_ITEM_HREF,
  NAV_ITEM_ROUTE,
  navigationItems,
  splitNavigationItems,
} from './navigationItems'

test('one list, in the order of ARCHITECTURE 26.3', () => {
  expect(navigationItems(true)).toEqual([
    'home',
    'people',
    'groups',
    'analytics',
    'ask',
    'activity',
    'settings',
  ])
})

test('Ask Splito is in the list now that F-2301 ships; it can still be switched off', () => {
  expect(IS_ASK_SPLITO_AVAILABLE).toBe(true)
  expect(navigationItems()).toEqual(['home', 'people', 'groups', 'analytics', 'ask', 'activity', 'settings'])
  expect(navigationItems(false)).toEqual(['home', 'people', 'groups', 'analytics', 'activity', 'settings'])
  expect(bottomBarItems(['home', 'ask', 'groups'])).toEqual(['home', 'ask', 'groups'])
  expect(bottomBarItems(['home', 'ask', 'groups'], false)).toEqual(['home', 'groups'])
})

test('the default bottom bar is Home, People, Groups, Analytics, Activity', () => {
  expect(bottomBarItems(PREFS.tabs.default)).toEqual([
    'home',
    'people',
    'groups',
    'analytics',
    'activity',
  ])
})

test('every item opens a route with a path, except Ask Splito, which opens the drawer', () => {
  for (const id of navigationItems(true)) {
    expect(NAV_ITEM_ROUTE[id] === undefined).toBe(id === 'ask')
    expect(NAV_ITEM_HREF[id] === undefined).toBe(id === 'ask')
  }
})

test('the sidebar and drawer order: what is on in its order, then the rest in the shared order', () => {
  expect(splitNavigationItems(PREFS.tabs.default)).toEqual({
    on: ['home', 'people', 'groups', 'analytics', 'activity'],
    off: ['ask', 'settings'],
  })
  expect(splitNavigationItems(['home', 'settings', 'groups'])).toEqual({
    on: ['home', 'settings', 'groups'],
    off: ['people', 'analytics', 'ask', 'activity'],
  })
  expect(splitNavigationItems(['home', 'ask'], false)).toEqual({
    on: ['home'],
    off: ['people', 'groups', 'analytics', 'activity', 'settings'],
  })
})
