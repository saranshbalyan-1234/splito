import {describe, expect, test} from 'bun:test'
import fc from 'fast-check'

import {MAX_MINOR} from '../src/errors'
import {allocate} from '../src/allocate'
import {computeShares, type SplitInput, validateExpense} from '../src/split'

const sum = (xs: bigint[]) => xs.reduce((a, b) => a + b, 0n)
const arbIds = fc.uniqueArray(fc.stringMatching(/^[a-z]{1,4}$/), {minLength: 1, maxLength: 8})
const arbTotal = fc.bigInt({min: -(10n ** 9n), max: 10n ** 9n})

/** Builds a valid split for a total from generated ids and integer weights. */
const arbSplit = fc
  .tuple(arbIds, fc.array(fc.integer({min: 1, max: 1000}), {minLength: 8, maxLength: 8}), fc.constantFrom('equal', 'exact', 'percent', 'shares', 'items'))
  .map(([ids, ws, mode]) => (total: bigint): SplitInput => {
    switch (mode) {
      case 'equal':
        return {mode, participants: ids}
      case 'shares':
        return {mode, shares: Object.fromEntries(ids.map((id, i) => [id, ws[i]!]))}
      case 'exact':
        return {mode, amounts: allocate(total, ids.map((id, i) => ({id, weight: BigInt(ws[i]!)})))}
      case 'percent': {
        const bp = allocate(10000n, ids.map((id, i) => ({id, weight: BigInt(ws[i]!)})))
        return {mode, basisPoints: Object.fromEntries(Object.entries(bp).filter(([, v]) => v > 0n).map(([k, v]) => [k, Number(v)]))}
      }
      default: {
        const amounts = allocate(total, ids.map((id, i) => ({id, weight: BigInt(ws[i]!)})))
        return {mode: 'items', items: ids.map(id => ({id: 'i-' + id, amount: amounts[id]!, participants: [id]})), tax: 0n, tip: 0n, discount: 0n}
      }
    }
  })

describe('allocate', () => {
  test('sums exactly', () =>
    fc.assert(fc.property(arbTotal, arbIds, (t, ids) => sum(Object.values(allocate(t, ids.map(id => ({id, weight: 1n}))))) === t)))
  test('rejects non-positive weight', () => expect(() => allocate(10n, [{id: 'a', weight: 0n}])).toThrow('NON_POSITIVE_WEIGHT'))
})

describe('computeShares', () => {
  test('equal 100/3 stable tie-break', () =>
    expect(computeShares(100n, {mode: 'equal', participants: ['c', 'a', 'b']})).toEqual({a: 34n, b: 33n, c: 33n}))
  test('permutation invariant', () =>
    fc.assert(
      fc.property(arbIds, ids =>
        expect(computeShares(1000n, {mode: 'equal', participants: ids})).toEqual(
          computeShares(1000n, {mode: 'equal', participants: [...ids].reverse()}),
        ),
      ),
    ))
  test('conservation all modes', () =>
    fc.assert(fc.property(arbTotal, arbSplit, (t, s) => sum(Object.values(computeShares(t, s(t)))) === t)))
  test('exact must match', () =>
    expect(() => computeShares(100n, {mode: 'exact', amounts: {a: 50n, b: 40n}})).toThrow('TOTAL_MISMATCH'))
  test('percent', () =>
    expect(computeShares(1000n, {mode: 'percent', basisPoints: {a: 3333, b: 3333, c: 3334}})).toEqual({a: 333n, b: 333n, c: 334n}))
  test('percent not 100', () =>
    expect(() => computeShares(1000n, {mode: 'percent', basisPoints: {a: 5000}})).toThrow('PERCENT_NOT_100'))
  test('shares 2:1', () => expect(computeShares(300n, {mode: 'shares', shares: {a: 2, b: 1}})).toEqual({a: 200n, b: 100n}))
  test('fractional share rejected', () =>
    expect(() => computeShares(300n, {mode: 'shares', shares: {a: 1.5}})).toThrow('NON_POSITIVE_WEIGHT'))
  test('items with tax tip discount', () =>
    expect(
      computeShares(1150n, {
        mode: 'items',
        items: [
          {id: 'i1', amount: 600n, participants: ['a']},
          {id: 'i2', amount: 400n, participants: ['a', 'b']},
        ],
        tax: 100n,
        tip: 100n,
        discount: 50n,
      }),
    ).toEqual({a: 920n, b: 230n}))
  test('items total mismatch', () =>
    expect(() =>
      computeShares(999n, {mode: 'items', items: [{id: 'i', amount: 100n, participants: ['a']}], tax: 0n, tip: 0n, discount: 0n}),
    ).toThrow('TOTAL_MISMATCH'))
  test('unassigned item', () =>
    expect(() =>
      computeShares(100n, {mode: 'items', items: [{id: 'i', amount: 100n, participants: []}], tax: 0n, tip: 0n, discount: 0n}),
    ).toThrow('UNASSIGNED_ITEM'))
  test('empty participants', () =>
    expect(() => computeShares(100n, {mode: 'equal', participants: []})).toThrow('EMPTY_PARTICIPANTS'))
  test('duplicate participant', () =>
    expect(() => computeShares(100n, {mode: 'equal', participants: ['a', 'a']})).toThrow('DUPLICATE_PARTICIPANT'))
  test('JPY scale 0 refund', () =>
    expect(computeShares(-100n, {mode: 'equal', participants: ['a', 'b', 'c']})).toEqual({a: -34n, b: -33n, c: -33n}))
  test('overflow', () =>
    expect(() => computeShares(MAX_MINOR + 1n, {mode: 'equal', participants: ['a']})).toThrow('OUT_OF_RANGE'))
})

describe('validateExpense', () => {
  test('multiple payers reconcile', () =>
    expect(() => validateExpense({total: 100n, payers: {a: 60n, b: 40n}, shares: {a: 50n, b: 50n}})).not.toThrow())
  test('payers mismatch', () =>
    expect(() => validateExpense({total: 100n, payers: {a: 60n}, shares: {a: 50n, b: 50n}})).toThrow('PAYERS_MISMATCH'))
  test('shares mismatch', () =>
    expect(() => validateExpense({total: 100n, payers: {a: 100n}, shares: {a: 50n}})).toThrow('TOTAL_MISMATCH'))
  test('payerNotParticipant', () =>
    expect(() => validateExpense({total: 100n, payers: {z: 100n}, shares: {a: 50n, b: 50n}})).not.toThrow())
  test('a payer with the opposite sign to the total is refused', () =>
    expect(() => validateExpense({total: 100n, payers: {a: 150n, b: -50n}, shares: {a: 50n, b: 50n}})).toThrow('SIGN_MISMATCH'))
  test('a share with the opposite sign to the total is refused', () =>
    expect(() => validateExpense({total: 100n, payers: {a: 100n}, shares: {a: -25n, b: 125n}})).toThrow('SIGN_MISMATCH'))
  test('a refund (negative total) keeps every part negative', () => {
    expect(() => validateExpense({total: -100n, payers: {a: -100n}, shares: {a: -50n, b: -50n}})).not.toThrow()
    expect(() => validateExpense({total: -100n, payers: {a: -100n}, shares: {a: 50n, b: -150n}})).toThrow('SIGN_MISMATCH')
  })
})
