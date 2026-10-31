import {expect, test} from 'bun:test'
import {PREFS} from '@splito/sync'

import {bottomBarItems, NAV_ITEM_HREF, NAV_ITEM_ROUTE, navigationItems, splitNavigationItems} from './navigationItems'

test('one list, in the order of ARCHITECTURE 26.3: no Home (owner 198), no Ask Splito (owner 200), no Settings (owner 220: it is part of Profile)', () => {
  expect(navigationItems()).toEqual(['people', 'groups', 'analytics', 'activity'])
})

test('the default bottom bar is People, Groups, Analytics, Activity (owner 220)', () => {
  expect(bottomBarItems(PREFS.tabs.default)).toEqual(['people', 'groups', 'analytics', 'activity'])
})

test('every item opens a route with a path', () => {
  for (const id of navigationItems()) {
    expect(NAV_ITEM_ROUTE[id]).toBeTruthy()
    expect(NAV_ITEM_HREF[id].startsWith('/')).toBe(true)
  }
})

test('the sidebar and drawer order: what is on in its order, then the rest in the shared order', () => {
  expect(splitNavigationItems(PREFS.tabs.default)).toEqual({
    on: ['people', 'groups', 'analytics', 'activity'],
    off: [],
  })
  expect(splitNavigationItems(['activity', 'groups'])).toEqual({
    on: ['activity', 'groups'],
    off: ['people', 'analytics'],
  })
})
