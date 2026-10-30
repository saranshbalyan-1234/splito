import {CURRENCIES, DomainError} from '@splito/domain'

import {
  type ChargePreset,
  DEFAULT_CHARGE_PRESETS,
  DEFAULT_TAX_CLASSES,
  isChargePresets,
  isMerchantSetups,
  isTaxClasses,
  type MerchantSetup,
  type TaxClass,
} from './bill'
import type {Store, Tx} from './store'
import type {Entity, MutationCtx} from './types'

export type PrefGroup = 'appearance' | 'navigation' | 'defaults' | 'categories' | 'regional' | 'notifications' | 'privacy'
  /* Groups with no Settings page (F-251): remembered state set where it acts, and the invite defaults on Friends and invites. */
  | 'lists' | 'invites' | 'app'

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
export type TabId = 'people' | 'groups' | 'analytics' | 'activity' | 'settings'
/**
 * Every item of the shared sidebar / drawer list (ARCHITECTURE 26.3), in its
 * order; the phone bottom bar shows any number of them. There is no Home (owner 198), Ask Splito is
 * not an item (owner 200) and Settings is a tab (owner 206).
 */
export type NavItemId = TabId
/** How People and Groups order their rows (owner 199): the newest change, by name, the biggest balance, the newest record. */
export type ListSort = 'lastActive' | 'name' | 'amount' | 'newest'
export const LIST_SORTS: readonly ListSort[] = ['lastActive', 'name', 'amount', 'newest']
/** How each itemised-bill charge is typed: money, or a percentage of the items. */
export type AdjustmentModes = Record<'tax' | 'tip' | 'service' | 'discount', 'amount' | 'percent'>
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

/** The shared list's order: People, Groups, Analytics, Activity, Settings. */
export const NAV_ITEM_IDS: readonly NavItemId[] = ['people', 'groups', 'analytics', 'activity', 'settings']
/** The tabs that hold the user's data: what the app can open on (Settings cannot be the start tab). */
const START_TAB_IDS = ['people', 'groups', 'analytics', 'activity'] as const satisfies readonly TabId[]
/** The default bar before owners 198 and 206 (it had Home and no Settings): a saved list that is exactly this was never customised, so it reads as the new default. */
const OLD_DEFAULT_BAR = 'home,people,groups,analytics,activity'
/** What Activity can be filtered by (owner 173): "transactions" in an address is `expenses` and `payments` together. */
export const ACTIVITY_TYPE_IDS = ['expenses', 'payments', 'comments', 'groups', 'friends', 'reminders', 'disputes'] as const
export type ActivityTypeId = (typeof ACTIVITY_TYPE_IDS)[number]

/** The bottom bar holds any number of tabs, from one item to every item (decision 84). */
export const MIN_TABS = 1
export const MAX_TABS = NAV_ITEM_IDS.length
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
  /** How money direction is coloured (F-1801); every palette also shows it by sign, arrow and words. */
  moneyPalette: def('moneyPalette', 'appearance', 'account', 'Money colours', 'default', oneOf('default', 'colorblind', 'mono')),
  motion: def('motion', 'appearance', 'device', 'Animations', 'full', oneOf('full', 'reduced', 'off')),
  haptics: def('haptics', 'appearance', 'device', 'Haptics', true, isBool),
  /** The Send feedback sheet's "Include app info" switch remembers the last choice (spec default: on). */
  'feedback.includeAppInfo': def('feedback.includeAppInfo', 'app', 'device', 'Include app info with feedback', true, isBool),
  /* The phone bottom bar: any number of items of the shared nav list (26.3, decision 84). A saved list naming the old 'home' or 'ask' reads without them (`readRaw`). */
  tabs: def<NavItemId[]>(
    'tabs',
    'navigation',
    'account',
    'Bottom bar',
    [...NAV_ITEM_IDS],
    (v): v is NavItemId[] =>
      Array.isArray(v) &&
      v.length >= MIN_TABS &&
      v.length <= MAX_TABS &&
      new Set(v).size === v.length &&
      v.every(t => NAV_ITEM_IDS.includes(t)),
  ),
  /** The tab the app opens on (owner 198: People). Stored as `homeTab` until F-256: that old row is read once (`readRaw`); a saved 'home' reads as People. */
  startTab: def<TabId>('startTab', 'navigation', 'account', 'Open on', 'people', oneOf<TabId>(...START_TAB_IDS)),
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
  /** F-402: new equal, shares and percent splits start rounded to whole cash units. */
  'split.roundCash': def('split.roundCash', 'defaults', 'account', 'Round shares to cash', false, isBool),
  /** The cash unit those splits round to, per currency, in whole units (INR 10 is ₹10, JPY 100 is ¥100); a currency not listed rounds to 1 (F-112, audit M15). */
  'split.roundTo': def<RoundToByCurrency>('split.roundTo', 'defaults', 'account', 'Round to', {}, isRoundToByCurrency),
  analyticsPeriod: def('analyticsPeriod', 'defaults', 'account', 'Analytics period', 'year', oneOf('week', 'month', 'year', 'all')),
  analyticsView: def('analyticsView', 'defaults', 'device', 'Analytics view', 'charts', oneOf('charts', 'table')),
  /** F-1901: the one-time "install Splito" hint on the web has been shown; set by the app, no Settings row. */
  'pwa.installHintDismissed': def('pwa.installHintDismissed', 'app', 'device', 'Install hint shown', false, isBool),
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
  /* Itemize bills (F-403): tax classes, charge setups and how a round-off is shared. */
  'bill.taxClasses': def<TaxClass[]>('bill.taxClasses', 'defaults', 'account', 'Tax classes', DEFAULT_TAX_CLASSES, isTaxClasses),
  'bill.chargePresets': def<ChargePreset[]>('bill.chargePresets', 'defaults', 'account', 'Charge presets', DEFAULT_CHARGE_PRESETS, isChargePresets),
  /** The preset a new itemised bill starts from (an id of `bill.chargePresets`; Simple is the four plain rows). */
  'bill.defaultPreset': def('bill.defaultPreset', 'defaults', 'account', 'New bills start with', 'simple', isString),
  /** The 200 most recent merchant setups; written by "Save as preset", cleared with Reset. */
  'bill.merchantSetups': def<MerchantSetup[]>('bill.merchantSetups', 'defaults', 'account', 'Merchant setups', [], isMerchantSetups),
  // Registry order is the order Settings shows each group's items in.
  language: def('language', 'regional', 'account', 'Language', 'en', oneOf('en', 'hi')),
  timezone: def('timezone', 'regional', 'account', 'Timezone', 'device', isTimeZone),
  weekStart: def('weekStart', 'regional', 'account', 'Week starts on', 1, oneOf(0, 1, 6)),
  dateFormat: def('dateFormat', 'regional', 'account', 'Date format', 'auto', oneOf('auto', 'dmy', 'mdy', 'ymd')),
  numberLocale: def('numberLocale', 'regional', 'account', 'Number format', 'auto', oneOf('auto', 'en-IN', 'en-US', 'de-DE', 'fr-FR')),
  /** F-1816: Bluesky's language dropdown on the web splash, sign-up and the desktop right column. */
  /** People's order (owner 199, its own Sort button). A saved 'recent' reads as 'lastActive' (`readRaw`). */
  peopleSort: def<ListSort>('peopleSort', 'lists', 'account', 'Sort people by', 'lastActive', oneOf(...LIST_SORTS)),
  includeGroupsDefault: def('includeGroupsDefault', 'lists', 'account', 'Include groups by default', true, isBool),
  /** Groups I have hidden from my own lists (decision 89); set from a group's menu, personal to my account, no Settings row. */
  'groups.hidden': def<string[]>('groups.hidden', 'lists', 'account', 'Hidden groups', [], (v): v is string[] => Array.isArray(v) && v.length <= 1000 && v.every(isString) && new Set(v).size === v.length),
  /**
   * Deleted items I have hidden from my own lists (decisions 104, 105, 106): one id each, personal to my account, set
   * from a deleted row's or page's "Hide"; "Show hidden" brings them back with "Unhide". Never changes anything for others.
   */
  // ponytail: id set in one pref, move to a personal table if it grows past a few thousand
  'lists.hiddenItems': def<string[]>('lists.hiddenItems', 'lists', 'account', 'Hidden deleted items', [], (v): v is string[] => Array.isArray(v) && v.length <= 5000 && v.every(isString) && new Set(v).size === v.length),
  /**
   * Settle up leaves disputed and held amounts out of a group's plan by default (F-1210, owner 119); the groups listed
   * here put them back ("Include disputed"). One id each, remembered per group, set on the Settle screen, no Settings row.
   */
  'group:settleIncludeDisputed': def<string[]>('group:settleIncludeDisputed', 'lists', 'account', 'Groups whose Settle up includes disputed amounts', [], (v): v is string[] => Array.isArray(v) && v.length <= 1000 && v.every(isString) && new Set(v).size === v.length),
  /** The one "Show hidden" filter of People, Groups, a group's Expenses and a person's history (decision 105): off, hidden deleted items and hidden groups stay out of the lists. */
  'lists.showHidden': def('lists.showHidden', 'lists', 'account', 'Show hidden', false, isBool),
  /** F-1413 (owner 90, 112): fully settled friends / groups are hidden from Home and Groups unless this is on. Set from each filter sheet's "Show settled". */
  /** Home's Overview scope (26.12, owner 176): every balance, only the groups' parts, or only the direct ones. Also `/?overview=`. */
  'home.overviewScope': def<'all' | 'groups' | 'direct'>('home.overviewScope', 'lists', 'account', 'Overview scope', 'all', oneOf('all', 'groups', 'direct')),
  'people.showSettled': def('people.showSettled', 'lists', 'account', 'Show settled friends', false, isBool),
  /** Groups' order (owner 199). Stored as `groups.sort` (with 'recent') until F-272: that old row is read once (`readRaw`). */
  groupsSort: def<ListSort>('groupsSort', 'lists', 'account', 'Sort groups by', 'lastActive', oneOf(...LIST_SORTS)),
  'groups.showSettled': def('groups.showSettled', 'lists', 'account', 'Show settled groups', false, isBool),
  /** Activity's tab, All / Me / Others (owner 92, decision 90); saved on a tap, an address that names a tab wins. */
  'activity.tab': def('activity.tab', 'lists', 'account', 'Activity tab', 'all', oneOf('all', 'me', 'others')),
  /** Activity's Type filter (owner 173): the types shown; empty is every type. Saved on Apply, an address that names `type` wins. */
  'activity.type': def<ActivityTypeId[]>('activity.type', 'lists', 'account', 'Activity types', [], (v): v is ActivityTypeId[] => Array.isArray(v) && new Set(v).size === v.length && v.every(x => (ACTIVITY_TYPE_IDS as readonly unknown[]).includes(x))),
  /** One switch for "someone adds an expense with you or records a payment to or from you"; an old `notify.expense` of off still reads as off. */
  'notify.payment': def('notify.payment', 'notifications', 'account', 'Payments', true, isBool),
  'notify.comments': def('notify.comments', 'notifications', 'account', 'Comments and mentions', true, isBool),
  'notify.invite': def('notify.invite', 'notifications', 'account', 'Invites', true, isBool),
  /*
   * Local notifications (F-1907): they live on this device, so the switch does too: reminders you set (Remind me, F-1119).
   */
  'notify.reminders': def('notify.reminders', 'notifications', 'device', 'Reminders I set', true, isBool),
  /** Telemetry (16.1): off, nothing is sent. No Settings row until a vendor exists (A-046); recording still honours it. */
  sendDiagnostics: def('sendDiagnostics', 'privacy', 'device', 'Send diagnostics', true, isBool),
  // Privacy: the directory server enforces these; saved now, applied once you sign in.
  'privacy.findByContact': def('privacy.findByContact', 'privacy', 'account', 'Let people find me by email or phone', true, isBool),
  'privacy.friendRequestsFrom': def('privacy.friendRequestsFrom', 'invites', 'account', 'Who can send me friend requests', 'everyone', oneOf('everyone', 'link-only')),
  'invites.defaultMaxUses.friend': def<InviteMaxUses>('invites.defaultMaxUses.friend', 'invites', 'account', 'Friend invite link uses', 1, oneOf(...MAX_USES)),
  'invites.defaultMaxUses.group': def<InviteMaxUses>('invites.defaultMaxUses.group', 'invites', 'account', 'Group invite link uses', 25, oneOf(...MAX_USES)),
  /** Groups: new invite links make each join wait for an admin (26.18, default off). */
  'invites.approveJoins': def('invites.approveJoins', 'invites', 'account', 'Approve each group join', false, isBool),
  'invites.defaultExpiry': def<InviteExpiry>('invites.defaultExpiry', 'invites', 'account', 'Invite links expire after', '7d', oneOf('24h', '7d', '30d', 'never')),
} as const

export type PrefKey = keyof typeof PREFS
export type PrefValue<K extends PrefKey> = (typeof PREFS)[K] extends PrefDef<infer T> ? T : never

type PrefRow = Pick<Entity<{value: unknown}>, 'id' | 'deleted' | 'data'>

/** A saved sort from before F-272 called the newest change 'recent'. */
const sortOf = (v: unknown) => (v === 'recent' ? 'lastActive' : v)

function readRaw<K extends PrefKey>(rows: ReadonlyArray<PrefRow>, key: K): PrefValue<K> {
  const def = PREFS[key] as PrefDef<PrefValue<K>>
  const e = rows.find(p => p.id === key)
  let value = e && !e.deleted ? e.data.value : undefined
  if (key === 'tabs' && Array.isArray(value)) {
    // Orders saved while Profile was a tab predate the Analytics tab, so it joins them.
    const isPreAnalytics = value.includes('profile')
    const isOldDefault = value.join() === OLD_DEFAULT_BAR
    // Profile, Home (owner 198) and Ask Splito (owner 200) are not items now: a saved list loses them and keeps the order of the rest.
    const kept = (value as string[]).filter((t): t is NavItemId => (NAV_ITEM_IDS as readonly string[]).includes(t))
    value = isPreAnalytics && !kept.includes('analytics') ? [...kept, 'analytics'] : kept
    // The default bar lost Home and gained Settings (owners 198, 206): a saved bar that is exactly the old default never was customised, so it becomes the new one; any other choice keeps its tabs.
    if (isOldDefault) value = [...NAV_ITEM_IDS]
  }
  // The "Open on" tab was the `homeTab` key before F-256: read that old row once when there is no new one. A saved 'home' fails validation and reads as People.
  if (key === 'startTab' && value === undefined) {
    const old = rows.find(p => p.id === 'homeTab' && !p.deleted)?.data.value
    if (typeof old === 'string') value = old
  }
  if (key === 'peopleSort') value = sortOf(value)
  // Groups' order was `groups.sort` inside the Filters sheet before F-272: read that old row once when there is no new one.
  if (key === 'groupsSort') value = sortOf(value ?? rows.find(p => p.id === 'groups.sort' && !p.deleted)?.data.value)
  // The "New expenses" switch folded into "Payments" (owner 131): an old stored off on either reads as off.
  if (key === 'notify.payment' && value !== false && rows.some(p => p.id === 'notify.expense' && !p.deleted && p.data.value === false)) value = false
  // The account-wide unit saved before units were per currency (F-112) belongs to the default currency, where it was meant.
  if (key === 'split.roundTo' && typeof value === 'number' && (ROUND_TO_UNITS as readonly number[]).includes(value)) {
    const currency = readRaw(rows, 'defaultCurrency')
    value = value === 1 ? {} : {[currency]: value}
  }
  return value !== undefined && def.validate(value) ? (value as PrefValue<K>) : def.default
}

/**
 * A preference from already-loaded preference rows (`store.getAll('preference')`),
 * so many readers share one read. Falls back to the default when unset or invalid.
 */
export function prefFrom<K extends PrefKey>(rows: ReadonlyArray<PrefRow>, key: K): PrefValue<K> {
  const value = readRaw(rows, key)
  if (key === 'startTab') {
    const tabs = readRaw(rows, 'tabs')
    return (tabs.includes(value as TabId) ? value : PREFS.startTab.default) as PrefValue<K>
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
  await tx.put({type: 'preference', id: key, data: {value}, version: (prev?.version ?? 0) + 1, deleted, updatedAt: ctx.now()})
  if (def.scope === 'account') await enqueuePref(tx, ctx, key, prev?.version ?? 0, deleted, value)
  // The folded-in "New expenses" row would keep reading as off after Payments is changed here: this write is the latest word,
  // and its tombstone is queued too, so another device pulling the old row cannot win by its newer updatedAt.
  if (key === 'notify.payment') {
    const old = await tx.get('preference', 'notify.expense')
    if (old && !old.deleted) {
      await tx.put({...old, version: old.version + 1, deleted: true, updatedAt: ctx.now()})
      await enqueuePref(tx, ctx, 'notify.expense', old.version, true, null)
    }
  }
}

const enqueuePref = (tx: Tx, ctx: MutationCtx, id: string, baseVersion: number, deleted: boolean, value: unknown) =>
  tx.enqueue({
    opId: ctx.newId(),
    deviceId: ctx.deviceId,
    actor: ctx.actor,
    entityType: 'preference',
    entityId: id,
    opType: deleted ? 'preference.reset' : 'preference.set',
    baseVersion,
    payload: {value},
    schemaVersion: 1,
    deps: [],
    attempts: 0,
    nextAttemptAt: null,
    lastError: null,
  })

/**
 * Edits a list-of-ids preference inside the caller's transaction (read and write together, so two changes never
 * lose one another). Writes only when `edit` changes the list.
 */
export async function editIdsPref(tx: Tx, ctx: MutationCtx, key: 'lists.hiddenItems' | 'groups.hidden' | 'group:settleIncludeDisputed', edit: (ids: string[]) => string[]) {
  const row = await tx.get<{value: unknown}>('preference', key)
  const ids = prefFrom(row ? [row] : [], key)
  const next = edit(ids)
  if (next.length === ids.length && next.every((id, i) => id === ids[i])) return
  if (!PREFS[key].validate(next)) throw new DomainError('INVALID_PREF')
  await putPref(tx, ctx, key, next, false)
}

/** Takes ids out of `lists.hiddenItems` (a restored item is live again, so a hide no longer applies). */
export const unhideItems = (tx: Tx, ctx: MutationCtx, ids: string[]) =>
  editIdsPref(tx, ctx, 'lists.hiddenItems', cur => (cur.some(x => ids.includes(x)) ? cur.filter(x => !ids.includes(x)) : cur))

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

/** Remembers, for one group, whether Settle up includes disputed and held amounts (default: left out). */
export async function setSettleIncludeDisputed(store: Store, ctx: MutationCtx, groupId: string, include: boolean): Promise<void> {
  await store.transaction(tx =>
    editIdsPref(tx, ctx, 'group:settleIncludeDisputed', ids => (ids.includes(groupId) === include ? ids : include ? [...ids, groupId] : ids.filter(id => id !== groupId))),
  )
}
