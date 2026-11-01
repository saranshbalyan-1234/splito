/// <reference types="bun" />
import {expect, test} from 'bun:test'

import {readActivityParams} from '#/components/activity/urlState'
import {resolveLink} from '#/lib/links/resolve'
import {EVERYTHING} from '#/lib/scope'
import {expensesPath} from './expensesPath'

const page = {range: {from: '2026-01-01', to: '2026-12-31'}, currency: 'EUR', scope: EVERYTHING}
const params = (path: string) => resolveLink(path).target.params

test('"See these expenses" carries the period, currency and, unless it is Everything, the scope', () => {
  expect(expensesPath(page)).toBe('/activity?tab=all&type=expenses&since=2026-01-01&until=2026-12-31&currency=EUR')
  const scoped = expensesPath({...page, scope: {nonGroup: false, groups: ['g1', 'g2']}})
  expect(params(scoped)).toEqual({tab: 'all', type: 'expenses', since: '2026-01-01', until: '2026-12-31', currency: 'EUR', scope: '0:g1,g2'})
  expect(readActivityParams(params(scoped)).scope).toEqual({nonGroup: false, groups: ['g1', 'g2']})
})

test('a bar narrows the days, cut to the page; a slice names a category, a person row a person', () => {
  expect(params(expensesPath(page, {from: '2026-03-01', to: '2026-03-31'}))).toMatchObject({since: '2026-03-01', until: '2026-03-31'})
  // A week that starts before the period and ends after it is only the part inside.
  expect(params(expensesPath(page, {from: '2025-12-29', to: '2026-01-04'}))).toMatchObject({since: '2026-01-01', until: '2026-01-04'})
  expect(params(expensesPath(page, {from: '2026-12-28', to: '2027-01-03'}))).toMatchObject({since: '2026-12-28', until: '2026-12-31'})
  expect(params(expensesPath(page, {category: 'food'}))).toMatchObject({category: 'food', since: '2026-01-01', until: '2026-12-31', currency: 'EUR'})
  const id = '123e4567-e89b-12d3-a456-426614174000'
  expect(params(expensesPath(page, {personId: id}))).toMatchObject({person: id, currency: 'EUR'})
})

test('with no currency yet the link names none', () => {
  expect(params(expensesPath({...page, currency: ''}))).not.toHaveProperty('currency')
})
