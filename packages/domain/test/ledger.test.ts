import {describe, expect, test} from 'bun:test'
import fc from 'fast-check'

import {balanceRows, expenseNet, type ExpenseRecord, groupNet, type LedgerRecord, pairwiseBalances, personSummary, type RepaymentRecord, splitPayment} from '../src/ledger'
import {planSettlement} from '../src/settlement'
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
    ).toEqual([{person: 'x', groupId: null, currency: 'INR', amount: 100n}]))
  test('payers who each pay their own share owe nobody (no rounding residue)', () => {
    const e = exp({id: 'e', groupId: null, currency: 'INR', total: 30000n, payers: {me: 10000n, b: 10000n, c: 10000n}, shares: {me: 10000n, b: 10000n, c: 10000n}})
    expect(pairwiseBalances([e], 'me')).toEqual([])
    expect(pairwiseBalances([e], 'b')).toEqual([])
  })
  test('uneven payers, equal split: only real debts appear', () => {
    const e = exp({id: 'e', groupId: null, currency: 'INR', total: 100000n, payers: {me: 33333n, b: 33333n, c: 33334n}, shares: {me: 33334n, b: 33333n, c: 33333n}})
    expect(pairwiseBalances([e], 'b')).toEqual([])
    expect(pairwiseBalances([e], 'me')).toEqual([{person: 'c', groupId: null, currency: 'INR', amount: -1n}])
  })
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

describe('expenseNet (one expense, one person)', () => {
  test('paid minus share: lent, borrowed, not involved', () => {
    const e = {payers: {me: 300n, x: 0n}, shares: {me: 100n, x: 100n, y: 100n}}
    expect(expenseNet(e, 'me')).toBe(200n)
    expect(expenseNet(e, 'x')).toBe(-100n)
    expect(expenseNet(e, 'z')).toBe(0n)
  })
  test('matches the group net for a single expense', () =>
    fc.assert(
      fc.property(fc.bigInt({min: 1n, max: 10n ** 9n}), fc.integer({min: 1, max: 6}), (total, k) => {
        const people = Array.from({length: k}, (_, i) => `p${i}`)
        const shares = computeShares(total, {mode: 'equal', participants: people})
        const e = exp({id: 'e', groupId: 'g', currency: 'INR', total, payers: {p0: total}, shares})
        const net = groupNet([e], 'g').INR!
        for (const p of people) expect(expenseNet(e, p)).toBe(net[p] ?? 0n)
      }),
    ))
})

describe('balanceRows: one source of truth for group balances', () => {
  // The review's case: rounding and simplification made People, the group header and Settle disagree.
  const odd = exp({id: 'o', groupId: 'g', currency: 'INR', total: 185n, payers: {b: 82n, d: 103n}, shares: {a: 78n, b: 58n, c: 20n, d: 29n}})
  const members = ['a', 'b', 'c', 'd']
  const mine = (records: LedgerRecord[], who: string) =>
    sum(balanceRows(records, who).filter(r => r.groupId === 'g').map(r => r.amount))

  test("each member's group rows add up to their group net (header = Balances tab)", () => {
    for (const m of members) expect(mine([odd], m)).toBe(groupNet([odd], 'g').INR![m] ?? 0n)
  })
  test('recording the settle-up plan clears every member everywhere', () => {
    const plan = planSettlement(groupNet([odd], 'g').INR!, {allowListOnly: false, edges: {}}, 'direct')
    if (plan.status !== 'ok') throw new Error('plan')
    const paid = [odd, ...plan.transfers.map(t => rep({...t, groupId: 'g', currency: 'INR'}))]
    for (const m of members) expect(balanceRows(paid, m)).toEqual([])
  })
  test('group rows follow the group rules, and fall back to no rules when they leave no plan', () => {
    const e = exp({id: 'r', groupId: 'g', currency: 'INR', total: 300n, payers: {a: 300n}, shares: {a: 100n, b: 100n, c: 100n}})
    expect(balanceRows([e], 'a', {g: {allowListOnly: false, edges: {}}}).map(r => [r.person, r.amount])).toEqual([
      ['b', 100n],
      ['c', 100n],
    ])
    expect(balanceRows([e], 'b', {g: {allowListOnly: true, edges: {}}})).toEqual([{person: 'a', groupId: 'g', currency: 'INR', amount: -100n}])
  })
  test('direct records stay pair by pair', () => expect(balanceRows([direct, grp], 'me')).toEqual(pairwiseBalances([direct, grp], 'me')))
})

describe('splitPayment: a payment settles the parts owed in its direction, never nets across groups', () => {
  const owed = [
    {groupId: 'g1', amount: 100n},
    {groupId: null, amount: 30n},
    {groupId: 'g2', amount: 50n},
  ]
  test('direct first, then each group in turn', () =>
    expect(splitPayment(150n, owed)).toEqual([
      {groupId: null, amount: 30n},
      {groupId: 'g1', amount: 100n},
      {groupId: 'g2', amount: 20n},
    ]))
  test('anything over goes to direct', () =>
    expect(splitPayment(200n, owed)).toEqual([
      {groupId: null, amount: 50n},
      {groupId: 'g1', amount: 100n},
      {groupId: 'g2', amount: 50n},
    ]))
  test('nothing owed this way: all direct', () => expect(splitPayment(40n, [])).toEqual([{groupId: null, amount: 40n}]))
  test('always adds up to the payment, every part positive', () =>
    fc.assert(
      fc.property(fc.bigInt({min: 1n, max: 10n ** 6n}), fc.array(fc.bigInt({min: 0n, max: 10n ** 5n}), {maxLength: 4}), (amount, xs) => {
        const parts = splitPayment(
          amount,
          xs.map((v, i) => ({groupId: i === 0 ? null : `g${i}`, amount: v})),
        )
        expect(sum(parts.map(p => p.amount))).toBe(amount)
        expect(parts.every(p => p.amount > 0n)).toBe(true)
      }),
    ))
})
