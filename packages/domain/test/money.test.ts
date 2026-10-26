import {describe, expect, test} from 'bun:test'
import fc from 'fast-check'

import {DomainError, MAX_MINOR} from '../src/errors'
import {
  balanceParts,
  type ExpenseRecord,
  groupMemberNet,
  groupNet,
  memberNets,
  pairBalance,
  pairwiseBalances,
  partsOwedBy,
  type RepaymentRecord,
} from '../src/ledger'
import {amountSteps, compareMinor, fraction, fractionBetween, parseMinor, percentOf, repaymentFlow} from '../src/money'
import {computeShares, splitItem} from '../src/split'

/*
 * The money helpers the client used to compute itself (A-004). Each keeps
 * the client's old behaviour exactly; the client now calls these.
 */

const exp = (e: Omit<ExpenseRecord, 'kind' | 'date' | 'deleted'>): ExpenseRecord => ({kind: 'expense', date: '2026-01-01', deleted: false, ...e})
const rep = (r: Omit<RepaymentRecord, 'kind' | 'date' | 'deleted'>): RepaymentRecord => ({kind: 'repayment', date: '2026-01-02', deleted: false, ...r})

describe('parseMinor', () => {
  test('reads a decimal-integer string of minor units', () => {
    expect(parseMinor('0')).toBe(0n)
    expect(parseMinor('4000000')).toBe(4000000n)
    expect(parseMinor('-1250')).toBe(-1250n)
  })
  test('refuses anything else, and amounts out of range', () => {
    for (const bad of ['', '1.5', '1e3', '0x10', ' 12', '12 ', '+5', 'abc', '--1'])
      expect(() => parseMinor(bad)).toThrow(DomainError)
    expect(() => parseMinor(String(MAX_MINOR))).toThrow(DomainError)
  })
  test('round-trips every in-range bigint', () =>
    fc.assert(fc.property(fc.bigInt({min: 1n - MAX_MINOR, max: MAX_MINOR - 1n}), v => parseMinor(String(v)) === v)))
})

describe('compareMinor', () => {
  test('orders ascending: -1, 0, 1', () => {
    expect(compareMinor(1n, 2n)).toBe(-1)
    expect(compareMinor(2n, 2n)).toBe(0)
    expect(compareMinor(3n, 2n)).toBe(1)
  })
  test('sorts exactly past 2^53', () => {
    const big = 2n ** 60n
    expect([big + 1n, big, -big].sort(compareMinor)).toEqual([-big, big, big + 1n])
  })
})

describe('fraction, fractionBetween, percentOf (geometry only)', () => {
  test('fraction clamps to [0, 1] and is 0 for a non-positive max', () => {
    expect(fraction(50n, 100n)).toBe(0.5)
    expect(fraction(0n, 100n)).toBe(0)
    expect(fraction(-5n, 100n)).toBe(0)
    expect(fraction(150n, 100n)).toBe(1)
    expect(fraction(5n, 0n)).toBe(0)
    expect(fraction(1n, 3n)).toBe(0.333333)
  })
  test('fractionBetween places v between lo and hi', () => {
    expect(fractionBetween(-50n, -100n, 100n)).toBe(0.25)
    expect(fractionBetween(100n, -100n, 100n)).toBe(1)
    expect(fractionBetween(0n, 0n, 0n)).toBe(0)
  })
  test('percentOf is one decimal, computed in bigint', () => {
    expect(percentOf(1n, 3n)).toBe(33.3)
    expect(percentOf(2n, 3n)).toBe(66.6)
    expect(percentOf(5n, 0n)).toBe(0)
  })
})

describe('amountSteps', () => {
  test('eases from -> to and lands exactly on to', () => {
    const steps = amountSteps(0n, 1000n, 4)
    expect(steps).toHaveLength(4)
    expect(steps.at(-1)).toBe(1000n)
    expect(steps).toEqual([...steps].sort(compareMinor))
  })
  test('refuses a non-positive or fractional step count', () => {
    expect(() => amountSteps(0n, 1n, 0)).toThrow(RangeError)
    expect(() => amountSteps(0n, 1n, 1.5)).toThrow(RangeError)
  })
})

describe('repaymentFlow', () => {
  const r = rep({id: 'r1', groupId: null, currency: 'INR', from: 'me', to: 'x', amount: 500n})
  test('money out is negative, money in positive, anyone else zero', () => {
    expect(repaymentFlow(r, 'me')).toBe(-500n)
    expect(repaymentFlow(r, 'x')).toBe(500n)
    expect(repaymentFlow(r, 'y')).toBe(0n)
  })
})

describe('pairBalance and groupMemberNet', () => {
  const dinner = exp({id: 'e1', groupId: 'g', currency: 'INR', total: 300n, payers: {me: 300n}, shares: {me: 100n, x: 100n, y: 100n}})
  test('pairBalance is the pairwise row with that person, or zero', () => {
    expect(pairBalance([dinner], 'me', 'x')).toBe(pairwiseBalances([dinner], 'me').find(b => b.person === 'x')!.amount)
    expect(pairBalance([dinner], 'me', 'nobody')).toBe(0n)
  })
  test('groupMemberNet is groupNet for one person and currency, or zero', () => {
    expect(groupMemberNet([dinner], 'g', 'INR', 'me')).toBe(groupNet([dinner], 'g').INR!.me!)
    expect(groupMemberNet([dinner], 'g', 'EUR', 'me')).toBe(0n)
    expect(groupMemberNet([dinner], 'other', 'INR', 'me')).toBe(0n)
  })
  test('memberNets lists every member (zero without records), currencies sorted', () => {
    const eur = exp({id: 'e2', groupId: 'g', currency: 'EUR', total: 10n, payers: {x: 10n}, shares: {x: 5n, y: 5n}})
    const nets = memberNets([eur, dinner], 'g', ['me', 'x', 'y', 'z'])
    expect(Object.keys(nets)).toEqual(['EUR', 'INR'])
    expect(nets.EUR).toEqual({me: 0n, x: 5n, y: -5n, z: 0n})
    expect(nets.INR).toEqual({me: 200n, x: -100n, y: -100n, z: 0n})
  })
})

describe('balanceParts and partsOwedBy', () => {
  test('balanceParts: direct first, then groups, zero parts left out', () => {
    expect(balanceParts({direct: 0n, groups: {g1: 50n, g2: 0n, g3: -20n}})).toEqual([
      {groupId: 'g1', amount: 50n},
      {groupId: 'g3', amount: -20n},
    ])
    expect(balanceParts({direct: 10n, groups: {}})).toEqual([{groupId: null, amount: 10n}])
  })
  test('partsOwedBy: what the payer owes, as positive amounts', () => {
    const parts = [
      {groupId: null, amount: 30n},
      {groupId: 'g', amount: -70n},
    ]
    expect(partsOwedBy(parts, true)).toEqual([{groupId: 'g', amount: 70n}])
    expect(partsOwedBy(parts, false)).toEqual([{groupId: null, amount: 30n}])
  })
})

describe('splitItem', () => {
  test('splits an item by its portions and conserves the amount', () => {
    expect(splitItem(300n, ['a', {id: 'b', weight: 2}])).toEqual({a: 100n, b: 200n})
    fc.assert(
      fc.property(fc.bigInt({min: 0n, max: 10n ** 12n}), fc.array(fc.integer({min: 1, max: 5}), {minLength: 1, maxLength: 6}), (amount, ws) => {
        const parts = splitItem(amount, ws.map((w, i) => (w > 1 ? {id: `p${i}`, weight: w} : `p${i}`)))
        return Object.values(parts).reduce((s, v) => s + v, 0n) === amount
      }),
    )
  })
  test('matches what computeShares charges for a one-item bill', () => {
    const participants = ['a', {id: 'b', weight: 3}]
    expect(splitItem(1000n, participants)).toEqual(
      computeShares(1000n, {mode: 'items', items: [{id: 'i', amount: 1000n, participants}], tax: 0n, tip: 0n, discount: 0n}),
    )
  })
  test('refuses an item nobody had', () => expect(() => splitItem(10n, [])).toThrow(DomainError))
})
