import {describe, expect, test} from 'bun:test'
import fc from 'fast-check'

import {type ExpenseRecord, groupNet, type LedgerRecord, pairwiseBalances, personSummary, type RepaymentRecord} from '../src/ledger'
import {computeShares} from '../src/split'

const exp = (e: Omit<ExpenseRecord, 'kind' | 'date' | 'deleted'>): ExpenseRecord => ({kind: 'expense', date: '2026-01-01', deleted: false, ...e})
const rep = (r: Omit<RepaymentRecord, 'kind' | 'date' | 'deleted' | 'id'>): RepaymentRecord => ({kind: 'repayment', id: 'r' + Math.random(), date: '2026-01-02', deleted: false, ...r})
const sum = (xs: bigint[]) => xs.reduce((a, b) => a + b, 0n)

const direct = exp({id: 'e1', groupId: null, currency: 'INR', total: 200n, payers: {me: 200n}, shares: {me: 100n, x: 100n}})
const grp = exp({id: 'e2', groupId: 'g1', currency: 'INR', total: 100n, payers: {me: 100n}, shares: {me: 50n, x: 50n}})
const usd = exp({id: 'e3', groupId: null, currency: 'USD', total: 1000n, payers: {me: 1000n}, shares: {me: 500n, x: 500n}})

describe('people aggregation (A04)', () => {
  test('direct + group = 150 INR', () =>
    expect(personSummary(pairwiseBalances([direct, grp], 'me'), {includeGroups: true})[0]!.byCurrency.INR).toEqual({
      total: 150n,
      direct: 100n,
      groups: {g1: 50n},
    }))
  test('include groups off = 100', () =>
    expect(personSummary(pairwiseBalances([direct, grp], 'me'), {includeGroups: false})[0]!.byCurrency.INR!.total).toBe(100n))
  test('other currency separate', () => {
    const s = personSummary(pairwiseBalances([direct, grp, usd], 'me'), {includeGroups: true})[0]!
    expect(Object.keys(s.byCurrency).sort()).toEqual(['INR', 'USD'])
    expect(s.byCurrency.USD!.total).toBe(500n)
  })
  test('group-only person hidden when groups excluded', () =>
    expect(personSummary(pairwiseBalances([grp], 'me'), {includeGroups: false})).toEqual([]))
})

describe('pairwiseBalances', () => {
  test('partial repayment', () =>
    expect(pairwiseBalances([direct, rep({from: 'x', to: 'me', amount: 40n, groupId: null, currency: 'INR'})], 'me')[0]!.amount).toBe(60n))
  test('you owe is negative', () =>
    expect(pairwiseBalances([exp({id: 'e', groupId: null, currency: 'INR', total: 100n, payers: {x: 100n}, shares: {me: 100n}})], 'me')).toEqual([
      {person: 'x', groupId: null, currency: 'INR', amount: -100n},
    ]))
  test('deleted skipped', () => expect(pairwiseBalances([{...direct, deleted: true}], 'me')).toEqual([]))
  test('multi-payer pairwise', () =>
    expect(
      pairwiseBalances([exp({id: 'e', groupId: null, currency: 'INR', total: 300n, payers: {me: 200n, y: 100n}, shares: {me: 100n, x: 100n, y: 100n}})], 'me'),
    ).toEqual([
      {person: 'x', groupId: null, currency: 'INR', amount: 67n},
      {person: 'y', groupId: null, currency: 'INR', amount: 34n},
    ]))
  test('debts between others ignored', () =>
    expect(pairwiseBalances([exp({id: 'e', groupId: 'g', currency: 'INR', total: 100n, payers: {x: 100n}, shares: {y: 100n}})], 'me')).toEqual([]))
})

const members = ['a', 'b', 'c', 'd']
const arbGroupRecords = fc.array(
  fc.oneof(
    fc
      .tuple(fc.constantFrom(...members), fc.subarray(members, {minLength: 1}), fc.bigInt({min: 1n, max: 100000n}), fc.constantFrom('INR', 'USD'))
      .map(([payer, ps, total, currency]): LedgerRecord =>
        exp({id: 'e' + Math.random(), groupId: 'g', currency, total, payers: {[payer]: total}, shares: computeShares(total, {mode: 'equal', participants: ps})}),
      ),
    fc
      .tuple(fc.constantFrom(...members), fc.constantFrom(...members), fc.bigInt({min: 1n, max: 1000n}))
      .map(([from, to, amount]): LedgerRecord => rep({from, to, amount, groupId: 'g', currency: 'INR'})),
  ),
)

describe('groupNet', () => {
  test('sums to zero per currency', () =>
    fc.assert(fc.property(arbGroupRecords, rs => Object.values(groupNet(rs, 'g')).every(m => sum(Object.values(m)) === 0n))))
  test('paid minus share', () =>
    expect(groupNet([grp], 'g1')).toEqual({INR: {me: 50n, x: -50n}}))
  test('repayment moves net toward zero', () =>
    expect(groupNet([grp, rep({from: 'x', to: 'me', amount: 50n, groupId: 'g1', currency: 'INR'})], 'g1')).toEqual({INR: {me: 0n, x: 0n}}))
})
