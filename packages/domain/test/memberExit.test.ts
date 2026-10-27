import {expect, test} from 'bun:test'

import {memberExitChanges, memberExitTransfers} from '../src/memberExit'
import {NO_RULES} from '../src/settlement'

const nets = {
  EUR: {me: 3000n, bob: -2000n, cara: -1000n},
  INR: {me: -500n, bob: 500n, cara: 0n},
  JPY: {me: 0n, bob: 0n, cara: 0n},
}

test('only the transfers that clear the leaving member, per currency', () => {
  const t = memberExitTransfers(nets, 'bob', NO_RULES)
  expect(t).toEqual([
    {currency: 'EUR', from: 'bob', to: 'me', amount: 2000n},
    {currency: 'INR', from: 'me', to: 'bob', amount: 500n},
  ])
})

test('a member owing nothing has nothing to clear', () => {
  expect(memberExitTransfers(nets, 'cara', NO_RULES).map(t => t.currency)).toEqual(['EUR'])
  expect(memberExitTransfers({JPY: nets.JPY}, 'bob', NO_RULES)).toEqual([])
})

test('every member balance change is listed, per currency, and never sums across currencies', () => {
  const t = memberExitTransfers(nets, 'bob', NO_RULES)
  expect(memberExitChanges(nets, t)).toEqual([
    {currency: 'EUR', personId: 'bob', before: -2000n, after: 0n},
    {currency: 'EUR', personId: 'me', before: 3000n, after: 1000n},
    {currency: 'INR', personId: 'bob', before: 500n, after: 0n},
    {currency: 'INR', personId: 'me', before: -500n, after: 0n},
  ])
})

test('the leaving member lands on zero whatever the group plan looks like', () => {
  const big = {USD: {a: 700n, b: -300n, c: -250n, d: -150n, e: 0n}}
  for (const who of ['a', 'b', 'c', 'd']) {
    const t = memberExitTransfers(big, who, NO_RULES)
    const after = memberExitChanges(big, t).find(c => c.personId === who)!.after
    expect(after).toBe(0n)
    expect(t.every(x => x.from === who || x.to === who)).toBe(true)
  }
})

test('rules the group set are kept when they allow a plan', () => {
  const rules = {allowListOnly: true, edges: {'bob>cara': 'allowed' as const, 'cara>me': 'allowed' as const}}
  const g = {EUR: {me: 100n, bob: -100n, cara: 0n}}
  // bob may only pay cara, so the plan fails and falls back to the direct plan with no rules.
  expect(memberExitTransfers(g, 'bob', rules)).toEqual([{currency: 'EUR', from: 'bob', to: 'me', amount: 100n}])
})
