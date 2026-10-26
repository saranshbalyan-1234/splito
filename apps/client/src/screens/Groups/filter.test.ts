import {expect, test} from 'bun:test'
import {type Entity, type Group} from '@splito/sync'

import {
  DEFAULT_GROUP_FILTERS,
  filterGroups,
  type GroupRowData,
  groupLastActive,
  matchesGroupSearch,
  sortGroups,
} from './filter'

const row = (
  id: string,
  name: string,
  kind: GroupRowData['kind'],
  balances: Record<string, bigint>,
  archived = false,
  members: string[] = [],
): GroupRowData => ({id, name, kind, archived, balances, members})

const rows: GroupRowData[] = [
  row('goa', 'Goa trip', 'trip', {INR: 5000n, EUR: -900n}, false, ['Arjun']),
  row('flat', 'Flat 4B', 'home', {INR: -12000n}, false, ['Kavya']),
  row('date', 'Date nights', 'couple', {INR: 0n}),
  row('old', 'Old trip', 'trip', {USD: 100n}, true),
]
const ids = (r: GroupRowData[]) => r.map(g => g.id)

test('defaults: active groups only, every kind and balance', () =>
  expect(ids(filterGroups(rows, DEFAULT_GROUP_FILTERS))).toEqual([
    'goa',
    'flat',
    'date',
  ]))

test('status, type and show filter on their own fields', () => {
  const f = DEFAULT_GROUP_FILTERS
  expect(ids(filterGroups(rows, {...f, status: 'archived'}))).toEqual(['old'])
  expect(ids(filterGroups(rows, {...f, type: 'trip'}))).toEqual(['goa'])
  expect(ids(filterGroups(rows, {...f, show: 'owed'}))).toEqual(['goa'])
  // Goa is owed in rupees but owes in euros: both directions keep it.
  expect(ids(filterGroups(rows, {...f, show: 'owe'}))).toEqual(['goa', 'flat'])
  expect(ids(filterGroups(rows, {...f, show: 'settled'}))).toEqual(['date'])
})

test('one currency keeps groups with a balance in it and trims the rest away', () => {
  const eur = filterGroups(rows, {...DEFAULT_GROUP_FILTERS, currency: 'EUR'})
  expect(ids(eur)).toEqual(['goa'])
  expect(eur[0]!.balances).toEqual({EUR: -900n})
})

test('sort: name, biggest balance in the currency, latest activity', () => {
  const active = filterGroups(rows, DEFAULT_GROUP_FILTERS)
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

test('last active is the newest change to the group or anything in it', () => {
  const ent = <T>(id: string, updatedAt: number, data: T) =>
    ({
      type: 'group',
      id,
      data,
      version: 1,
      deleted: false,
      updatedAt,
    }) as Entity<T>
  const groups = [
    ent('goa', 100, {} as Group),
    ent('flat', 300, {} as Group),
    ent('idle', 50, {} as Group),
  ]
  const latest = groupLastActive(groups, [
    ent('e1', 200, {groupId: 'goa'}),
    ent('e2', 900, {groupId: 'goa'}),
    ent('r1', 400, {groupId: 'flat'}),
    ent('e3', 999, {groupId: null}),
  ])
  expect(latest).toEqual(
    new Map([
      ['goa', 900],
      ['flat', 400],
      ['idle', 50],
    ]),
  )
})
