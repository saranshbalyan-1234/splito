import {expect, test} from 'bun:test'

import {scopeFromParam} from '#/lib/scope'
import {analyticsHref, overviewScopeParam} from './overviewScope'

test('an old ?overview= link reads as Analytics\' scope (owner 219); anything else is no scope', () => {
  expect(overviewScopeParam({overview: 'groups'})).toEqual({nonGroup: false, groups: 'all'})
  expect(overviewScopeParam({overview: 'direct'})).toEqual({nonGroup: true, groups: []})
  expect(overviewScopeParam({overview: 'all'})).toEqual({nonGroup: true, groups: 'all'})
  expect(overviewScopeParam({overview: 'nope'})).toBeUndefined()
  expect(overviewScopeParam(undefined)).toBeUndefined()
})

test('Analytics carries the same scope: everything, non-group, all groups', () => {
  // All is written out too, so Analytics never keeps the scope it saved last.
  expect(analyticsHref('all')).toBe('/analytics?scope=1%3Aall')
  expect(analyticsHref('all', 'EUR')).toBe('/analytics?currency=EUR&scope=1%3Aall')
  expect(analyticsHref('groups')).toBe('/analytics?scope=0%3Aall')
  expect(analyticsHref('direct', 'INR')).toBe('/analytics?currency=INR&scope=1%3A')
  expect(scopeFromParam('0:all')).toEqual({nonGroup: false, groups: 'all'})
  expect(scopeFromParam('1:')).toEqual({nonGroup: true, groups: []})
  expect(scopeFromParam('1:all')).toEqual({nonGroup: true, groups: 'all'})
})
