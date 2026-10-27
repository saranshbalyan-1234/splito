import {CURRENCIES, DomainError} from '@splito/domain'

import type {Store, Tx} from './store'
import type {Entity, MutationCtx} from './types'

export type PrefGroup = 'appearance' | 'motion' | 'navigation' | 'defaults' | 'categories' | 'regional' | 'lists' | 'notifications' | 'privacy' | 'history'

export interface PrefDef<T> {
  key: string
  group: PrefGroup
  /** device: stays on this device. account: syncs to every device. */
  scope: 'device' | 'account'
  default: T
  validate(v: unknown): v is T
  label: string
}

/**
 * The tab destinations (routes of their own). Activity was briefly a header
 * bell; lists stored before then still name 'activity' and read back unchanged.
 */
export type TabId = 'people' | 'groups' | 'analytics' | 'activity'
/**
 * Every item of the shared sidebar / drawer list (ARCHITECTURE 26.3), in its
 * order. The phone bottom bar shows 2 to 5 of them, Home first; 'ask' opens
 * the Search & Ask drawer and 'settings' the Settings page.
 */
export type NavItemId = TabId | 'ask' | 'settings'
/** How each itemised-bill charge is typed: money, or a percentage of the items. */
export type AdjustmentModes = Record<'tax' | 'tip' | 'service' | 'discount', 'amount' | 'percent'>
export type SwipeAction = 'markRead' | 'hide' | 'delete' | 'none'
/**
 * Which expenses Analytics counts (ARCHITECTURE 26.16): 'everything', or
 * non-group expenses on or off plus every group or a chosen list. Never empty.
 */
export type AnalyticsScope = 'everything' | {nonGroup: boolean; groups: 'all' | string[]}

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
  ['entertainment', 'Entertainment', '#f59e0b', 'ticket'],
  ['bills', 'Bills', '#84cc16', 'receipt'],
  ['groceries', 'Groceries', '#14b8a6', 'shopping-cart'],
  ['other', 'Other', '#94a3b8', 'circle'],
].map(([id, name, color, icon], order) => ({id: id!, name: name!, color: color!, icon: icon!, order, hidden: false}))

const TAB_IDS: TabId[] = ['people', 'groups', 'analytics', 'activity']
/** The shared list's order: Home, Groups, Analytics, Ask Splito, Activity, Settings. */
export const NAV_ITEM_IDS: readonly NavItemId[] = ['people', 'groups', 'analytics', 'ask', 'activity', 'settings']
/** The bottom bar holds 2 to 5 tabs, as Bluesky's. */
export const MIN_TABS = 2
export const MAX_TABS = 5
const HEX = /^#[0-9a-f]{6}$/i

const oneOf =
  <T extends string | number>(...xs: T[]) =>
  (v: unknown): v is T =>
    xs.includes(v as T)
const isBool = (v: unknown): v is boolean => typeof v === 'boolean'
const isString = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 64

/** `device`, or an IANA zone this runtime knows (F-115 m14: an unknown one would throw while rendering dates). */
const isTimeZone = (v: unknown): v is string => {
  if (v === 'device') return true
  if (!isString(v)) return false
  try {
    new Intl.DateTimeFormat('en', {timeZone: v})
    return true
  } catch {
    return false
  }
}

const isAnalyticsScope = (v: unknown): v is AnalyticsScope => {
  if (v === 'everything') return true
  if (typeof v !== 'object' || v === null) return false
  const {nonGroup, groups} = v as {nonGroup?: unknown; groups?: unknown}
  if (!isBool(nonGroup)) return false
  if (groups === 'all') return true
  return Array.isArray(groups) && groups.length <= 1000 && groups.every(isString) && new Set(groups).size === groups.length && (nonGroup || groups.length > 0)
}

/** The cash units on offer, in whole currency units. */
export const ROUND_TO_UNITS = [1, 5, 10, 50, 100] as const
export type RoundToByCurrency = Record<string, number>
const isRoundToByCurrency = (v: unknown): v is RoundToByCurrency =>
  typeof v === 'object' && v !== null && !Array.isArray(v) && Object.entries(v).every(([c, n]) => Object.hasOwn(CURRENCIES, c) && (ROUND_TO_UNITS as readonly unknown[]).includes(n))

/** The cash unit `currency` rounds to, in whole units (1 when none is set). */
export const roundToFor = (units: RoundToByCurrency, currency: string): number => (Object.hasOwn(units, currency) ? units[currency]! : 1)

function def<T>(key: string, group: PrefGroup, scope: PrefDef<T>['scope'], label: string, dflt: T, validate: (v: unknown) => v is T): PrefDef<T> {
  return {key, group, scope, label, default: dflt, validate}
}

/** Invite-link limits (26.18): uses per link, and how long it works. */
export type InviteMaxUses = 1 | 5 | 25 | 'unlimited'
export type InviteExpiry = '24h' | '7d' | '30d' | 'never'
const MAX_USES: InviteMaxUses[] = [1, 5, 25, 'unlimited']

/** The expiry choice as a lifetime in ms (null: never). */
export const INVITE_EXPIRY_MS: Record<InviteExpiry, number | null> = {
  '24h': 86_400_000,
  '7d': 7 * 86_400_000,
  '30d': 30 * 86_400_000,
  never: null,
}

export const PREFS = {
  theme: def('theme', 'appearance', 'account', 'Theme', 'system', oneOf('system', 'light', 'dark')),
  /** Which dark theme `dark` (and `system` at night) uses: Bluesky's dim or its blackish dark. */
  darkTheme: def('darkTheme', 'appearance', 'account', 'Dark theme', 'dim', oneOf('dim', 'dark')),
  accent: def('accent', 'appearance', 'account', 'Accent colour', '#006AFF', (v): v is string => typeof v === 'string' && HEX.test(v)),
  textScale: def('textScale', 'appearance', 'device', 'Text size', 1, (v): v is number => typeof v === 'number' && v >= 0.85 && v <= 1.3),
  density: def('density', 'appearance', 'account', 'List density', 'comfortable', oneOf('comfortable', 'compact')),
  /** How money direction is coloured (F-1801); every palette also shows it by sign, arrow and words. */
  moneyPalette: def('moneyPalette', 'appearance', 'account', 'Money colours', 'default', oneOf('default', 'colorblind', 'mono')),
  motion: def('motion', 'motion', 'device', 'Animations', 'full', oneOf('full', 'reduced', 'off')),
  haptics: def('haptics', 'motion', 'device', 'Haptics', true, isBool),
  /** Phones only: shaking the phone opens Send feedback. */
  shakeToFeedback: def('shakeToFeedback', 'motion', 'device', 'Shake to send feedback', false, isBool),
  /** The Send feedback sheet's "Include app info" switch remembers the last choice (spec default: on). */
  'feedback.includeAppInfo': def('feedback.includeAppInfo', 'privacy', 'device', 'Include app info with feedback', true, isBool),
  /* The phone bottom bar: 2-5 items of the shared nav list, Home first and always on (26.3). */
  tabs: def<NavItemId[]>(
    'tabs',
    'navigation',
    'account',
    'Bottom bar',
    [...TAB_IDS],
    (v): v is NavItemId[] =>
      Array.isArray(v) &&
      v.length >= MIN_TABS &&
      v.length <= MAX_TABS &&
      v[0] === 'people' &&
      new Set(v).size === v.length &&
      v.every(t => NAV_ITEM_IDS.includes(t)),
  ),
  homeTab: def<TabId>('homeTab', 'navigation', 'account', 'Open on', 'people', oneOf(...TAB_IDS)),
  defaultCurrency: def('defaultCurrency', 'defaults', 'account', 'Default currency', 'INR', (v): v is string => typeof v === 'string' && v in CURRENCIES),
  itemizeAdjustmentModes: def<AdjustmentModes>(
    'itemizeAdjustmentModes',
    'defaults',
    'account',
    'Itemize charges',
    {tax: 'percent', tip: 'percent', service: 'percent', discount: 'amount'},
    (v): v is AdjustmentModes =>
      typeof v === 'object' &&
      v !== null &&
      (['tax', 'tip', 'service', 'discount'] as const).every(k => ['amount', 'percent'].includes((v as Record<string, unknown>)[k] as string)),
  ),
  defaultSplitMode: def('defaultSplitMode', 'defaults', 'account', 'Default split', 'equal', oneOf('equal', 'exact', 'percent', 'shares')),
  /** F-402: new equal, shares and percent splits start rounded to whole cash units. */
  'split.roundCash': def('split.roundCash', 'defaults', 'account', 'Round shares to cash', false, isBool),
  /** The cash unit those splits round to, per currency, in whole units (INR 10 is ₹10, JPY 100 is ¥100); a currency not listed rounds to 1 (F-112, audit M15). */
  'split.roundTo': def<RoundToByCurrency>('split.roundTo', 'defaults', 'account', 'Round to', {}, isRoundToByCurrency),
  /** F-310: the calculator keypad replaces the system keyboard for amounts on phones (Expensify's number pad). */
  'amount.keypad': def('amount.keypad', 'defaults', 'device', 'Amount keypad', true, isBool),
  analyticsPeriod: def('analyticsPeriod', 'defaults', 'account', 'Analytics period', 'year', oneOf('week', 'month', 'year', 'all')),
  analyticsView: def('analyticsView', 'defaults', 'device', 'Analytics view', 'charts', oneOf('charts', 'table')),
  /** F-1901: the one-time "install Splito" hint on the web has been shown; set by the app, no Settings row. */
  'pwa.installHintDismissed': def('pwa.installHintDismissed', 'defaults', 'device', 'Install hint shown', false, isBool),
  /** The last scope chosen on Analytics' scope chip; set there, not in Settings. */
  analyticsScope: def<AnalyticsScope>('analyticsScope', 'defaults', 'device', 'Analytics scope', 'everything', isAnalyticsScope),
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
  // Registry order is the order Settings shows each group's items in.
  language: def('language', 'regional', 'account', 'Language', 'en', oneOf('en', 'hi')),
  timezone: def('timezone', 'regional', 'account', 'Timezone', 'device', isTimeZone),
  weekStart: def('weekStart', 'regional', 'account', 'Week starts on', 1, oneOf(0, 1, 6)),
  dateFormat: def('dateFormat', 'regional', 'account', 'Date format', 'auto', oneOf('auto', 'dmy', 'mdy', 'ymd')),
  numberLocale: def('numberLocale', 'regional', 'account', 'Number format', 'auto', oneOf('auto', 'en-IN', 'en-US', 'de-DE', 'fr-FR')),
  /** F-310: amounts read 2k, 1.5L, 1cr and 2m. */
  'amount.shorthand': def('amount.shorthand', 'regional', 'account', 'Amount shortcuts', true, isBool),
  peopleSort: def('peopleSort', 'lists', 'account', 'Sort people by', 'amount', oneOf('amount', 'name', 'recent')),
  includeGroupsDefault: def('includeGroupsDefault', 'lists', 'account', 'Include groups by default', true, isBool),
  /** The small sync dot on expense, payment and request rows (ARCHITECTURE 9.8); detail pages always say it in words. */
  showSyncStatus: def('showSyncStatus', 'lists', 'device', 'Show sync status on rows', true, isBool),
  swipeLeft: def<SwipeAction>('swipeLeft', 'lists', 'account', 'Swipe left', 'delete', oneOf('markRead', 'hide', 'delete', 'none')),
  swipeRight: def<SwipeAction>('swipeRight', 'lists', 'account', 'Swipe right', 'markRead', oneOf('markRead', 'hide', 'delete', 'none')),
  /** Search keeps your last searches on this device only, like Bluesky's history. */
  rememberSearches: def('rememberSearches', 'lists', 'device', 'Remember recent searches', true, isBool),
  'notify.expense': def('notify.expense', 'notifications', 'account', 'New expenses', true, isBool),
  'notify.payment': def('notify.payment', 'notifications', 'account', 'Payments', true, isBool),
  'notify.invite': def('notify.invite', 'notifications', 'account', 'Invites', true, isBool),
  /** Telemetry (16.1): off, nothing is sent. No Settings row until a vendor exists (A-046); recording still honours it. */
  sendDiagnostics: def('sendDiagnostics', 'privacy', 'device', 'Send diagnostics', true, isBool),
  /** How long Recently deleted lists a deleted expense, payment or write-off (F-1203). */
  'history.binDays': def('history.binDays', 'history', 'account', 'Keep deleted items for', 30, oneOf(7, 30, 90, 365)),
  // Privacy: the directory server enforces these; saved now, applied once you sign in.
  'privacy.findByContact': def('privacy.findByContact', 'privacy', 'account', 'Let people find me by email or phone', true, isBool),
  'privacy.friendRequestsFrom': def('privacy.friendRequestsFrom', 'privacy', 'account', 'Who can send me friend requests', 'everyone', oneOf('everyone', 'link-only')),
  'invites.defaultMaxUses.friend': def<InviteMaxUses>('invites.defaultMaxUses.friend', 'privacy', 'account', 'Friend invite link uses', 1, oneOf(...MAX_USES)),
  'invites.defaultMaxUses.group': def<InviteMaxUses>('invites.defaultMaxUses.group', 'privacy', 'account', 'Group invite link uses', 25, oneOf(...MAX_USES)),
  /** Groups: new invite links make each join wait for an admin (26.18, default off). */
  'invites.approveJoins': def('invites.approveJoins', 'privacy', 'account', 'Approve each group join', false, isBool),
  'invites.defaultExpiry': def<InviteExpiry>('invites.defaultExpiry', 'privacy', 'account', 'Invite links expire after', '7d', oneOf('24h', '7d', '30d', 'never')),
} as const

export type PrefKey = keyof typeof PREFS
export type PrefValue<K extends PrefKey> = (typeof PREFS)[K] extends PrefDef<infer T> ? T : never

type PrefRow = Pick<Entity<{value: unknown}>, 'id' | 'deleted' | 'data'>

function readRaw<K extends PrefKey>(rows: ReadonlyArray<PrefRow>, key: K): PrefValue<K> {
  const def = PREFS[key] as PrefDef<PrefValue<K>>
  const e = rows.find(p => p.id === key)
  let value = e && !e.deleted ? e.data.value : undefined
  if (key === 'tabs' && Array.isArray(value)) {
    // Orders saved while Profile was a tab predate the Analytics tab, so it joins them.
    const isPreAnalytics = value.includes('profile')
    // Profile left the tabs for the header avatar; the rest keep their order.
    value = value.filter(t => NAV_ITEM_IDS.includes(t))
    if (isPreAnalytics && !(value as TabId[]).includes('analytics')) value = [...(value as TabId[]), 'analytics']
    // Home became fixed (26.3): orders saved before then keep their tabs, with Home first.
    value = ['people', ...(value as NavItemId[]).filter(t => t !== 'people')]
  }
  return value !== undefined && def.validate(value) ? (value as PrefValue<K>) : def.default
}

/**
 * A preference from already-loaded preference rows (`store.getAll('preference')`),
 * so many readers share one read. Falls back to the default when unset or invalid.
 */
export function prefFrom<K extends PrefKey>(rows: ReadonlyArray<PrefRow>, key: K): PrefValue<K> {
  const value = readRaw(rows, key)
  if (key === 'homeTab') {
    const tabs = readRaw(rows, 'tabs')
    return (tabs.includes(value as TabId) ? value : 'people') as PrefValue<K>
  }
  return value
}

/** Falls back to the default when unset or invalid. */
export async function getPref<K extends PrefKey>(store: Store, key: K): Promise<PrefValue<K>> {
  return prefFrom(await store.getAll<{value: unknown}>('preference'), key)
}

async function putPref(tx: Tx, ctx: MutationCtx, key: PrefKey, value: unknown, deleted: boolean) {
  const def = PREFS[key] as PrefDef<unknown>
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
}

const writePref = (store: Store, ctx: MutationCtx, key: PrefKey, value: unknown, deleted: boolean) =>
  store.transaction(tx => putPref(tx, ctx, key, value, deleted))

export async function setPref<K extends PrefKey>(store: Store, ctx: MutationCtx, key: K, value: PrefValue<K>): Promise<void> {
  if (!PREFS[key].validate(value)) throw new DomainError('INVALID_PREF')
  await writePref(store, ctx, key, value, false)
}

export async function resetPref(store: Store, ctx: MutationCtx, key: PrefKey): Promise<void> {
  await writePref(store, ctx, key, PREFS[key].default, true)
}

export async function resetAllPrefs(store: Store, ctx: MutationCtx): Promise<void> {
  // A stored row for a removed preference (old build) has no definition: skip it. One transaction: all or none.
  const set = (await store.getAll('preference')).filter(p => !p.deleted && Object.hasOwn(PREFS, p.id))
  await store.transaction(async tx => {
    for (const p of set) await putPref(tx, ctx, p.id as PrefKey, PREFS[p.id as PrefKey].default, true)
  })
}
