import {beforeEach, expect, test} from 'bun:test'

import {DEFAULT_CATEGORIES, getPref, INVITE_EXPIRY_MS, type PrefKey, prefFrom, PREFS, resetAllPrefs, resetPref, roundToFor, setPref} from '../src/preferences'
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
  // F-111 m13: an Object prototype key is no currency.
  await expect(setPref(s, ctx, 'defaultCurrency', 'toString')).rejects.toThrow('INVALID_PREF')
  await expect(setPref(s, ctx, 'textScale', 3)).rejects.toThrow('INVALID_PREF')
})

test('account pref enqueues an outbox op, device pref does not', async () => {
  await setPref(s, ctx, 'defaultCurrency', 'USD')
  expect((await s.outbox()).map(o => o.opType)).toEqual(['preference.set'])
  await setPref(s, ctx, 'haptics', false)
  expect(await s.outbox()).toHaveLength(1)
  expect(await getPref(s, 'haptics')).toBe(false)
})

test('tabs: any number from Home alone to every item of the shared nav list, Home first, no duplicates (26.3, decision 84)', async () => {
  await setPref(s, ctx, 'tabs', ['people', 'settings'])
  expect(await getPref(s, 'tabs')).toEqual(['people', 'settings'])
  await setPref(s, ctx, 'tabs', ['people', 'groups', 'analytics', 'ask', 'activity'])
  expect(await getPref(s, 'tabs')).toEqual(['people', 'groups', 'analytics', 'ask', 'activity'])
  await expect(setPref(s, ctx, 'tabs', [])).rejects.toThrow('INVALID_PREF')
  await setPref(s, ctx, 'tabs', ['people'])
  expect(await getPref(s, 'tabs')).toEqual(['people'])
  await setPref(s, ctx, 'tabs', ['people', 'groups', 'analytics', 'ask', 'activity', 'settings'])
  expect(await getPref(s, 'tabs')).toEqual(['people', 'groups', 'analytics', 'ask', 'activity', 'settings'])
  await expect(setPref(s, ctx, 'tabs', ['people', 'groups', 'analytics', 'ask', 'activity', 'settings', 'settings'])).rejects.toThrow('INVALID_PREF')
  await expect(setPref(s, ctx, 'tabs', ['people', 'groups', 'groups'])).rejects.toThrow('INVALID_PREF')
  await expect(setPref(s, ctx, 'tabs', ['people', 'profile'] as never)).rejects.toThrow('INVALID_PREF')
  // Home is fixed: never off, always first.
  await expect(setPref(s, ctx, 'tabs', ['groups', 'activity'])).rejects.toThrow('INVALID_PREF')
  await expect(setPref(s, ctx, 'tabs', ['groups', 'people'])).rejects.toThrow('INVALID_PREF')
})

test('an order stored before Home was fixed keeps its tabs, with Home moved first', async () => {
  const stored = (id: string, value: unknown) =>
    s.transaction(async tx => tx.put({type: 'preference', id, data: {value}, version: 1, deleted: false, updatedAt: 1}))
  // The bell build dropped 'activity' on read only, so the stored value still names it.
  await stored('tabs', ['groups', 'activity', 'people'])
  await stored('homeTab', 'activity')
  expect(await getPref(s, 'tabs')).toEqual(['people', 'groups', 'activity'])
  expect(await getPref(s, 'homeTab')).toBe('activity')
  // Without Home, Home joins at the front.
  await stored('tabs', ['activity', 'analytics'])
  expect(await getPref(s, 'tabs')).toEqual(['people', 'activity', 'analytics'])
  // Home alone is a valid bar now (decision 84).
  await stored('tabs', ['people'])
  expect(await getPref(s, 'tabs')).toEqual(['people'])
  // An empty stored order gets Home, which is fixed.
  await stored('tabs', [])
  expect(await getPref(s, 'tabs')).toEqual(['people'])
})

test('home tab must be a visible destination', async () => {
  await setPref(s, ctx, 'homeTab', 'groups')
  await setPref(s, ctx, 'tabs', ['people', 'analytics', 'settings'])
  expect(await getPref(s, 'homeTab')).toBe('people')
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

test('dark theme: Bluesky dim or dark, Dim by default (owner rule 14)', async () => {
  expect(await getPref(s, 'darkTheme')).toBe('dim')
  await setPref(s, ctx, 'darkTheme', 'dark')
  expect(await getPref(s, 'darkTheme')).toBe('dark')
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

test('analytics scope: Everything by default, stays on this device, never empty', async () => {
  expect(PREFS.analyticsScope.scope).toBe('device')
  expect(await getPref(s, 'analyticsScope')).toBe('everything')
  await setPref(s, ctx, 'analyticsScope', {nonGroup: false, groups: ['g1', 'g2']})
  expect(await getPref(s, 'analyticsScope')).toEqual({nonGroup: false, groups: ['g1', 'g2']})
  await setPref(s, ctx, 'analyticsScope', {nonGroup: true, groups: 'all'})
  for (const bad of [{nonGroup: false, groups: []}, {nonGroup: true, groups: ['g1', 'g1']}, {nonGroup: 'yes', groups: 'all'}, {groups: 'all'}, 'some'])
    await expect(setPref(s, ctx, 'analyticsScope', bad as never)).rejects.toThrow('INVALID_PREF')
  await resetPref(s, ctx, 'analyticsScope')
  expect(await getPref(s, 'analyticsScope')).toBe('everything')
})

test('itemize charges remember amount or % per kind: tax, tip and service %, discount amount by default', async () => {
  expect(await getPref(s, 'itemizeAdjustmentModes')).toEqual({tax: 'percent', tip: 'percent', service: 'percent', discount: 'amount'})
  await setPref(s, ctx, 'itemizeAdjustmentModes', {tax: 'amount', tip: 'percent', service: 'percent', discount: 'percent'})
  expect((await getPref(s, 'itemizeAdjustmentModes')).tax).toBe('amount')
  await expect(setPref(s, ctx, 'itemizeAdjustmentModes', {tax: 'percent'} as never)).rejects.toThrow('INVALID_PREF')
  await expect(
    setPref(s, ctx, 'itemizeAdjustmentModes', {tax: 'rate', tip: 'percent', service: 'percent', discount: 'amount'} as never),
  ).rejects.toThrow('INVALID_PREF')
})

test('prefFrom reads a value from loaded preference rows exactly as getPref reads the store', async () => {
  const keys = Object.keys(PREFS) as PrefKey[]
  const same = async () => {
    const rows = await s.getAll<{value: unknown}>('preference')
    for (const k of keys) expect(prefFrom(rows, k)).toEqual(await getPref(s, k))
  }
  await same()
  await setPref(s, ctx, 'tabs', ['people', 'groups', 'analytics', 'activity'])
  await setPref(s, ctx, 'homeTab', 'groups')
  await setPref(s, ctx, 'accent', '#7c3aed')
  await same()
  await resetPref(s, ctx, 'accent')
  await same()
  // A stored home tab the tab list no longer holds falls back to the first tab.
  await setPref(s, ctx, 'tabs', ['people', 'analytics', 'settings'])
  await same()
  expect(prefFrom([], 'defaultCurrency')).toBe('INR')
})

test('money input, cash rounding and money colours (F-310, F-402, F-1801)', async () => {
  expect(await getPref(s, 'amount.shorthand')).toBe(true)
  expect(await getPref(s, 'amount.keypad')).toBe(true)
  expect(await getPref(s, 'split.roundCash')).toBe(false)
  // The cash unit is kept per currency (F-112, audit M15): a ₹100 unit is not a €100 one.
  expect(await getPref(s, 'split.roundTo')).toEqual({})
  expect(await getPref(s, 'moneyPalette')).toBe('default')
  await setPref(s, ctx, 'split.roundTo', {INR: 100, JPY: 10})
  const unit = await getPref(s, 'split.roundTo')
  expect(roundToFor(unit, 'INR')).toBe(100)
  expect(roundToFor(unit, 'JPY')).toBe(10)
  expect(roundToFor(unit, 'EUR')).toBe(1)
  for (const bad of [10, {INR: 3}, {NOPE: 5}, {toString: 5}, null, []])
    await expect(setPref(s, ctx, 'split.roundTo', bad as never)).rejects.toThrow('INVALID_PREF')
  // A number stored by the old, account-wide pref reads as that unit for the default currency (INR unless set); a number that was never offered is the default.
  const legacy = (value: unknown) => s.transaction(tx => tx.put({type: 'preference', id: 'split.roundTo', data: {value}, version: 9, deleted: false, updatedAt: 1}))
  await legacy(100)
  expect(await getPref(s, 'split.roundTo')).toEqual({INR: 100})
  await setPref(s, ctx, 'defaultCurrency', 'EUR')
  expect(await getPref(s, 'split.roundTo')).toEqual({EUR: 100})
  await legacy(3)
  expect(await getPref(s, 'split.roundTo')).toEqual({})
  await expect(setPref(s, ctx, 'moneyPalette', 'red' as never)).rejects.toThrow('INVALID_PREF')
  expect(PREFS['amount.keypad'].scope).toBe('device')
})

test('privacy and invite-link defaults (26.18)', async () => {
  expect(await getPref(s, 'privacy.findByContact')).toBe(true)
  expect(await getPref(s, 'privacy.friendRequestsFrom')).toBe('everyone')
  expect(await getPref(s, 'invites.defaultMaxUses.friend')).toBe(1)
  expect(await getPref(s, 'invites.defaultMaxUses.group')).toBe(25)
  expect(await getPref(s, 'invites.defaultExpiry')).toBe('7d')
  expect(await getPref(s, 'invites.approveJoins')).toBe(false)
  await setPref(s, ctx, 'invites.defaultMaxUses.group', 'unlimited')
  expect(await getPref(s, 'invites.defaultMaxUses.group')).toBe('unlimited')
  await expect(setPref(s, ctx, 'invites.defaultMaxUses.friend', 7 as never)).rejects.toThrow('INVALID_PREF')
  await expect(setPref(s, ctx, 'invites.defaultExpiry', '1y' as never)).rejects.toThrow('INVALID_PREF')
  expect(PREFS['privacy.findByContact'].group).toBe('privacy')
  expect(INVITE_EXPIRY_MS['7d']).toBe(7 * 86_400_000)
})

/* F-115 m14: the timezone preference accepts only zones the runtime knows. */
test('timezone: device or a real IANA zone', async () => {
  expect(PREFS.timezone.validate('device')).toBe(true)
  expect(PREFS.timezone.validate('Asia/Kolkata')).toBe(true)
  expect(PREFS.timezone.validate('UTC')).toBe(true)
  expect(PREFS.timezone.validate('Not/AZone')).toBe(false)
  expect(PREFS.timezone.validate('')).toBe(false)
  expect(PREFS.timezone.validate(5)).toBe(false)
  await expect(setPref(s, ctx, 'timezone', 'Not/AZone')).rejects.toThrow('INVALID_PREF')
})

test('reset all skips a stored row for a removed preference (audit m6)', async () => {
  await setPref(s, ctx, 'theme', 'dark')
  await s.transaction(tx => tx.put({type: 'preference', id: 'settleMode', data: {value: 'x'}, version: 1, deleted: false, updatedAt: 1}))
  await resetAllPrefs(s, ctx)
  expect(await getPref(s, 'theme')).toBe('system')
})
