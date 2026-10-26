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
  expect(await getPref(s, 'tabs')).toEqual(['people', 'groups', 'analytics', 'activity'])
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

test('tabs: any non-empty set of known tabs, no duplicates; Profile is not a tab', async () => {
  await setPref(s, ctx, 'tabs', ['groups'])
  expect(await getPref(s, 'tabs')).toEqual(['groups'])
  await expect(setPref(s, ctx, 'tabs', [])).rejects.toThrow('INVALID_PREF')
  await expect(setPref(s, ctx, 'tabs', ['groups', 'groups'])).rejects.toThrow('INVALID_PREF')
  await expect(setPref(s, ctx, 'tabs', ['groups', 'profile'] as never)).rejects.toThrow('INVALID_PREF')
  await setPref(s, ctx, 'tabs', ['activity', 'people'])
  expect(await getPref(s, 'tabs')).toEqual(['activity', 'people'])
})

test("a list stored before the header-bell build keeps Activity where it was", async () => {
  // The bell build dropped 'activity' on read only, so the stored value still names it.
  await s.transaction(async tx => {
    await tx.put({type: 'preference', id: 'tabs', data: {value: ['groups', 'activity', 'people']}, version: 1, deleted: false, updatedAt: 1})
    await tx.put({type: 'preference', id: 'homeTab', data: {value: 'activity'}, version: 1, deleted: false, updatedAt: 1})
  })
  expect(await getPref(s, 'tabs')).toEqual(['groups', 'activity', 'people'])
  expect(await getPref(s, 'homeTab')).toBe('activity')
})

test('home tab must be a visible tab', async () => {
  await setPref(s, ctx, 'tabs', ['groups', 'analytics'])
  expect(await getPref(s, 'homeTab')).toBe('groups')
})

test('Activity is a tab again: a stored order keeps it and its place', async () => {
  const stored = (id: string, value: unknown) =>
    s.transaction(async tx => tx.put({type: 'preference', id, data: {value}, version: 1, deleted: false, updatedAt: 1}))
  await stored('tabs', ['activity', 'analytics', 'people'])
  await stored('homeTab', 'activity')
  expect(await getPref(s, 'tabs')).toEqual(['activity', 'analytics', 'people'])
  expect(await getPref(s, 'homeTab')).toBe('activity')
  await setPref(s, ctx, 'tabs', ['groups', 'activity'])
  expect(await getPref(s, 'tabs')).toEqual(['groups', 'activity'])
})

test('an order saved while Profile was a tab predates the Analytics tab, so Analytics joins it', async () => {
  await s.transaction(async tx =>
    tx.put({type: 'preference', id: 'tabs', data: {value: ['people', 'groups', 'activity', 'profile']}, version: 1, deleted: false, updatedAt: 1}),
  )
  expect(await getPref(s, 'tabs')).toEqual(['people', 'groups', 'activity', 'analytics'])
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

test('dark theme: Bluesky dim or dark, blackish dark by default', async () => {
  expect(await getPref(s, 'darkTheme')).toBe('dark')
  await setPref(s, ctx, 'darkTheme', 'dim')
  expect(await getPref(s, 'darkTheme')).toBe('dim')
  await expect(setPref(s, ctx, 'darkTheme', 'light' as never)).rejects.toThrow('INVALID_PREF')
})

test('every default passes its own validator', () => {
  for (const def of Object.values(PREFS)) expect(def.validate(def.default)).toBe(true)
})

test('analytics opens on this year as charts; both are choices with a reset', async () => {
  expect(await getPref(s, 'analyticsPeriod')).toBe('year')
  expect(await getPref(s, 'analyticsView')).toBe('charts')
  await setPref(s, ctx, 'analyticsView', 'table')
  await expect(setPref(s, ctx, 'analyticsPeriod', 'decade' as never)).rejects.toThrow('INVALID_PREF')
  await resetPref(s, ctx, 'analyticsView')
  expect(await getPref(s, 'analyticsView')).toBe('charts')
})
