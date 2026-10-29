import {expect, test} from 'bun:test'
import {readdirSync, readFileSync, statSync} from 'node:fs'
import {join} from 'node:path'

import {GLOBAL_SHEETS, SHEETS} from './table'

const SRC = join(import.meta.dir, '../..')

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sources(path)
    return /\.tsx?$/.test(name) && !/\.test\./.test(name) ? [path] : []
  })
}
const all = sources(SRC).map(path => ({path, text: readFileSync(path, 'utf8')}))

/** Every `useDialogControl({url: '...'})` in the app. */
const used = new Set(all.flatMap(f => [...f.text.matchAll(/useDialogControl\(\{[^}]*?url: '([^']+)'/g)].map(m => m[1]!)))

test('every sheet a host binds to a URL is in the table, and every table entry has a host', () => {
  const listed = new Set<string>([...GLOBAL_SHEETS, ...Object.values(SHEETS).flat()])
  for (const url of used) expect([url, listed.has(url)]).toEqual([url, true])
  /* The side drawer is the shell's own state (`state/shell/drawer-open.tsx`), not a Dialog. */
  for (const url of listed) expect([url, used.has(url) || url === 'drawer']).toEqual([url, true])
})

/*
 * The ledger of every form sheet (F-241 acceptance 1: "a test asserts every sheet component has a route"): each
 * `FormSheet.Outer` testID is either addressable (its host binds a URL above) or listed here with the reason it
 * is not. A new sheet fails this test until it is one or the other.
 */
const NOT_ADDRESSABLE: Record<string, string> = {
  'call-even-sheet': 'Group: one transfer row opens it with that transfer as its draft; Person: addressable (call-it-even)',
  'payment-details-sheet': 'a quick peek at one payment; the payment has its own page (/payment/:id)',
  'member-exit-sheet': 'needs the member it is about; opened from a member row',
  'remind-sheet': 'needs the expense, person or group it reminds about; opened by the Remind menu item',
  'remind-me-sheet': 'needs the thing it reminds you about; opened by the Remind me menu item',
  'select-sheet': 'the generic dropdown of a Select (its options belong to the control that owns it)',
  'friends-filters-sheet': 'addressable: People filters (url filters)',
  'groups-filters-sheet': 'addressable: Groups filters (url filters)',
}

test('every form sheet is addressable or listed with its reason', () => {
  const ids = all.flatMap(f => [...f.text.matchAll(/<FormSheet\.Outer[^>]*?testID="([^"]+)"/g)].map(m => m[1]!))
  expect(ids.length).toBeGreaterThan(20)
  const unlisted = ids.filter(id => !(id in NOT_ADDRESSABLE) && !ADDRESSABLE.has(id))
  expect(unlisted).toEqual([])
})

/** Form sheets whose host passes a `url` (checked against `used` above by the first test). */
const ADDRESSABLE = new Set([
  'feedback-sheet',
  'import-sheet',
  'export-sheet',
  'history-filter-sheet',
  'analytics-range-dialog',
  'analytics-scope-sheet',
  'date-dialog',
  'payers-dialog',
  'currency-dialog',
  'category-dialog',
  'group-dialog',
  'charge-sheet',
  'people-dialog',
  'class-picker',
  'accent-sheet',
  'category-sheet',
  'taxclass-sheet',
  'edit-group-sheet',
  'add-members-sheet',
  'rules-sheet',
  'record-payment-sheet',
  'upi-sheet',
  'edit-friend-sheet',
  'search-ask-sheet',
  'install-help-sheet',
])
