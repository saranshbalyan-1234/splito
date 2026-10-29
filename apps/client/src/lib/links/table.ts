import {ROUTE_PATHS, type RouteName} from '#/routes'

/**
 * Everything that has a URL besides the pages of `ROUTE_PATHS` (ARCHITECTURE 26.3, F-241): in-page tabs, sheets
 * and the pickers inside them, and the global drawers. One table, read by the resolver, the sheet hooks and the
 * tests; a source scan in `table.test.ts` fails when a `useDialogControl({url})` names something missing here.
 */

/** In-page tabs: the path segment after the page (`/groups/:id/balances`); the first is the default and prints no segment. */
export const PAGE_TABS = {
  Group: ['expenses', 'balances', 'members'],
  Activity: ['all', 'others'],
} as const satisfies Partial<Record<RouteName, readonly string[]>>

export type TabbedPage = keyof typeof PAGE_TABS

/**
 * Sheets and popups under a page, as the path after it (`/people/:id/record-payment`). A picker inside a sheet
 * is the sheet's path plus its own segment (`record-payment/currency`), so a parent is always listed first.
 */
export const SHEETS = {
  People: ['filters'],
  Groups: ['filters'],
  Analytics: ['scope', 'range'],
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
  Settings: ['export', 'export/period', 'export/range', 'export/group', 'export/person', 'export/currency', 'import'],
  SettingsSection: ['accent', 'currency', 'timezone', 'category', 'tax-class'],
  CreateGroup: ['currency'],
  AddExpense: ['currency', 'date', 'category', 'group', 'people', 'payers', 'charge', 'tax-class'],
  EditExpense: ['currency', 'date', 'category', 'group', 'people', 'payers', 'charge', 'tax-class'],
} as const satisfies Partial<Record<RouteName, readonly string[]>>

/** Sheets that open over whatever page is showing: they belong to the shell, not a page. */
export const GLOBAL_SHEETS = ['search', 'drawer', 'feedback', 'install'] as const
export type GlobalSheet = (typeof GLOBAL_SHEETS)[number]

/** The global sheets that print as a query on the page they cover (`?drawer=menu`); Search prints as `/search`. */
export const QUERY_SHEETS = {drawer: 'menu', feedback: 'new', install: 'help'} as const satisfies Partial<Record<GlobalSheet, string>>

/** Settings pages whose name is a sheet of Settings itself (`/settings/export`), not a section. */
export const SETTINGS_SHEET_SEGMENTS = ['export', 'import'] as const

/** The names in a page pattern: `/people/:personId` -> ['personId']. */
export function pathParamNames(name: string): string[] {
  const pattern = (ROUTE_PATHS as Record<string, string | undefined>)[name]
  return pattern ? [...pattern.matchAll(/:(\w+)/g)].map(m => m[1]!) : []
}

export function isPageSheet(name: string, chain: readonly string[]): boolean {
  const list = (SHEETS as Record<string, readonly string[]>)[name]
  return !!list && list.includes(chain.join('/'))
}

export function isGlobalSheet(chain: readonly string[]): boolean {
  return chain.length === 1 && (GLOBAL_SHEETS as readonly string[]).includes(chain[0]!)
}

export function isSheetChain(name: string, chain: readonly string[]): boolean {
  return isGlobalSheet(chain) || isPageSheet(name, chain)
}

/** The route name Splito shows a link's page as: Search is not a page (26.3), it is the Search & Ask sheet over Home. */
export type PageName = Exclude<RouteName, 'Search'>
