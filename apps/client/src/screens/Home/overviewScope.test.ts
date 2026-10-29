import {expect, test} from 'bun:test'

import {scopeFromParam} from '#/screens/Analytics/urlState'
import {analyticsHref, overviewParam, readOverviewScope} from './overviewScope'

test('the Overview scope is read from the address and written only when it differs from stock and saved', () => {
  expect(readOverviewScope({overview: 'groups'})).toBe('groups')
  expect(readOverviewScope({overview: 'nope'})).toBeUndefined()
  expect(readOverviewScope(undefined)).toBeUndefined()
  expect(overviewParam('all', 'all')).toBeUndefined()
  expect(overviewParam('groups', 'all')).toBe('groups')
  // All, while the saved choice is Groups, must be written or the address would fall back to Groups.
  expect(overviewParam('all', 'groups')).toBe('all')
})

test('Analytics carries the same scope: everything, non-group, all groups', () => {
  expect(analyticsHref('all')).toBe('/analytics')
  expect(analyticsHref('all', 'EUR')).toBe('/analytics?currency=EUR')
  expect(analyticsHref('groups')).toBe('/analytics?scope=0%3Aall')
  expect(analyticsHref('direct', 'INR')).toBe('/analytics?currency=INR&scope=1%3A')
  expect(scopeFromParam('0:all')).toEqual({nonGroup: false, groups: 'all'})
  expect(scopeFromParam('1:')).toEqual({nonGroup: true, groups: []})
})
