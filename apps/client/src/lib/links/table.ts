import {ROUTE_PATHS, type RouteName} from '#/routes'

/**
 * Everything that has a URL besides the pages of `ROUTE_PATHS` (ARCHITECTURE 26.3, F-241): in-page tabs, sheets
 * and the pickers inside them, and the global sheets. One table, read by the resolver, the sheet hooks and the
 * tests; a source scan in `table.test.ts` fails when a `useDialogControl({url})` names something missing here.
 */

/** In-page tabs: the path segment after the page (`/groups/:id/balances`); the first is the default and prints no segment. */
export const PAGE_TABS = {
  Group: ['expenses', 'balances', 'members'],
  Activity: ['all', 'me', 'others'],
} as const satisfies Partial<Record<RouteName, readonly string[]>>

/**
 * Pages whose bare path means "the tab I last used" (a saved preference, F-1213), so the first tab has a segment of
 * its own (`/activity/all`) that is written whenever it is named; Group's first tab is simply the default.
 */
export const PREF_TABS: readonly string[] = ['Activity']

export type TabbedPage = keyof typeof PAGE_TABS

/**
 * Sheets and popups under a page, as the path after it (`/people/:id/record-payment`). A picker inside a sheet
 * is the sheet's path plus its own segment (`record-payment/currency`), so a parent is always listed first.
 */
export const SHEETS = {
  People: ['filters'],
  Groups: ['filters'],
  Analytics: ['scope', 'range', 'export', 'export/period', 'export/range', 'export/group', 'export/person', 'export/currency'],
  Activity: ['filters'],
  Person: [
    'filters',
    'record-payment',
    'record-payment/currency',
    'pay-upi',
    'edit',
    'call-it-even',
    'export',
    'export/period',
    'export/range',
    'export/group',
    'export/person',
    'export/currency',
  ],
  Group: [
    'filters',
    'add-members',
    'edit',
    'edit/currency',
    'rules',
    'export',
    'export/period',
    'export/range',
    'export/group',
    'export/person',
    'export/currency',
  ],
  Profile: ['edit'],
  SettingsSection: ['accent', 'currency', 'timezone', 'category', 'tax-class', 'export', 'export/period', 'export/range', 'export/group', 'export/person', 'export/currency', 'import'],
  CreateGroup: ['currency'],
  AddExpense: ['currency', 'date', 'category', 'group', 'people', 'payers', 'charge', 'tax-class'],
  EditExpense: ['currency', 'date', 'category', 'group', 'people', 'payers', 'charge', 'tax-class'],
} as const satisfies Partial<Record<RouteName, readonly string[]>>

/** A Settings editor opens only on the page that hosts its control (`/settings/regional/timezone`, never `/settings/appearance/timezone`). */
export const SETTINGS_SECTION_SHEETS: Record<string, readonly string[]> = {
  appearance: ['accent'],
  defaults: ['currency', 'tax-class'],
  categories: ['category'],
  regional: ['timezone'],
  /* Your data (owner 205) hosts the Export and Import sheets. */
  data: ['export', 'export/period', 'export/range', 'export/group', 'export/person', 'export/currency', 'import'],
}

/** Sheets that open over whatever page is showing: they belong to the shell, not a page. */
export const GLOBAL_SHEETS = ['search', 'feedback', 'install'] as const
export type GlobalSheet = (typeof GLOBAL_SHEETS)[number]

/**
 * The global sheets that print as a query on the page they cover (`?feedback=new`); Search prints as `/search`. There is
 * no side drawer (owner 217), so an old `?drawer=menu` is an unknown key and the page opens without it.
 */
export const QUERY_SHEETS = {feedback: 'new', install: 'help'} as const satisfies Partial<Record<GlobalSheet, string>>


/** The names in a page pattern: `/people/:personId` -> ['personId']. */
export function pathParamNames(name: string): string[] {
  const pattern = (ROUTE_PATHS as Record<string, string | undefined>)[name]
  return pattern ? [...pattern.matchAll(/:(\w+)/g)].map(m => m[1]!) : []
}

export function isPageSheet(name: string, chain: readonly string[], params?: Record<string, string>): boolean {
  const list = (SHEETS as Record<string, readonly string[]>)[name]
  if (!list || !list.includes(chain.join('/'))) return false
  if (name !== 'SettingsSection' || !params) return true
  return (SETTINGS_SECTION_SHEETS[params.section ?? ''] ?? []).includes(chain.join('/'))
}

export function isGlobalSheet(chain: readonly string[]): boolean {
  return chain.length === 1 && (GLOBAL_SHEETS as readonly string[]).includes(chain[0]!)
}

export function isSheetChain(name: string, chain: readonly string[]): boolean {
  return isGlobalSheet(chain) || isPageSheet(name, chain)
}

/** The route name Splito shows a link's page as: Search is not a page (26.3), it is the Search & Ask sheet over the page it was opened from. */
export type PageName = Exclude<RouteName, 'Search'>

/**
 * The query keys each page reads from its address (list state, prefill, one-shot hints); every other key is dropped
 * by the resolver, so a link can carry nothing a page does not look at.
 */
export const QUERY_KEYS: Partial<Record<PageName, readonly string[]>> = {
  /* `from`: the tab a main screen was opened from, so a refresh keeps its Back (owner 179, 184). */
  /* `overview` is the Overview's scope at the top (owners 176, 198). */
  People: ['show', 'sort', 'currency', 'groups', 'settled', 'hidden', 'from'],
  Groups: ['type', 'status', 'show', 'currency', 'sort', 'settled', 'hidden', 'from'],
  Person: ['groups'],
  Analytics: ['currency', 'period', 'offset', 'from', 'to', 'scope', 'overview'],
  /* `type=transactions` (Recent transactions' "See all", owners 173, 179), `group=<id>` from a Group's "See all" (F-259); `from` is the tab a pushed copy opened from. */
  /* `since`, `until`, `currency`, `category` and `scope` are the record filters Analytics' links carry (owner 226); not `from`/`to`, which name the origin tab here. */
  Activity: ['type', 'group', 'person', 'from', 'since', 'until', 'currency', 'category', 'scope'],
  AddExpense: ['personId', 'groupId', 'title', 'amount', 'currency'],
  SettingsSection: ['note'],
  FriendsAndInvites: ['section'],
  CreateInvite: ['kind', 'groupId'],
}

/** Page params that name an entity: a UUID, or a demo-set id (`demo-large-...`). */
const ENTITY_ID = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|demo-large-[a-z0-9-]{1,48})$/i
export const isEntityId = (value: string) => ENTITY_ID.test(value)

const PATH_KEYS: Record<string, (value: string) => boolean> = {
  personId: isEntityId,
  groupId: isEntityId,
  expenseId: isEntityId,
  repaymentId: isEntityId,
  /** Invite codes are 16 lower-case characters (`mintInviteCode`); older ones may be longer or upper-case. */
  code: v => /^[A-Za-z0-9]{6,64}$/.test(v),
  section: v => /^[a-z][a-z-]{0,31}$/.test(v),
  step: v => /^[1-5]$/.test(v),
}
export function isValidPathParam(key: string, value: string): boolean {
  return (PATH_KEYS[key] ?? (() => false))(value)
}

/** Query keys that carry an entity id; checked like a path param. */
export const ENTITY_QUERY_KEYS = ['personId', 'groupId', 'group', 'person'] as const

/** Pages that are formSheet / modal routes on a phone: nothing opens over them from a link (ARCHITECTURE 4, one native modal). */
const COMPOSER_PAGES: readonly string[] = ['AddExpense', 'EditExpense', 'CreateGroup']

/**
 * What a phone opens of a link's sheet chain: the first sheet, never a picker inside it, and nothing over a
 * composer (its pickers are dialogs over a native modal). The in-sheet picker hand-over is being fixed on iOS
 * (fix/ios-wB); until then a link to a picker opens its parent.
 */
export function nativeSheets(name: string, chain: readonly string[]): string[] {
  if (COMPOSER_PAGES.includes(name)) return []
  return chain.slice(0, 1)
}
