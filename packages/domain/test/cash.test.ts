import {describe, expect, test} from 'bun:test'
import fc from 'fast-check'

import {allocateCash, cashUnit, cashUnitWhole} from '../src/allocate'
import {computeShares} from '../src/split'

const eq = (ids: string[]) => ids.map(id => ({id, weight: 1n}))
const sum = (r: Record<string, bigint>) =>
  Object.values(r).reduce((x, y) => x + y, 0n)

describe('F-402 cash rounding', () => {
  test('1000 over 3 rounded to 1 gives 334/333/333 with no paise', () => {
    const r = allocateCash(100000n, eq(['a', 'b', 'c']), cashUnit('INR', 1))
    expect(r.shares).toEqual({a: 33400n, b: 33300n, c: 33300n})
    expect(r.remainder).toBe(0n)
    expect(r.remainderTo).toBeUndefined()
  })
  test('rounding to 10: shares are multiples of 10', () => {
    const r = allocateCash(100000n, eq(['a', 'b', 'c']), cashUnit('INR', 10))
    expect(r.shares).toEqual({a: 34000n, b: 33000n, c: 33000n})
  })
  test('a total that is not a whole unit leaves a visible remainder on one person', () => {
    // 1000.50 over 3, to 1: 334 / 333 / 333 and 0.50 left over.
    const r = allocateCash(100050n, eq(['a', 'b', 'c']), cashUnit('INR', 1))
    expect(r.remainder).toBe(50n)
    expect(r.remainderTo).toBe('b')
    expect(r.shares).toEqual({a: 33400n, b: 33350n, c: 33300n})
    expect(sum(r.shares)).toBe(100050n)
  })
  test('the remainder goes to whoever was rounded furthest below their exact share', () => {
    // 1005 to 10, weights 1:2 -> exact 335 / 670; rounded 330 / 670 (largest remainder); 5 left, x is short.
    const r = allocateCash(
      1005n,
      [
        {id: 'x', weight: 1n},
        {id: 'y', weight: 2n},
      ],
      10n,
    )
    expect(r.shares).toEqual({x: 335n, y: 670n})
    expect(r.remainderTo).toBe('x')
  })
  test('deterministic: input order does not matter', () => {
    const a = allocateCash(100050n, eq(['c', 'a', 'b']), 100n)
    const b = allocateCash(100050n, eq(['a', 'b', 'c']), 100n)
    expect(a).toEqual(b)
  })
  test('negative totals (refunds) mirror positive ones', () => {
    const r = allocateCash(-100050n, eq(['a', 'b', 'c']), 100n)
    expect(r.shares).toEqual({a: -33400n, b: -33350n, c: -33300n})
    expect(r.remainder).toBe(-50n)
  })
  test('scale-0 and scale-3 currencies', () => {
    expect(cashUnit('JPY', 10)).toBe(10n)
    expect(cashUnit('BHD', 1)).toBe(1000n)
    expect(cashUnit('INR', 5)).toBe(500n)
    expect(() => cashUnit('INR', 0)).toThrow('INVALID_ROUNDING')
    expect(cashUnitWhole('INR', cashUnit('INR', 10))).toBe(10)
    expect(cashUnitWhole('BHD', 5000n)).toBe(5)
  })
  test('unit 1 minor is the plain allocation', () =>
    expect(allocateCash(100n, eq(['a', 'b', 'c']), 1n).shares).toEqual({
      a: 34n,
      b: 33n,
      c: 33n,
    }))
  test('conservation and multiples, for any total, weights and unit', () =>
    fc.assert(
      fc.property(
        fc.bigInt({min: -(10n ** 12n), max: 10n ** 12n}),
        fc.array(fc.integer({min: 1, max: 9}), {minLength: 1, maxLength: 8}),
        fc.constantFrom(1n, 5n, 100n, 500n, 1000n),
        (total, ws, unit) => {
          const weights = ws.map((w, i) => ({id: `p${i}`, weight: BigInt(w)}))
          const r = allocateCash(total, weights, unit)
          expect(sum(r.shares)).toBe(total)
          // Fewer whole units than people: rounding is skipped (audit M15).
          const abs = total < 0n ? -total : total
          if (abs / unit < BigInt(weights.length))
            return expect(r.remainder).toBe(0n)
          for (const [id, v] of Object.entries(r.shares)) {
            const base = id === r.remainderTo ? v - r.remainder : v
            expect(base % unit).toBe(0n)
          }
          expect(r.remainder < 0n ? -r.remainder : r.remainder).toBeLessThan(
            unit,
          )
        },
      ),
    ))
})

describe('F-402 splits with roundTo', () => {
  test('equal split carries the rounding', () =>
    expect(
      computeShares(100050n, {
        mode: 'equal',
        participants: ['a', 'b', 'c'],
        roundTo: 100n,
      }),
    ).toEqual({
      a: 33400n,
      b: 33350n,
      c: 33300n,
    }))
  test('shares and percent splits round too', () => {
    expect(
      computeShares(100000n, {
        mode: 'shares',
        shares: {a: 2, b: 1},
        roundTo: 1000n,
      }),
    ).toEqual({a: 67000n, b: 33000n})
    expect(
      computeShares(100000n, {
        mode: 'percent',
        basisPoints: {a: 3333, b: 6667},
        roundTo: 100n,
      }),
    ).toEqual({a: 33300n, b: 66700n})
  })
  test('no roundTo keeps the exact paise split', () =>
    expect(
      computeShares(100000n, {mode: 'equal', participants: ['a', 'b', 'c']}),
    ).toEqual({a: 33334n, b: 33333n, c: 33333n}))
})

describe('F-112 cash unit larger than the bill (audit M15)', () => {
  test('EUR 45 for 3 with a EUR 100 unit is not 45/0/0: it splits exactly', () => {
    const r = allocateCash(4500n, eq(['a', 'b', 'c']), cashUnit('EUR', 100))
    expect(r.shares).toEqual({a: 1500n, b: 1500n, c: 1500n})
    expect(r.remainder).toBe(0n)
    expect(r.remainderTo).toBeUndefined()
    expect(r.isExact).toBe(true)
  })
  test('fewer whole units than people skips rounding, with a refund mirrored', () => {
    const r = allocateCash(-1000n, eq(['a', 'b', 'c']), cashUnit('INR', 10))
    expect(sum(r.shares)).toBe(-1000n)
    expect(r.remainder).toBe(0n)
    expect(r.shares).toEqual({a: -334n, b: -333n, c: -333n})
  })
  test('as many whole units as people still rounds', () => {
    const r = allocateCash(3000n, eq(['a', 'b', 'c']), cashUnit('INR', 10))
    expect(r.shares).toEqual({a: 1000n, b: 1000n, c: 1000n})
    expect(r.isExact).toBeUndefined()
  })
})
