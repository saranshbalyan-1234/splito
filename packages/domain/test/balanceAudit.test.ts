import {describe, expect, test} from 'bun:test'

import {
  balanceRows,
  balanceSides,
  balanceTotals,
  type ExpenseRecord,
  groupNet,
  isSettledBalance,
  personSummary,
  writeOffParts,
} from '../src/ledger'
import {directPlan, planSettlement, type SettlementRules} from '../src/settlement'

/* F-113: regressions for logic-audit findings (docs/audit/AUDIT-2026-10-27.md). */

const exp = (e: Omit<ExpenseRecord, 'kind' | 'date' | 'deleted'>): ExpenseRecord => ({kind: 'expense', date: '2026-01-01', deleted: false, ...e})

describe('M10: a friend owed one way directly and the other way in a group is not settled', () => {
  // Bob owes me 10 directly; I owe Bob 10 in group G.
  const records = [
    exp({id: 'd', groupId: null, currency: 'INR', total: 20n, payers: {me: 20n}, shares: {me: 10n, bob: 10n}}),
    exp({id: 'g', groupId: 'G', currency: 'INR', total: 20n, payers: {bob: 20n}, shares: {me: 10n, bob: 10n}}),
  ]
  const [bob] = personSummary(balanceRows(records, 'me'), {includeGroups: true})
  const inr = bob!.byCurrency.INR!

  test('the net is zero, but the parts are open', () => {
    expect(inr.total).toBe(0n)
    expect(isSettledBalance(inr)).toBe(false)
    expect(balanceSides(inr)).toEqual({owed: 10n, owe: 10n})
  })
  test('Overview totals add each part in its own direction', () =>
    expect(balanceTotals([bob!])).toEqual([{currency: 'INR', owed: 10n, owe: 10n, net: 0n}]))
  test('only parts that are all zero are settled', () =>
    expect(isSettledBalance({direct: 0n, groups: {G: 0n}})).toBe(true))
})

describe('M11: one plan policy when the rules leave no plan', () => {
  // I pay 300 for me, a and b; the rules allow nobody to pay anybody.
  const rules: SettlementRules = {allowListOnly: true, edges: {}}
  const records = [exp({id: 'e', groupId: 'G', currency: 'INR', total: 300n, payers: {me: 300n}, shares: {me: 100n, a: 100n, b: 100n}})]
  const net = groupNet(records, 'G').INR!

  test('the plan falls back to no rules and says who the rules left stuck', () => {
    expect(planSettlement(net, rules, 'direct').status).toBe('infeasible')
    const plan = directPlan(net, rules)
    expect(plan.stuck).toEqual(['a', 'b'])
    expect(plan.transfers).toEqual([
      {from: 'a', to: 'me', amount: 100n},
      {from: 'b', to: 'me', amount: 100n},
    ])
  })
  test('People rows are that same plan', () =>
    expect(balanceRows(records, 'me', {G: rules}).map(r => [r.person, r.amount])).toEqual(
      directPlan(net, rules).transfers.map(t => [t.from, t.amount]),
    ))
  test('a plan within the rules has nobody stuck', () => expect(directPlan(net, {allowListOnly: false, edges: {}}).stuck).toEqual([]))
})

describe('m7: Call it even when the parts net to zero', () => {
  const parts = [
    {groupId: null, amount: 100n},
    {groupId: 'g', amount: -100n},
  ]
  test('the whole balance (zero) clears every part', () => expect(writeOffParts(parts, 0n)).toEqual(parts))
  test('anything more than the zero net is still refused', () => expect(() => writeOffParts(parts, 50n)).toThrow('INVALID_AMOUNT'))
  test('nothing open is still refused', () => expect(() => writeOffParts([], 0n)).toThrow('INVALID_AMOUNT'))
})

describe('m10: transit routes cost more than a direct transfer and need consent', () => {
  const net = {A: -100n, X: 0n, B: 100n}
  test('two preferred hops never beat one allowed transfer', () =>
    expect(planSettlement(net, {allowListOnly: false, edges: {'A>X': 'preferred', 'X>B': 'preferred'}}, 'transit', ['X'])).toMatchObject({
      status: 'ok',
      transfers: [{from: 'A', to: 'B', amount: 100n}],
    }))
  test('nobody passes money on without consent', () =>
    expect(planSettlement(net, {allowListOnly: false, edges: {'A>B': 'excluded'}}, 'transit').status).toBe('infeasible'))
  test('a consenting member can pass it on', () =>
    expect(planSettlement(net, {allowListOnly: false, edges: {'A>B': 'excluded'}}, 'transit', ['X'])).toMatchObject({
      status: 'ok',
      transfers: [
        {from: 'A', to: 'X', amount: 100n},
        {from: 'X', to: 'B', amount: 100n},
      ],
    }))
})
