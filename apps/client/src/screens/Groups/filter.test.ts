import {expect, test} from 'bun:test'

import {
  DEFAULT_GROUP_FILTERS,
  filterGroups,
  type GroupRowData,
  matchesGroupSearch,
  sortGroups,
} from './filter'

const row = (
  id: string,
  name: string,
  kind: GroupRowData['kind'],
  balances: Record<string, bigint>,
  inactive = false,
  members: string[] = [],
  hidden = false,
  deleted = false,
): GroupRowData => ({id, name, kind, inactive, hidden, deleted, balances, members})

const rows: GroupRowData[] = [
  row('goa', 'Goa trip', 'trip', {INR: 5000n, EUR: -900n}, false, ['Arjun']),
  row('flat', 'Flat 4B', 'home', {INR: -12000n}, false, ['Kavya']),
  row('date', 'Date nights', 'couple', {INR: 0n}),
  row('old', 'Old trip', 'trip', {USD: 100n}, true),
  row('secret', 'Surprise party', 'other', {INR: 300n}, false, [], true),
  row('oldsecret', 'Old secret', 'other', {INR: 0n}, true, [], true),
  row('gone', 'Gone trip', 'trip', {}, false, [], false, true),
  row('gonehidden', 'Gone and hidden', 'trip', {}, false, [], true, true),
]
const ALL = {...DEFAULT_GROUP_FILTERS, showSettled: true}
const ids = (r: GroupRowData[]) => r.map(g => g.id)

test('defaults: active groups I have not hidden with something open, plus deleted ones I have not hidden (struck by the row), every kind', () =>
  expect(ids(filterGroups(rows, DEFAULT_GROUP_FILTERS))).toEqual([
    'goa',
    'flat',
    'gone',
  ]))

test('Show settled is off by default: a group settled up leaves the list, a new one stays, the Settled filter still finds it', () => {
  expect(DEFAULT_GROUP_FILTERS.showSettled).toBe(false)
  expect(ids(filterGroups(rows, DEFAULT_GROUP_FILTERS))).not.toContain('date')
  expect(ids(filterGroups(rows, ALL))).toContain('date')
  // A group with no balances yet is new, not settled up.
  expect(ids(filterGroups([row('new', 'New', 'trip', {})], DEFAULT_GROUP_FILTERS))).toEqual(['new'])
  expect(ids(filterGroups(rows, {...DEFAULT_GROUP_FILTERS, show: 'settled'}))).toEqual(['date', 'gone'])
})

test('status, type and show filter on their own fields', () => {
  const f = ALL
  expect(ids(filterGroups(rows, {...f, status: 'inactive'}))).toEqual(['old'])
  expect(ids(filterGroups(rows, {...f, status: 'all'}))).toEqual(['goa', 'flat', 'date', 'old', 'gone'])
  expect(ids(filterGroups(rows, {...f, type: 'trip'}))).toEqual(['goa', 'gone'])
  expect(ids(filterGroups(rows, {...f, show: 'owed'}))).toEqual(['goa'])
  // Goa is owed in rupees but owes in euros: both directions keep it.
  expect(ids(filterGroups(rows, {...f, show: 'owe'}))).toEqual(['goa', 'flat'])
  expect(ids(filterGroups(rows, {...f, show: 'settled'}))).toEqual(['date', 'gone'])
})

test('Show hidden is personal: hidden groups, deleted or not, leave the default view and come back with it on', () => {
  const f = ALL
  expect(f.showHidden).toBe(false)
  expect(ids(filterGroups(rows, {...f, showHidden: true}))).toEqual(['goa', 'flat', 'date', 'secret', 'gone', 'gonehidden'])
  expect(ids(filterGroups(rows, {...f, status: 'all', showHidden: true}))).toHaveLength(8)
  expect(ids(filterGroups(rows, {...f, status: 'inactive', showHidden: true}))).toEqual(['old', 'oldsecret'])
})

test('one currency keeps groups with a balance in it and trims the rest away', () => {
  const eur = filterGroups(rows, {...ALL, currency: 'EUR'})
  expect(ids(eur)).toEqual(['goa'])
  expect(eur[0]!.balances).toEqual({EUR: -900n})
})

test('sort: name, biggest balance in the currency, latest activity', () => {
  const active = filterGroups(rows, ALL).filter(g => !g.deleted)
  const ctx = {
    currency: 'INR',
    activity: new Map([
      ['date', 2000],
      ['goa', 1000],
    ]),
  }
  expect(ids(sortGroups(active, 'name', ctx))).toEqual(['date', 'flat', 'goa'])
  expect(ids(sortGroups(active, 'amount', ctx))).toEqual([
    'flat',
    'goa',
    'date',
  ])
  expect(ids(sortGroups(active, 'recent', ctx))).toEqual([
    'date',
    'goa',
    'flat',
  ])
})

test('search matches the group name or any member, ignoring case', () => {
  expect(matchesGroupSearch(rows[0]!, 'GOA')).toBe(true)
  expect(matchesGroupSearch(rows[0]!, 'arj')).toBe(true)
  expect(matchesGroupSearch(rows[1]!, 'arj')).toBe(false)
  expect(matchesGroupSearch(rows[1]!, '')).toBe(true)
})

/* F-112 m3: a settled currency stays filterable. */
test('a currency a group has had stays filterable once settled', () => {
  const lisbon = {...row('lis', 'Lisbon', 'trip', {INR: 100n}), currencies: ['EUR', 'INR']}
  const f = {...ALL, currency: 'EUR'}
  const settled = filterGroups([lisbon], {...f, show: 'settled'})
  expect(ids(settled)).toEqual(['lis'])
  expect(settled[0]!.balances).toEqual({EUR: 0n})
  expect(ids(filterGroups([lisbon], {...f, show: 'owed'}))).toEqual([])
  expect(ids(filterGroups([lisbon], {...f, currency: 'USD'}))).toEqual([])
})

test('a fully squared group (no open currency, records seen) is settled up; one with no records is new', () => {
  const squared = {...row('sq', 'Squared', 'trip', {}), currencies: ['INR']}
  expect(ids(filterGroups([squared], DEFAULT_GROUP_FILTERS))).toEqual([])
  expect(ids(filterGroups([squared], ALL))).toEqual(['sq'])
  expect(ids(filterGroups([row('fresh', 'Fresh', 'trip', {})], DEFAULT_GROUP_FILTERS))).toEqual(['fresh'])
})
