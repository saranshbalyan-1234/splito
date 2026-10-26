import {beforeEach, expect, test} from 'bun:test'

import {DEFAULT_CATEGORIES, getPref, PREFS, resetAllPrefs, resetPref, setPref} from '../src/preferences'
import {openSqlStore} from '../src/sqlStore'
import type {Store} from '../src/store'
import type {MutationCtx} from '../src/types'
import {bunExecutor} from './bunExecutor'

let s: Store
let n = 0
const ctx: MutationCtx = {deviceId: 'd', actor: 'me', now: () => ++n, newId: () => 'op' + ++n}
beforeEach(async () => {
  s = await openSqlStore(bunExecutor(':memory:'))
})

test('default returned when unset', async () => {
  expect(await getPref(s, 'defaultCurrency')).toBe('INR')
  expect(await getPref(s, 'includeGroupsDefault')).toBe(true)
  expect(await getPref(s, 'tabs')).toEqual(['people', 'groups', 'activity', 'profile'])
})

test('set then get', async () => {
  await setPref(s, ctx, 'accent', '#7c3aed')
  expect(await getPref(s, 'accent')).toBe('#7c3aed')
})

test('invalid value rejected', async () => {
  await expect(setPref(s, ctx, 'accent', 'purple' as never)).rejects.toThrow('INVALID_PREF')
  await expect(setPref(s, ctx, 'defaultCurrency', 'XXX')).rejects.toThrow('INVALID_PREF')
  await expect(setPref(s, ctx, 'textScale', 3)).rejects.toThrow('INVALID_PREF')
})

test('account pref enqueues an outbox op, device pref does not', async () => {
  await setPref(s, ctx, 'defaultCurrency', 'USD')
  expect((await s.outbox()).map(o => o.opType)).toEqual(['preference.set'])
  await setPref(s, ctx, 'haptics', false)
  expect(await s.outbox()).toHaveLength(1)
  expect(await getPref(s, 'haptics')).toBe(false)
})

test('tabs must keep a route to Settings', async () => {
  await expect(setPref(s, ctx, 'tabs', ['people', 'groups'])).rejects.toThrow('INVALID_PREF')
  await setPref(s, ctx, 'tabs', ['groups', 'profile'])
  expect(await getPref(s, 'tabs')).toEqual(['groups', 'profile'])
})

test('home tab must be a visible tab', async () => {
  await setPref(s, ctx, 'tabs', ['groups', 'profile'])
  expect(await getPref(s, 'homeTab')).toBe('groups')
})

test('reset restores default', async () => {
  await setPref(s, ctx, 'density', 'compact')
  await resetPref(s, ctx, 'density')
  expect(await getPref(s, 'density')).toBe('comfortable')
  await setPref(s, ctx, 'theme', 'dark')
  await setPref(s, ctx, 'weekStart', 0)
  await resetAllPrefs(s, ctx)
  expect(await getPref(s, 'theme')).toBe('system')
  expect(await getPref(s, 'weekStart')).toBe(1)
})

test('categories rename keeps id', async () => {
  const cats = DEFAULT_CATEGORIES.map(c => (c.id === 'food' ? {...c, name: 'Eating out'} : c))
  await setPref(s, ctx, 'categories', cats)
  const got = await getPref(s, 'categories')
  expect(got.find(c => c.id === 'food')!.name).toBe('Eating out')
})

test('categories with duplicate ids rejected', async () =>
  expect(setPref(s, ctx, 'categories', [DEFAULT_CATEGORIES[0]!, DEFAULT_CATEGORIES[0]!])).rejects.toThrow('INVALID_PREF'))

test('every default passes its own validator', () => {
  for (const def of Object.values(PREFS)) expect(def.validate(def.default)).toBe(true)
})
