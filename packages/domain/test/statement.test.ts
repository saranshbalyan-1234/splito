import {expect, test} from 'bun:test'

import {buildStatement, type LedgerRecord, reconcileStatement, type StatementInput} from '../src'

const me = 'me'
const ex = (id: string, date: string, over: Partial<Extract<LedgerRecord, {kind: 'expense'}>> = {}): StatementInput => ({
  record: {
    kind: 'expense',
    id,
    groupId: null,
    currency: 'INR',
    total: 1000n,
    payers: {me: 1000n},
    shares: {me: 500n, asha: 500n},
    date,
    deleted: false,
    ...over,
  },
  title: id,
  note: '',
  createdAt: 0,
})
const pay = (id: string, date: string, from: string, to: string, amount: bigint, kind: 'repayment' | 'writeoff' = 'repayment', currency = 'INR', groupId: string | null = null): StatementInput => ({
  record: {kind, id, groupId, currency, from, to, amount, date, deleted: false},
  title: '',
  note: '',
  createdAt: 0,
})

test('rows run oldest first with a running balance per currency, never mixed', () => {
  const st = buildStatement(
    [
      ex('e2', '2026-10-02', {currency: 'AED', total: 200n, payers: {asha: 200n}, shares: {me: 100n, asha: 100n}}),
      ex('e1', '2026-10-01'),
      pay('p1', '2026-10-03', 'asha', me, 300n),
    ],
    me,
    {},
  )
  expect(st.rows.map(r => [r.id, r.currency, r.effect, r.balance])).toEqual([
    ['e1', 'INR', 500n, 500n],
    ['e2', 'AED', -100n, -100n],
    ['p1', 'INR', -300n, 200n],
  ])
  expect(st.closing).toEqual({INR: 200n, AED: -100n})
  expect(st.currencies).toEqual(['AED', 'INR'])
})

test('the date range starts from the balance before it, so the statement closes where the app does', () => {
  const all = [ex('a', '2026-09-10'), ex('b', '2026-10-05'), pay('c', '2026-10-20', 'asha', me, 100n)]
  const full = buildStatement(all, me, {})
  const part = buildStatement(all, me, {from: '2026-10-01', to: '2026-10-31'})
  expect(part.opening).toEqual({INR: 500n})
  expect(part.rows.map(r => r.id)).toEqual(['b', 'c'])
  expect(part.closing).toEqual(full.closing)
  const cut = buildStatement(all, me, {from: '2026-10-01', to: '2026-10-10'})
  expect(cut.closing).toEqual({INR: 1000n})
})

test('a group statement lists every record in it and ends at my net there', () => {
  const g = 'trip'
  const st = buildStatement(
    [
      ex('x', '2026-10-01', {groupId: g, payers: {asha: 900n}, shares: {me: 300n, asha: 300n, ben: 300n}, total: 900n}),
      ex('y', '2026-10-02', {groupId: g, payers: {ben: 600n}, shares: {asha: 600n}, total: 600n}), // I am not in it
      ex('z', '2026-10-02', {groupId: 'other'}),
      pay('w', '2026-10-03', me, 'asha', 100n, 'repayment', 'INR', g),
    ],
    me,
    {groupId: g},
  )
  expect(st.rows.map(r => r.id)).toEqual(['x', 'y', 'w'])
  expect(st.rows.map(r => r.effect)).toEqual([-300n, 0n, 100n])
  expect(st.closing).toEqual({INR: -200n})
})

test('a person statement counts only what is between me and them', () => {
  const st = buildStatement(
    [
      ex('a', '2026-10-01'),
      ex('b', '2026-10-02', {payers: {ben: 900n}, shares: {me: 300n, asha: 300n, ben: 300n}, total: 900n}),
      ex('c', '2026-10-03', {payers: {me: 400n}, shares: {me: 200n, ben: 200n}, total: 400n}), // no Asha
      pay('p', '2026-10-04', 'asha', me, 100n),
      pay('q', '2026-10-05', 'ben', me, 50n),
    ],
    me,
    {personId: 'asha'},
  )
  expect(st.rows.map(r => r.id)).toEqual(['a', 'p']) // b: Asha and I both owe Ben, nothing between us
  expect(st.closing).toEqual({INR: 400n})
})

test('one currency only, and tombstones never appear', () => {
  const dead = ex('d', '2026-10-01')
  ;(dead.record as {deleted: boolean}).deleted = true
  const st = buildStatement([dead, ex('a', '2026-10-02'), ex('u', '2026-10-02', {currency: 'USD'})], me, {currency: 'USD'})
  expect(st.rows.map(r => r.id)).toEqual(['u'])
  expect(st.currencies).toEqual(['USD'])
})

test('write-offs are listed as their own kind and move the balance like a payment', () => {
  const st = buildStatement([ex('a', '2026-10-01'), pay('w', '2026-10-02', 'asha', me, 500n, 'writeoff')], me, {})
  expect(st.rows[1]).toMatchObject({kind: 'writeoff', balance: 0n})
})

test('reconcile: when the app routes a group balance differently, one labelled adjustment closes the gap', () => {
  const st = buildStatement([ex('a', '2026-10-01')], me, {personId: 'asha'})
  expect(reconcileStatement(st, {INR: 500n}).adjustments).toEqual({})
  const r = reconcileStatement(st, {INR: 200n, AED: -50n})
  expect(r.adjustments).toEqual({INR: -300n, AED: -50n})
  expect(r.closing).toEqual({INR: 200n, AED: -50n})
  expect(r.currencies).toEqual(['AED', 'INR'])
})
