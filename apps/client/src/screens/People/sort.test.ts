import {expect, test} from 'bun:test'
import {type LedgerRecord, type PersonSummary} from '@splito/domain'

import {filterFriends, type FriendRow, lastActivity, sortFriends} from './sort'

const summary = (
  person: string,
  totals: Record<string, bigint>,
): PersonSummary => ({
  person,
  byCurrency: Object.fromEntries(
    Object.entries(totals).map(([c, total]) => [
      c,
      {total, direct: total, groups: {}},
    ]),
  ),
})
const rows: FriendRow[] = [
  {id: 'a', name: 'Asha', summary: summary('a', {INR: 500n})},
  {id: 'b', name: 'Bilal', summary: summary('b', {INR: -9000n})},
  {id: 'c', name: 'Chen', summary: summary('c', {USD: 100n})},
  {id: 'd', name: 'Dev'},
]

test('amount: biggest default-currency balance first, owed or owing; other currencies next', () =>
  expect(
    sortFriends(rows, 'amount', {currency: 'INR', activity: new Map()}).map(
      r => r.id,
    ),
  ).toEqual(['b', 'a', 'c', 'd']))

test('recent: latest shared record first, never-active last by name', () => {
  const records: LedgerRecord[] = [
    {
      kind: 'repayment',
      id: 'r',
      groupId: null,
      currency: 'INR',
      from: 'me',
      to: 'd',
      amount: 1n,
      date: '2026-10-20',
      deleted: false,
    },
    {
      kind: 'expense',
      id: 'e',
      groupId: null,
      currency: 'INR',
      total: 2n,
      payers: {a: 2n},
      shares: {a: 1n, me: 1n},
      date: '2026-09-01',
      deleted: false,
    },
    {
      kind: 'expense',
      id: 'x',
      groupId: null,
      currency: 'INR',
      total: 2n,
      payers: {b: 2n},
      shares: {b: 2n},
      date: '2026-12-01',
      deleted: true,
    },
  ]
  expect(
    sortFriends(rows, 'recent', {
      currency: 'INR',
      activity: lastActivity(records),
    }).map(r => r.id),
  ).toEqual(['d', 'a', 'b', 'c'])
})

test('name: alphabetical', () =>
  expect(
    sortFriends([...rows].reverse(), 'name', {
      currency: 'INR',
      activity: new Map(),
    }).map(r => r.id),
  ).toEqual(['a', 'b', 'c', 'd']))

test('filterFriends: one currency keeps only that currency; show picks a direction', () => {
  const ids = (xs: FriendRow[]) => xs.map(r => r.id)
  expect(ids(filterFriends(rows, {currency: 'all', show: 'all'}))).toEqual([
    'a',
    'b',
    'c',
    'd',
  ])
  const inr = filterFriends(rows, {currency: 'INR', show: 'all'})
  expect(ids(inr)).toEqual(['a', 'b'])
  // Other currencies leave the summary, so the row and the totals show INR only.
  expect(Object.keys(inr[0]!.summary!.byCurrency)).toEqual(['INR'])
  expect(ids(filterFriends(rows, {currency: 'all', show: 'owesYou'}))).toEqual([
    'a',
    'c',
  ])
  expect(ids(filterFriends(rows, {currency: 'all', show: 'youOwe'}))).toEqual([
    'b',
  ])
  expect(ids(filterFriends(rows, {currency: 'all', show: 'settled'}))).toEqual([
    'd',
  ])
  expect(ids(filterFriends(rows, {currency: 'USD', show: 'youOwe'}))).toEqual(
    [],
  )
})

/* F-113 M10: owed directly and owing in a group is open both ways, not settled. */
test('a friend whose direct and group parts net to zero is open both ways', () => {
  const both: FriendRow[] = [
    {
      id: 'e',
      name: 'Esha',
      summary: {
        person: 'e',
        byCurrency: {INR: {total: 0n, direct: 1000n, groups: {g: -1000n}}},
      },
    },
  ]
  const kept = (show: 'owesYou' | 'youOwe' | 'settled') =>
    filterFriends(both, {currency: 'all', show}).map(r => r.id)
  expect(kept('settled')).toEqual([])
  expect(kept('owesYou')).toEqual(['e'])
  expect(kept('youOwe')).toEqual(['e'])
})
