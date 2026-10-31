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
  for (const url of listed) expect([url, used.has(url)]).toEqual([url, true])
})

/*
 * The ledger of every form sheet (F-241 acceptance 1: "a test asserts every sheet component has a route"): each
 * `FormSheet.Outer` testID is either addressable (its host binds a URL above) or listed here with the reason it
 * is not. A new sheet fails this test until it is one or the other.
 */
const NOT_ADDRESSABLE: Record<string, string> = {
  'payment-details-sheet': 'a quick peek at one payment; the payment has its own page (/payment/:id)',
  'member-exit-sheet': 'needs the member it is about; opened from a member row',
  'remind-sheet': 'needs the expense, person or group it reminds about; opened by the Remind menu item',
  'remind-me-sheet': 'needs the thing it reminds you about; opened by the Remind me menu item',
  'dispute-sheet': 'needs the record (and item) it is about; opened by the Dispute and Put on hold menu items',
  'dispute-answer-sheet': 'needs the dispute it answers; opened by Reject and Reopen',
  'select-sheet': 'the generic dropdown of a Select (its options belong to the control that owns it)',
}

test('every form sheet is addressable or listed with its reason', () => {
  const ids = all.flatMap(f => [...f.text.matchAll(/<FormSheet\.Outer[^>]*?testID="([^"]+)"/g)].map(m => m[1]!))
  expect(ids.length).toBeGreaterThan(20)
  const unlisted = ids.filter(id => !(id in NOT_ADDRESSABLE) && !(id in ADDRESSABLE))
  expect(unlisted).toEqual([])
  // A sheet is in one list, not both.
  for (const id of Object.keys(ADDRESSABLE)) expect([id, id in NOT_ADDRESSABLE]).toEqual([id, false])
})

test('every addressable sheet names the url its host binds, and that url is bound somewhere', () => {
  for (const [testID, url] of Object.entries(ADDRESSABLE)) {
    expect([testID, used.has(url) || GLOBAL_SHEETS.includes(url as never)]).toEqual([testID, true])
    expect([testID, [...Object.values(SHEETS).flat(), ...GLOBAL_SHEETS].includes(url as never)]).toEqual([testID, true])
  }
})

/** Form sheet testID -> the `url` its host passes to `useDialogControl` (checked against `used` above). */
const ADDRESSABLE: Record<string, string> = {
  'feedback-sheet': 'feedback',
  'install-help-sheet': 'install',
  'import-sheet': 'import',
  'export-sheet': 'export',
  'history-filter-sheet': 'filters',
  'group-filter-sheet': 'filters',
  'analytics-range-dialog': 'range',
  'analytics-scope-sheet': 'scope',
  'date-dialog': 'date',
  'payers-dialog': 'payers',
  'currency-dialog': 'currency',
  'category-dialog': 'category',
  'group-dialog': 'group',
  'charge-sheet': 'charge',
  'people-dialog': 'people',
  'class-picker': 'tax-class',
  'accent-sheet': 'accent',
  'category-sheet': 'category',
  'taxclass-sheet': 'tax-class',
  'edit-group-sheet': 'edit',
  'add-members-sheet': 'add-members',
  'rules-sheet': 'rules',
  'record-payment-sheet': 'record-payment',
  'upi-sheet': 'pay-upi',
  'edit-friend-sheet': 'edit',
  'timezone-dialog': 'timezone',
  'friends-filters-sheet': 'filters',
  'groups-filters-sheet': 'filters',
  'activity-filters-sheet': 'filters',
  'call-even-sheet': 'call-it-even',
}
