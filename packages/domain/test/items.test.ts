import {describe, expect, test} from 'bun:test'
import fc from 'fast-check'

import {computeShares, itemBreakdown, type ItemParticipant, type SplitInput} from '../src/split'

type ItemsSplit = Extract<SplitInput, {mode: 'items'}>
const sum = (xs: Iterable<bigint>) => [...xs].reduce((a, b) => a + b, 0n)
const totalOf = (s: ItemsSplit) => sum(s.items.map(i => i.amount)) + s.tax + s.tip + (s.service ?? 0n) - s.discount

/** A bill: up to 6 items over up to 5 people, portions 1-4, tax / tip / service and a discount no bigger than the items. */
const arbBill = fc
  .tuple(
    fc.array(
      fc.record({
        amount: fc.bigInt({min: 1n, max: 10n ** 7n}),
        people: fc.uniqueArray(fc.constantFrom('a', 'b', 'c', 'd', 'e'), {minLength: 1, maxLength: 5}),
        weights: fc.array(fc.integer({min: 1, max: 4}), {minLength: 5, maxLength: 5}),
      }),
      {minLength: 1, maxLength: 6},
    ),
    fc.bigInt({min: 0n, max: 10n ** 6n}),
    fc.bigInt({min: 0n, max: 10n ** 6n}),
    fc.bigInt({min: 0n, max: 10n ** 6n}),
    fc.integer({min: 0, max: 100}),
  )
  .map(([raw, tax, tip, service, discountPct]): ItemsSplit => {
    const items = raw.map((r, n) => ({
      id: `i${n}`,
      amount: r.amount,
      participants: r.people.map((id, k): ItemParticipant => (r.weights[k]! > 1 ? {id, weight: r.weights[k]!} : id)),
    }))
    const discount = (sum(items.map(i => i.amount)) * BigInt(discountPct)) / 100n
    return {mode: 'items', items, tax, tip, service, discount}
  })

/** Deterministic shuffle, so a failing case replays. */
function shuffled<T>(xs: T[], seed: number): T[] {
  const out = [...xs]
  let s = seed || 1
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 16807) % 2147483647
    const j = s % (i + 1)
    ;[out[i], out[j]] = [out[j]!, out[i]!]
  }
  return out
}

describe('itemised bills with portions', () => {
  test('conservation: shares always add up to the bill, to the minor unit', () =>
    fc.assert(fc.property(arbBill, s => sum(Object.values(computeShares(totalOf(s), s))) === totalOf(s))))

  test('permutation invariance: the order of items and of people on an item never changes anyone share', () =>
    fc.assert(
      fc.property(arbBill, fc.integer({min: 1, max: 10_000}), (s, seed) => {
        const reordered: ItemsSplit = {
          ...s,
          items: shuffled(s.items, seed).map((i, n) => ({...i, participants: shuffled(i.participants, seed + n)})),
        }
        expect(computeShares(totalOf(s), reordered)).toEqual(computeShares(totalOf(s), s))
      }),
    ))

  test('2 of 3 beers: one person has two portions, the other one', () =>
    expect(
      computeShares(1200n, {
        mode: 'items',
        items: [{id: 'beers', amount: 1200n, participants: [{id: 'a', weight: 2}, 'b']}],
        tax: 0n,
        tip: 0n,
        discount: 0n,
      }),
    ).toEqual({a: 800n, b: 400n}))

  test('tax, tip, service and discount follow each weighted subtotal', () => {
    /*
     * Beers 900 at a:2 b:1 -> a 600, b 300. Pizza 600 to b and c -> 300 each.
     * Subtotals a 600, b 600, c 300 (2:2:1). Extras 150 + 100 + 50 - 50 = 250 -> 100 / 100 / 50.
     */
    const s: ItemsSplit = {
      mode: 'items',
      items: [
        {id: 'beers', amount: 900n, participants: [{id: 'a', weight: 2}, 'b']},
        {id: 'pizza', amount: 600n, participants: ['b', 'c']},
      ],
      tax: 150n,
      tip: 100n,
      service: 50n,
      discount: 50n,
    }
    expect(computeShares(1750n, s)).toEqual({a: 700n, b: 700n, c: 350n})
  })

  test('service charge counts towards the total', () =>
    expect(() =>
      computeShares(100n, {mode: 'items', items: [{id: 'i', amount: 100n, participants: ['a']}], tax: 0n, tip: 0n, service: 10n, discount: 0n}),
    ).toThrow('TOTAL_MISMATCH'))

  test('a weight of one written out equals a plain id', () =>
    expect(
      computeShares(1000n, {mode: 'items', items: [{id: 'i', amount: 1000n, participants: [{id: 'a', weight: 1}, 'b', 'c']}], tax: 0n, tip: 0n, discount: 0n}),
    ).toEqual(computeShares(1000n, {mode: 'items', items: [{id: 'i', amount: 1000n, participants: ['a', 'b', 'c']}], tax: 0n, tip: 0n, discount: 0n})))

  test('the same person twice on one item is refused', () =>
    expect(() =>
      computeShares(100n, {mode: 'items', items: [{id: 'i', amount: 100n, participants: ['a', {id: 'a', weight: 2}]}], tax: 0n, tip: 0n, discount: 0n}),
    ).toThrow('DUPLICATE_PARTICIPANT'))
})

describe('itemBreakdown', () => {
  test('each item, each person: item parts add up to the item, extras to the adjustment, and both to the share', () =>
    fc.assert(
      fc.property(arbBill, s => {
        const b = itemBreakdown(s)
        const shares = computeShares(totalOf(s), s)
        for (const item of s.items) expect(sum(Object.values(b.items[item.id]!))).toBe(item.amount)
        expect(sum(Object.values(b.extras))).toBe(s.tax + s.tip + (s.service ?? 0n) - s.discount)
        for (const [id, share] of Object.entries(shares)) expect((b.subtotals[id] ?? 0n) + (b.extras[id] ?? 0n)).toBe(share)
      }),
    ))

  test('2 of 3 beers with tax, per person', () => {
    const b = itemBreakdown({
      mode: 'items',
      items: [{id: 'beers', amount: 900n, participants: [{id: 'a', weight: 2}, 'b']}],
      tax: 90n,
      tip: 0n,
      discount: 0n,
    })
    expect(b.items.beers).toEqual({a: 600n, b: 300n})
    expect(b.subtotals).toEqual({a: 600n, b: 300n})
    expect(b.extras).toEqual({a: 60n, b: 30n})
  })
})
