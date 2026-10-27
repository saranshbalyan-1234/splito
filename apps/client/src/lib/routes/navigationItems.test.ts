import {expect, test} from 'bun:test'
import {PREFS} from '@splito/sync'

import {
  bottomBarItems,
  IS_ASK_SPLITO_AVAILABLE,
  NAV_ITEM_HREF,
  NAV_ITEM_ROUTE,
  navigationItems,
} from './navigationItems'

test('one list, in the order of ARCHITECTURE 26.3', () => {
  expect(navigationItems(true)).toEqual([
    'people',
    'groups',
    'analytics',
    'ask',
    'activity',
    'settings',
  ])
})

test('Ask Splito is hidden, not a dead link, until F-2301 ships', () => {
  expect(IS_ASK_SPLITO_AVAILABLE).toBe(false)
  expect(navigationItems()).toEqual([
    'people',
    'groups',
    'analytics',
    'activity',
    'settings',
  ])
  expect(bottomBarItems(['people', 'ask', 'groups'])).toEqual([
    'people',
    'groups',
  ])
  expect(bottomBarItems(['people', 'ask', 'groups'], true)).toEqual([
    'people',
    'ask',
    'groups',
  ])
})

test('the default bottom bar is Home, Groups, Analytics, Activity', () => {
  expect(bottomBarItems(PREFS.tabs.default)).toEqual([
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
