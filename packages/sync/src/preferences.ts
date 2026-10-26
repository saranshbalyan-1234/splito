import {CURRENCIES, DomainError} from '@splito/domain'

import type {Store} from './store'
import type {MutationCtx} from './types'

export type PrefGroup = 'appearance' | 'motion' | 'defaults' | 'categories' | 'regional' | 'lists' | 'notifications'

export interface PrefDef<T> {
  key: string
  group: PrefGroup
  /** device: stays on this device. account: syncs to every device. */
  scope: 'device' | 'account'
  default: T
  validate(v: unknown): v is T
  label: string
}

/** Bottom-bar / sidebar destinations. Profile and Settings open from the header avatar instead. */
export type TabId = 'people' | 'groups' | 'analytics' | 'activity'
export type SwipeAction = 'markRead' | 'hide' | 'delete' | 'none'

export interface Category {
  id: string
  name: string
  color: string
  icon: string
  order: number
  hidden: boolean
}

export const DEFAULT_CATEGORIES: Category[] = [
  ['food', 'Food', '#f97316', 'utensils'],
  ['transport', 'Transport', '#0ea5e9', 'car'],
  ['stay', 'Stay', '#8b5cf6', 'bed'],
  ['shopping', 'Shopping', '#ec4899', 'shopping-bag'],
  ['entertainment', 'Entertainment', '#eab308', 'ticket'],
  ['bills', 'Bills', '#64748b', 'receipt'],
  ['groceries', 'Groceries', '#22c55e', 'shopping-cart'],
  ['other', 'Other', '#94a3b8', 'circle'],
].map(([id, name, color, icon], order) => ({id: id!, name: name!, color: color!, icon: icon!, order, hidden: false}))

const TAB_IDS: TabId[] = ['people', 'groups', 'analytics', 'activity']
const HEX = /^#[0-9a-f]{6}$/i

const oneOf =
  <T extends string | number>(...xs: T[]) =>
  (v: unknown): v is T =>
    xs.includes(v as T)
const isBool = (v: unknown): v is boolean => typeof v === 'boolean'
const isString = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 64

function def<T>(key: string, group: PrefGroup, scope: PrefDef<T>['scope'], label: string, dflt: T, validate: (v: unknown) => v is T): PrefDef<T> {
  return {key, group, scope, label, default: dflt, validate}
}

export const PREFS = {
  theme: def('theme', 'appearance', 'account', 'Theme', 'system', oneOf('system', 'light', 'dark')),
  accent: def('accent', 'appearance', 'account', 'Accent colour', '#006AFF', (v): v is string => typeof v === 'string' && HEX.test(v)),
  textScale: def('textScale', 'appearance', 'device', 'Text size', 1, (v): v is number => typeof v === 'number' && v >= 0.85 && v <= 1.3),
  density: def('density', 'appearance', 'account', 'List density', 'comfortable', oneOf('comfortable', 'compact')),
  motion: def('motion', 'motion', 'device', 'Animations', 'full', oneOf('full', 'reduced', 'off')),
  haptics: def('haptics', 'motion', 'device', 'Haptics', true, isBool),
  tabs: def<TabId[]>(
    'tabs',
    'defaults',
    'account',
    'Tabs and order',
    [...TAB_IDS],
    // Any non-empty set works: Settings stays reachable from the header avatar on every tab.
    (v): v is TabId[] => Array.isArray(v) && v.length > 0 && new Set(v).size === v.length && v.every(t => TAB_IDS.includes(t)),
  ),
  homeTab: def<TabId>('homeTab', 'defaults', 'account', 'Home tab', 'people', oneOf(...TAB_IDS)),
  defaultCurrency: def('defaultCurrency', 'defaults', 'account', 'Default currency', 'INR', (v): v is string => typeof v === 'string' && v in CURRENCIES),
  defaultSplitMode: def('defaultSplitMode', 'defaults', 'account', 'Default split', 'equal', oneOf('equal', 'exact', 'percent', 'shares')),
  categories: def<Category[]>(
    'categories',
    'categories',
    'account',
    'Categories',
    DEFAULT_CATEGORIES,
    (v): v is Category[] =>
      Array.isArray(v) &&
      v.length > 0 &&
      new Set(v.map(c => c?.id)).size === v.length &&
      v.every(c => isString(c?.id) && isString(c?.name) && HEX.test(c?.color) && isString(c?.icon) && Number.isInteger(c?.order) && isBool(c?.hidden)),
  ),
  weekStart: def('weekStart', 'regional', 'account', 'Week starts on', 1, oneOf(0, 1, 6)),
  timezone: def('timezone', 'regional', 'account', 'Timezone', 'device', isString),
  language: def('language', 'regional', 'account', 'Language', 'en', oneOf('en', 'hi')),
  dateFormat: def('dateFormat', 'regional', 'account', 'Date format', 'auto', oneOf('auto', 'dmy', 'mdy', 'ymd')),
  numberLocale: def('numberLocale', 'regional', 'account', 'Number format', 'auto', oneOf('auto', 'en-IN', 'en-US', 'de-DE', 'fr-FR')),
  peopleSort: def('peopleSort', 'lists', 'account', 'Sort people by', 'amount', oneOf('amount', 'name', 'recent')),
  includeGroupsDefault: def('includeGroupsDefault', 'lists', 'account', 'Include groups by default', true, isBool),
  swipeLeft: def<SwipeAction>('swipeLeft', 'lists', 'account', 'Swipe left', 'delete', oneOf('markRead', 'hide', 'delete', 'none')),
  swipeRight: def<SwipeAction>('swipeRight', 'lists', 'account', 'Swipe right', 'markRead', oneOf('markRead', 'hide', 'delete', 'none')),
  'notify.expense': def('notify.expense', 'notifications', 'account', 'New expenses', true, isBool),
  'notify.payment': def('notify.payment', 'notifications', 'account', 'Payments', true, isBool),
  'notify.invite': def('notify.invite', 'notifications', 'account', 'Invites', true, isBool),
} as const

export type PrefKey = keyof typeof PREFS
export type PrefValue<K extends PrefKey> = (typeof PREFS)[K] extends PrefDef<infer T> ? T : never

async function readRaw<K extends PrefKey>(store: Store, key: K): Promise<PrefValue<K>> {
  const def = PREFS[key] as PrefDef<PrefValue<K>>
  const e = (await store.getAll<{value: unknown}>('preference')).find(p => p.id === key)
  return e && !e.deleted && def.validate(e.data.value) ? e.data.value : def.default
}

/** Falls back to the default when unset or invalid. */
export async function getPref<K extends PrefKey>(store: Store, key: K): Promise<PrefValue<K>> {
  const value = await readRaw(store, key)
  if (key === 'homeTab') {
    const tabs = await readRaw(store, 'tabs')
    return (tabs.includes(value as TabId) ? value : tabs[0]) as PrefValue<K>
  }
  return value
}

async function writePref(store: Store, ctx: MutationCtx, key: PrefKey, value: unknown, deleted: boolean) {
  const def = PREFS[key] as PrefDef<unknown>
  await store.transaction(async tx => {
    const prev = await tx.get('preference', key)
    const version = (prev?.version ?? 0) + 1
    await tx.put({type: 'preference', id: key, data: {value}, version, deleted, updatedAt: ctx.now()})
    if (def.scope === 'account')
      await tx.enqueue({
        opId: ctx.newId(),
        deviceId: ctx.deviceId,
        actor: ctx.actor,
        entityType: 'preference',
        entityId: key,
        opType: deleted ? 'preference.reset' : 'preference.set',
        baseVersion: prev?.version ?? 0,
        payload: {value},
        schemaVersion: 1,
        deps: [],
        attempts: 0,
        nextAttemptAt: null,
        lastError: null,
      })
  })
}

export async function setPref<K extends PrefKey>(store: Store, ctx: MutationCtx, key: K, value: PrefValue<K>): Promise<void> {
  if (!PREFS[key].validate(value)) throw new DomainError('INVALID_PREF')
  await writePref(store, ctx, key, value, false)
}

export async function resetPref(store: Store, ctx: MutationCtx, key: PrefKey): Promise<void> {
  await writePref(store, ctx, key, PREFS[key].default, true)
}

export async function resetAllPrefs(store: Store, ctx: MutationCtx): Promise<void> {
  const set = (await store.getAll('preference')).filter(p => !p.deleted)
  for (const p of set) await resetPref(store, ctx, p.id as PrefKey)
}
