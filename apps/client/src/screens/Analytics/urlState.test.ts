import {expect, test} from 'bun:test'

import {MAX_OFFSET, readAnalyticsParams, readOffset} from './urlState'

test('only valid params are read', () => {
  expect(readAnalyticsParams({period: 'month', offset: '-2', currency: 'EUR'})).toMatchObject({period: 'month', offset: -2, currency: 'EUR'})
  expect(readAnalyticsParams({period: 'decade', offset: 'x', currency: 'eur'})).toEqual({offset: 0, period: undefined, custom: undefined, currency: undefined, scope: undefined})
  expect(readAnalyticsParams({period: 'custom', from: '2026-02-01', to: '2026-01-01'}).custom).toBeUndefined()
  expect(readAnalyticsParams({period: 'custom', from: '2026-01-01', to: '2026-02-01'}).custom).toEqual({from: '2026-01-01', to: '2026-02-01'})
})

test('offsets are short signed integers, clamped', () => {
  expect(readOffset('-3')).toBe(-3)
  expect(readOffset('0')).toBe(0)
  expect(readOffset('9999')).toBe(MAX_OFFSET)
  expect(readOffset('-9999')).toBe(-MAX_OFFSET)
  for (const bad of ['10000000', '1e3', '0x10', ' 5', '5.5', '--1', '', undefined]) expect(readOffset(bad)).toBe(0)
})
