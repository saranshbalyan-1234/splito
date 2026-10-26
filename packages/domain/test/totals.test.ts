import {describe, expect, test} from 'bun:test'

import {type BalanceRow, balanceTotals, groupBalances, magnitude, personSummary} from '../src/ledger'

const row = (person: string, groupId: string | null, currency: string, amount: bigint): BalanceRow => ({person, groupId, currency, amount})

describe('balanceTotals', () => {
  test('splits each currency into owed to me and owed by me, never mixing currencies', () => {
    const people = personSummary(
      [row('a', null, 'INR', 500n), row('b', 'g', 'INR', -200n), row('c', null, 'INR', 300n), row('b', null, 'EUR', -40n)],
      {includeGroups: true},
    )
    expect(balanceTotals(people)).toEqual([
      {currency: 'EUR', owed: 0n, owe: 40n, net: -40n},
      {currency: 'INR', owed: 800n, owe: 200n, net: 600n},
    ])
  })
  test('a person settled in a currency adds nothing', () =>
    expect(balanceTotals(personSummary([row('a', 'g', 'INR', 100n), row('a', null, 'INR', -100n)], {includeGroups: true}))).toEqual([
      {currency: 'INR', owed: 0n, owe: 0n, net: 0n},
    ]))
  test('no people, no totals', () => expect(balanceTotals([])).toEqual([]))
})

describe('groupBalances', () => {
  test('my net per group per currency, direct rows excluded', () =>
    expect(groupBalances([row('a', 'g1', 'INR', 300n), row('b', 'g1', 'INR', -100n), row('a', 'g2', 'EUR', -5n), row('a', null, 'INR', 999n)])).toEqual({
      g1: {INR: 200n},
      g2: {EUR: -5n},
    }))
})

describe('magnitude', () => {
  test('drops the sign', () => {
    expect(magnitude(-25n)).toBe(25n)
    expect(magnitude(25n)).toBe(25n)
    expect(magnitude(0n)).toBe(0n)
  })
})
