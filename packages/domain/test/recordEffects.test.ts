import {expect, test} from 'bun:test'
import fc from 'fast-check'

import {
  balanceRows,
  balanceRowsFromNets,
  type BalanceRow,
  groupNet,
  type LedgerRecord,
  pairwiseBalances,
  recordEffects,
} from '../src/ledger'
import {computeShares} from '../src/split'

const PEOPLE = ['me', 'a', 'b', 'c', 'd']
const GROUPS = [null, null, 'g1', 'g2']
const CURRENCIES = ['INR', 'EUR', 'JPY', 'BHD']

const person = fc.constantFrom(...PEOPLE)
const expense = fc
  .record({
    id: fc.uuid(),
    groupId: fc.constantFrom(...GROUPS),
    currency: fc.constantFrom(...CURRENCIES),
    total: fc.bigInt({min: 1n, max: 10n ** 9n}),
    payers: fc.uniqueArray(person, {minLength: 1, maxLength: 3}),
    sharers: fc.uniqueArray(person, {minLength: 1, maxLength: 5}),
    deleted: fc.boolean(),
  })
  .map((e): LedgerRecord => {
    const split = {mode: 'equal' as const, participants: e.sharers}
    const shares = computeShares(e.total, split)
    // Several payers split the total as evenly as whole minor units allow.
    const payers: Record<string, bigint> = {}
    const each = e.total / BigInt(e.payers.length)
    e.payers.forEach((p, i) => (payers[p] = i === e.payers.length - 1 ? e.total - each * BigInt(i) : each))
    return {kind: 'expense', id: e.id, groupId: e.groupId, currency: e.currency, total: e.total, payers, shares, date: '2026-01-01', deleted: e.deleted}
  })
const transfer = fc
  .record({
    id: fc.uuid(),
    kind: fc.constantFrom('repayment' as const, 'writeoff' as const),
    groupId: fc.constantFrom(...GROUPS),
    currency: fc.constantFrom(...CURRENCIES),
    from: person,
    to: person,
    amount: fc.bigInt({min: 1n, max: 10n ** 9n}),
    deleted: fc.boolean(),
  })
  .filter(r => r.from !== r.to)
  .map((r): LedgerRecord => ({...r, date: '2026-01-02'}))

const ledger = fc.array(fc.oneof(expense, transfer), {maxLength: 25})

/** What the projections hold after adding every live record's effects, the way the store does. */
function project(records: LedgerRecord[]) {
  const nets: Record<string, Record<string, Record<string, bigint>>> = {}
  const pairs = new Map<string, bigint>()
  for (const r of records) {
    if (r.deleted) continue
    const {net, debts} = recordEffects(r)
    for (const {person: p, amount} of net) {
      const byCurrency = (nets[r.groupId ?? ''] ??= {})
      const m = (byCurrency[r.currency] ??= {})
      m[p] = (m[p] ?? 0n) + amount
    }
    for (const d of debts) {
      for (const [a, b, v] of [
        [d.creditor, d.debtor, d.amount],
        [d.debtor, d.creditor, -d.amount],
      ] as const) {
        const key = JSON.stringify([a, b, r.currency])
        pairs.set(key, (pairs.get(key) ?? 0n) + v)
      }
    }
  }
  return {nets, pairs}
}

test('group nets from record effects equal groupNet', () => {
  fc.assert(
    fc.property(ledger, records => {
      const {nets} = project(records)
      for (const groupId of ['g1', 'g2']) expect(nets[groupId] ?? {}).toEqual(groupNet(records, groupId))
    }),
    {numRuns: 300},
  )
})

test('pair balances from record effects equal pairwiseBalances for every person', () => {
  fc.assert(
    fc.property(ledger, records => {
      const {pairs} = project(records)
      for (const me of PEOPLE) {
        const fromProjection: BalanceRow[] = [...pairs]
          .map(([key, amount]) => ({key: JSON.parse(key) as [string, string, string], amount}))
          .filter(({key, amount}) => key[0] === me && amount !== 0n)
          .map(({key, amount}) => ({person: key[1], groupId: null, currency: key[2], amount}))
        const expected = pairwiseBalances(
          records.filter(r => r.groupId === null),
          me,
        )
        const sort = (rows: BalanceRow[]) => [...rows].sort((x, y) => (x.person + x.currency < y.person + y.currency ? -1 : 1))
        expect(sort(fromProjection)).toEqual(sort(expected))
      }
    }),
    {numRuns: 300},
  )
})

test('balanceRowsFromNets over the projections equals balanceRows over the ledger', () => {
  fc.assert(
    fc.property(ledger, records => {
      const {nets, pairs} = project(records)
      for (const me of PEOPLE) {
        const direct: BalanceRow[] = [...pairs]
          .map(([key, amount]) => ({key: JSON.parse(key) as [string, string, string], amount}))
          .filter(({key}) => key[0] === me)
          .map(({key, amount}) => ({person: key[1], groupId: null, currency: key[2], amount}))
        const groupNets = Object.fromEntries(Object.entries(nets).filter(([g]) => g !== ''))
        expect(balanceRowsFromNets(me, direct, groupNets)).toEqual(balanceRows(records, me))
      }
    }),
    {numRuns: 200},
  )
})
