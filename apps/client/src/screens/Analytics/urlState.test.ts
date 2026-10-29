import {expect, test} from 'bun:test'

import {readAnalyticsParams, scopeFromParam, scopeToParam} from './urlState'

test('scope round-trips and everything prints nothing', () => {
  expect(scopeToParam({nonGroup: true, groups: 'all'})).toBeUndefined()
  expect(scopeToParam({nonGroup: false, groups: ['g1', 'g2']})).toBe('0:g1,g2')
  expect(scopeFromParam('0:g1,g2')).toEqual({nonGroup: false, groups: ['g1', 'g2']})
  expect(scopeFromParam('1:all')).toEqual({nonGroup: true, groups: 'all'})
  expect(scopeFromParam('0:')).toEqual({nonGroup: true, groups: 'all'})
  expect(scopeFromParam('junk')).toBeUndefined()
})

test('only valid params are read', () => {
  expect(readAnalyticsParams({period: 'month', offset: '-2', currency: 'EUR'})).toMatchObject({period: 'month', offset: -2, currency: 'EUR'})
  expect(readAnalyticsParams({period: 'decade', offset: 'x', currency: 'eur'})).toEqual({offset: 0, period: undefined, custom: undefined, currency: undefined, scope: undefined})
  expect(readAnalyticsParams({period: 'custom', from: '2026-02-01', to: '2026-01-01'}).custom).toBeUndefined()
  expect(readAnalyticsParams({period: 'custom', from: '2026-01-01', to: '2026-02-01'}).custom).toEqual({from: '2026-01-01', to: '2026-02-01'})
})
