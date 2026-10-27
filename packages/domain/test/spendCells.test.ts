/*
 * Spending cells (ARCHITECTURE 9.8): the same figures as the record-based
 * reports, computed from per-person cells. A stored `aggregates` row is such a
 * cell dated the first of its month, so a period made of whole months can be
 * read from aggregates, and the two paths must agree to the minor unit.
 */
import {expect, test} from 'bun:test'
import fc from 'fast-check'

import {type RepaymentRecord, type WriteOffRecord} from '../src/ledger'
import {
  balanceTrend,
  buckets,
  cellBalanceTrend,
  cellsByCategory,
  cellsByGroup,
  cellsByPerson,
  cellsOverTime,
  cellTotals,
  type DateRange,
  type Granularity,
  type ReportExpense,
  type ReportRecord,
  recordCells,
  type SpendCell,
  spendingByCategory,
  spendingByGroup,
  spendingByPerson,
  spendingOverTime,
  spendingTotals,
  type WeekStart,
} from '../src/reports'
import {computeShares} from '../src/split'

const PEOPLE = ['me', 'a', 'b', 'c']
const GROUPS = [null, 'g1', 'g2']
const CATEGORIES = ['food', 'rent', 'other']

const expense = fc
  .record({
    id: fc.uuid(),
    total: fc.bigInt({min: 1n, max: 500_000n}),
    payer: fc.constantFrom(...PEOPLE),
    sharers: fc.subarray(PEOPLE, {minLength: 1}),
    groupId: fc.constantFrom(...GROUPS),
    category: fc.constantFrom(...CATEGORIES),
    day: fc.integer({min: 0, max: 400}),
    deleted: fc.boolean(),
  })
  .map(
    (x): ReportExpense => ({
      kind: 'expense',
      id: x.id,
      groupId: x.groupId,
      currency: 'INR',
      total: x.total,
      payers: {[x.payer]: x.total},
      shares: computeShares(x.total, {mode: 'equal', participants: x.sharers}),
      date: new Date(Date.UTC(2025, 0, 1 + x.day)).toISOString().slice(0, 10),
      deleted: x.deleted,
      category: x.category,
    }),
  )

const transfer = fc
  .record({id: fc.uuid(), amount: fc.bigInt({min: 1n, max: 90_000n}), pair: fc.subarray(PEOPLE, {minLength: 2, maxLength: 2}), groupId: fc.constantFrom(...GROUPS), day: fc.integer({min: 0, max: 400}), kind: fc.constantFrom('repayment', 'writeoff')})
  .map(
    (x): RepaymentRecord | WriteOffRecord => ({
      kind: x.kind as 'repayment',
      id: x.id,
      groupId: x.groupId,
      currency: 'INR',
      from: x.pair[0]!,
      to: x.pair[1]!,
      amount: x.amount,
      date: new Date(Date.UTC(2025, 0, 1 + x.day)).toISOString().slice(0, 10),
      deleted: false,
    }),
  )

const monthOf = (d: string) => d.slice(0, 7)
const lastDay = (m: string) => new Date(Date.UTC(+m.slice(0, 4), +m.slice(5, 7), 0)).toISOString().slice(0, 10)

/** What the stored aggregates hold: cells of whole months inside or before `range`, folded to their month. */
function asAggregates(cells: SpendCell[], range: DateRange): SpendCell[] {
  const whole = (m: string) => (`${m}-01` >= range.from && lastDay(m) <= range.to) || lastDay(m) < range.from
  const folded = new Map<string, SpendCell>()
  const out: SpendCell[] = []
  for (const c of cells) {
    const m = monthOf(c.date)
    if (!whole(m)) {
      out.push(c)
      continue
    }
    const key = JSON.stringify([c.currency, m, c.groupId, c.category, c.person, c.kind])
    const f = folded.get(key)
    if (!f) folded.set(key, {...c, date: `${m}-01`})
    else {
      f.total += c.total
      f.paid += c.paid
      f.share += c.share
      f.net += c.net
      f.count += c.count
    }
  }
  return [...out, ...folded.values()]
}

const GRANULARITIES: Granularity[] = ['day', 'week', 'month', 'year']

test('cells give the record-based reports exactly, whole or folded into months', () => {
  fc.assert(
    fc.property(
      fc.array(expense, {maxLength: 40}),
      fc.array(transfer, {maxLength: 12}),
      fc.integer({min: 0, max: 300}),
      fc.integer({min: 1, max: 200}),
      fc.constantFrom<WeekStart>(0, 1, 6),
      fc.constantFrom(...GRANULARITIES),
      (expenses, transfers, from, length, weekStart, g) => {
        const start = new Date(Date.UTC(2025, 0, 1 + from)).toISOString().slice(0, 10)
        const range: DateRange = {from: start, to: new Date(Date.UTC(2025, 0, 1 + from + length)).toISOString().slice(0, 10)}
        const records: ReportRecord[] = [...expenses, ...transfers]
        const live = records.filter(r => !r.deleted)
        const inRange = expenses.filter(e => !e.deleted && e.date >= range.from && e.date <= range.to)
        const me = 'me'

        const exact = live.flatMap(recordCells)
        const spend = exact.filter(c => c.kind === 'expense' && c.date >= range.from && c.date <= range.to)
        const folded = asAggregates(exact, range)
        const foldedSpend = folded.filter(c => c.kind === 'expense' && c.date >= range.from && c.date <= range.to)
        // Cells folded to a month are only valid for month-or-longer buckets.
        const isCoarse = g === 'month' || g === 'year'

        for (const cells of isCoarse ? [spend, foldedSpend] : [spend]) {
          expect(cellTotals(cells, me)).toEqual(spendingTotals(inRange, me))
          expect(cellsOverTime(cells, me, range, g, weekStart)).toEqual(spendingOverTime(inRange, me, range, g, weekStart))
          expect(cellsByCategory(cells, me)).toEqual(spendingByCategory(inRange, me))
          expect(cellsByPerson(cells)).toEqual(spendingByPerson(inRange))
          expect(cellsByGroup(cells, me)).toEqual(spendingByGroup(inRange, me))
        }
        const filter = {currency: 'INR', range, includeGroups: true}
        for (const cells of isCoarse ? [exact, folded] : [exact])
          expect(cellBalanceTrend(cells.filter(c => c.date <= range.to), me, range, g, weekStart)).toEqual(balanceTrend(records, me, filter, g, weekStart))
        expect(buckets(range, g, weekStart).length).toBeGreaterThan(0)
      },
    ),
    {numRuns: 300},
  )
})

test('a deleted record has no cells; a transfer has a whole-record cell and net per side; a payer outside the shares still shows', () => {
  const deleted: ReportExpense = {kind: 'expense', id: 'x', groupId: null, currency: 'INR', total: 100n, payers: {me: 100n}, shares: {me: 100n}, date: '2026-01-01', deleted: true}
  expect(recordCells(deleted)).toEqual([])
  const paid = recordCells({...deleted, deleted: false, payers: {a: 100n}, shares: {me: 100n}, category: 'food'})
  expect(paid.find(c => c.person === 'a')).toMatchObject({paid: 100n, share: 0n, net: 100n, count: 0})
  expect(paid.find(c => c.person === 'me')).toMatchObject({paid: 0n, share: 100n, net: -100n, count: 1})
  expect(paid.find(c => c.person === '')).toMatchObject({total: 100n, count: 1, kind: 'expense', groupId: '', category: 'food'})
  const t = recordCells({kind: 'repayment', id: 't', groupId: 'g', currency: 'INR', from: 'a', to: 'b', amount: 50n, date: '2026-01-02', deleted: false})
  expect(t.map(c => [c.person, c.net, c.kind, c.groupId, c.count])).toEqual([['', 0n, 'transfer', 'g', 1], ['a', 50n, 'transfer', 'g', 1], ['b', -50n, 'transfer', 'g', 1]])
})
