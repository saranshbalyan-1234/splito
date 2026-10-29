import {expect, test} from 'bun:test'
import {type PersonSummary} from '@splito/domain'

import {type Entity, type Person} from '@splito/sync'

import {filterFriends, type FriendRow, listedFriends, seenByPerson, sortFriends} from './sort'

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

test('recent: latest change first, never-active last by name', () =>
  // The newest change per person comes from the store (`lastActivity`, epoch ms): d has the latest, a next, b older; c has none.
  expect(
    sortFriends(rows, 'recent', {
      currency: 'INR',
      activity: new Map([
        ['d', 1_760_000_000_000],
        ['a', 1_750_000_000_000],
        ['b', 1_740_000_000_000],
      ]),
    }).map(r => r.id),
  ).toEqual(['d', 'a', 'b', 'c']))

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

/* F-112 m3: a currency a friend has had stays filterable once it is settled. */
test('a settled currency still filters, and is found under Settled', () => {
  const ids = (xs: FriendRow[]) => xs.map(r => r.id)
  const bob: FriendRow = {
    id: 'bob',
    name: 'Bob',
    summary: summary('bob', {INR: 500n}),
  }
  const seen = new Map([['bob', new Set(['INR', 'EUR'])]])
  const eur = filterFriends([bob], {currency: 'EUR', show: 'settled'}, seen)
  expect(ids(eur)).toEqual(['bob'])
  expect(eur[0]!.summary!.byCurrency.EUR).toEqual({
    total: 0n,
    direct: 0n,
    groups: {},
  })
  // Only a currency the friend has had counts, and a settled one is not "owes you".
  expect(
    ids(filterFriends([bob], {currency: 'USD', show: 'all'}, seen)),
  ).toEqual([])
  expect(
    ids(filterFriends([bob], {currency: 'EUR', show: 'owesYou'}, seen)),
  ).toEqual([])
  expect(ids(filterFriends([bob], {currency: 'EUR', show: 'settled'}))).toEqual(
    [],
  )
})

/* F-112 m3: with Include groups off, a currency a friend only has in groups does not count. */
test('seenByPerson leaves group-only currencies out when Include groups is off', () => {
  const seen = {
    bob: [
      {currency: 'EUR', groupId: 'lisbon'},
      {currency: 'INR', groupId: null},
      {currency: 'INR', groupId: 'goa'},
    ],
  }
  expect([...seenByPerson(seen, true).get('bob')!].sort()).toEqual([
    'EUR',
    'INR',
  ])
  expect([...seenByPerson(seen, false).get('bob')!]).toEqual(['INR'])
  const bob: FriendRow = {id: 'bob', name: 'Bob'}
  expect(
    filterFriends(
      [bob],
      {currency: 'EUR', show: 'settled'},
      seenByPerson(seen, false),
    ),
  ).toEqual([])
  expect(
    filterFriends(
      [bob],
      {currency: 'EUR', show: 'settled'},
      seenByPerson(seen, true),
    ).map(r => r.id),
  ).toEqual(['bob'])
})

const person = (id: string, name: string, removedAt?: number): Entity<Person> =>
  ({id, type: 'person', data: {name, isMe: false, ...(removedAt ? {removedAt} : {})}, deleted: false}) as unknown as Entity<Person>

test('a removed friend stays listed, marked Removed, while any currency is open, and leaves once settled', () => {
  const people = [person('a', 'Asha'), person('r1', 'Riya', 5), person('r2', 'Ravi', 5), person('me', 'Me')]
  people[3]!.data.isMe = true
  const byPerson = new Map([
    ['r1', summary('r1', {INR: 700n})],
    ['r2', summary('r2', {INR: 0n})],
  ])
  const listed = listedFriends(people, byPerson)
  expect(listed.map(r => [r.id, !!r.isRemoved])).toEqual([['a', false], ['r1', true]])
  expect(listed[1]!.summary?.byCurrency.INR?.total).toBe(700n)
})
