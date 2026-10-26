import {describe, expect, test} from 'bun:test'
import fc from 'fast-check'

import {
  balanceRows,
  type ExpenseRecord,
  groupNet,
  type LedgerRecord,
  pairwiseBalances,
  personSummary,
  writeOffParts,
  type WriteOffRecord,
} from '../src/ledger'
import {type ReportFilter, selectExpenses, spendingTotals} from '../src/reports'

const exp = (e: Omit<ExpenseRecord, 'kind' | 'date' | 'deleted'>): ExpenseRecord => ({kind: 'expense', date: '2026-01-01', deleted: false, ...e})
const wo = (w: Omit<WriteOffRecord, 'kind' | 'date' | 'deleted' | 'id'> & {deleted?: boolean}): WriteOffRecord => ({
  kind: 'writeoff',
  id: 'w' + Math.random(),
  date: '2026-01-03',
  deleted: false,
  ...w,
})

/* x owes me 100 INR direct, 50 INR in g1 and 5 USD direct; y owes me 30 INR. */
const records: LedgerRecord[] = [
  exp({id: 'e1', groupId: null, currency: 'INR', total: 200n, payers: {me: 200n}, shares: {me: 100n, x: 100n}}),
  exp({id: 'e2', groupId: 'g1', currency: 'INR', total: 100n, payers: {me: 100n}, shares: {me: 50n, x: 50n}}),
  exp({id: 'e3', groupId: null, currency: 'USD', total: 1000n, payers: {me: 1000n}, shares: {me: 500n, x: 500n}}),
  exp({id: 'e4', groupId: null, currency: 'INR', total: 60n, payers: {me: 60n}, shares: {me: 30n, y: 30n}}),
]

describe('write-off records (F-1113)', () => {
  test('a write-off zeroes the pair balance in its currency and touches nothing else', () => {
    const rows = pairwiseBalances([...records, wo({groupId: null, currency: 'INR', from: 'x', to: 'me', amount: 100n})], 'me')
    expect(rows).toEqual([
      {person: 'x', groupId: null, currency: 'USD', amount: 500n},
      {person: 'x', groupId: 'g1', currency: 'INR', amount: 50n},
      {person: 'y', groupId: null, currency: 'INR', amount: 30n},
    ])
  })

  test('forgiven by them: what I owed is gone', () => {
    const owe = exp({id: 'e', groupId: null, currency: 'EUR', total: 900n, payers: {x: 900n}, shares: {me: 300n, x: 600n}})
    expect(pairwiseBalances([owe, wo({groupId: null, currency: 'EUR', from: 'me', to: 'x', amount: 300n})], 'me')).toEqual([])
  })

  test('a deleted (undone) write-off has no effect', () => {
    const rows = pairwiseBalances([...records, wo({groupId: null, currency: 'INR', from: 'x', to: 'me', amount: 100n, deleted: true})], 'me')
    expect(rows.find(r => r.person === 'x' && r.groupId === null && r.currency === 'INR')?.amount).toBe(100n)
  })

  test('group write-offs move group nets like a payment, so the group still sums to zero', () => {
    const all = [...records, wo({groupId: 'g1', currency: 'INR', from: 'x', to: 'me', amount: 50n})]
    expect(groupNet(all, 'g1').INR).toEqual({me: 0n, x: 0n})
    expect(balanceRows(all, 'me').some(r => r.groupId === 'g1')).toBe(false)
  })

  test('write-offs never count as spending', () => {
    const all = [...records, wo({groupId: null, currency: 'INR', from: 'x', to: 'me', amount: 100n})]
    const f = {range: {from: '2026-01-01', to: '2026-12-31'}, currency: 'INR', groupId: null} as unknown as ReportFilter
    expect(selectExpenses(all, f)).toEqual(selectExpenses(records, f))
    expect(spendingTotals(selectExpenses(all, f), 'me')).toEqual(spendingTotals(selectExpenses(records, f), 'me'))
  })
})

describe('writeOffParts', () => {
  test('the full balance clears every part', () =>
    expect(
      writeOffParts(
        [
          {groupId: null, amount: 100n},
          {groupId: 'g1', amount: 50n},
        ],
        150n,
      ),
    ).toEqual([
      {groupId: null, amount: 100n},
      {groupId: 'g1', amount: 50n},
    ]))

  test('the full balance clears parts owed both ways (each in its own direction)', () =>
    expect(
      writeOffParts(
        [
          {groupId: null, amount: 700n},
          {groupId: 'g1', amount: -200n},
        ],
        500n,
      ),
    ).toEqual([
      {groupId: null, amount: 700n},
      {groupId: 'g1', amount: -200n},
    ]))

  test('a part write-off goes direct first, then groups, in the balance direction', () =>
    expect(
      writeOffParts(
        [
          {groupId: 'g1', amount: 400n},
          {groupId: null, amount: 300n},
        ],
        500n,
      ),
    ).toEqual([
      {groupId: null, amount: 300n},
      {groupId: 'g1', amount: 200n},
    ]))

  test('when I owe, parts are negative', () => expect(writeOffParts([{groupId: null, amount: -300n}], 100n)).toEqual([{groupId: null, amount: -100n}]))

  test('more than the balance, zero, or nothing to forgive throws', () => {
    expect(() => writeOffParts([{groupId: null, amount: 100n}], 101n)).toThrow('INVALID_AMOUNT')
    expect(() => writeOffParts([{groupId: null, amount: 100n}], 0n)).toThrow('INVALID_AMOUNT')
    expect(() => writeOffParts([], 1n)).toThrow('INVALID_AMOUNT')
  })

  test('property: writing off the full balance leaves every part at zero', () =>
    fc.assert(
      fc.property(fc.array(fc.bigInt({min: -10_000n, max: 10_000n}), {minLength: 1, maxLength: 5}), xs => {
        const parts = xs.map((amount, i) => ({groupId: i === 0 ? null : `g${i}`, amount}))
        const net = xs.reduce((a, b) => a + b, 0n)
        if (net === 0n) return
        const out = writeOffParts(parts, net < 0n ? -net : net)
        for (const p of parts) {
          const w = out.filter(o => o.groupId === p.groupId).reduce((a, o) => a + o.amount, 0n)
          expect(p.amount - w).toBe(0n)
        }
      }),
    ))

  test('property: a part write-off never exceeds a part and sums to the amount', () =>
    fc.assert(
      fc.property(
        fc.array(fc.bigInt({min: 1n, max: 10_000n}), {minLength: 1, maxLength: 5}),
        fc.double({min: 0.01, max: 0.99, noNaN: true}),
        (xs, f) => {
          const parts = xs.map((amount, i) => ({groupId: i === 0 ? null : `g${i}`, amount}))
          const net = xs.reduce((a, b) => a + b, 0n)
          const amount = BigInt(Math.max(1, Math.floor(Number(net) * f)))
          const out = writeOffParts(parts, amount)
          expect(out.reduce((a, o) => a + o.amount, 0n)).toBe(amount)
          for (const o of out) expect(o.amount <= parts.find(p => p.groupId === o.groupId)!.amount).toBe(true)
        },
      ),
    ))
})

test('personSummary after a full write-off has no INR balance with x', () => {
  const rows = pairwiseBalances(
    [
      ...records,
      wo({groupId: null, currency: 'INR', from: 'x', to: 'me', amount: 100n}),
      wo({groupId: 'g1', currency: 'INR', from: 'x', to: 'me', amount: 50n}),
    ],
    'me',
  )
  const x = personSummary(rows, {includeGroups: true}).find(p => p.person === 'x')!
  expect(Object.keys(x.byCurrency)).toEqual(['USD'])
})
