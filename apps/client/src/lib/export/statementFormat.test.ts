import {expect, test} from 'bun:test'
import {buildStatement, type StatementInput} from '@splito/domain'

import {statementCsv, statementHtml, type StatementPage, type StatementText} from './statementFormat'

const expense = (id: string, title: string, over: Partial<{currency: string; total: bigint; groupId: string}> = {}): StatementInput => ({
  record: {kind: 'expense', id, groupId: over.groupId ?? null, currency: over.currency ?? 'INR', total: over.total ?? 1000n, payers: {me: over.total ?? 1000n}, shares: {me: 500n, asha: 500n}, date: '2026-10-01', deleted: false},
  title,
  note: '',
  createdAt: 0,
})

const text: StatementText = {
  describe: r => r.title || 'Payment',
  groupName: () => '',
  groupLocation: id => (id === 'trip' ? 'Goa' : ''),
  paidBy: () => 'You',
  kind: k => ({expense: 'Expense', repayment: 'Payment', writeoff: 'Written off'})[k],
  columns: {date: 'Date', type: 'Type', description: 'Description', group: 'Group', currency: 'Currency', amount: 'Amount', paidBy: 'Paid by', youPaid: 'You paid', yourShare: 'Your share', effect: 'Effect', balance: 'Balance', location: 'Location'},
  opening: 'Opening balance',
  closing: 'Closing balance',
  adjustment: 'Group settle-up',
}
const page: StatementPage = {
  title: 'Statement',
  subject: 'All activity',
  range: 'All dates',
  generated: 'Generated 27 Oct 2026',
  owner: 'Me',
  footnote: 'Currencies are never added together.',
  empty: 'Nothing in this range.',
  currencyHeading: c => c,
  direction: v => (v > 0n ? 'You are owed' : v < 0n ? 'You owe' : 'Settled'),
  columns: {date: 'Date', description: 'Description', group: 'Group', amount: 'Amount', effect: 'Effect', balance: 'Balance'},
}

test('CSV: exact decimals per currency, running balance per currency, closing row for each', () => {
  const st = buildStatement([expense('a', 'Lunch', {groupId: 'trip'}), expense('b', 'Taxi', {currency: 'AED', total: 205n})], 'me', {})
  const lines = statementCsv(st, text).trim().split('\r\n')
  expect(lines[0]).toBe('Date,Type,Description,Group,Currency,Amount,Paid by,You paid,Your share,Effect,Balance,Location')
  expect(lines[1]).toBe('2026-10-01,Expense,Lunch,,INR,10.00,You,10.00,5.00,5.00,5.00,Goa')
  expect(lines[2]).toBe('2026-10-01,Expense,Taxi,,AED,2.05,You,2.05,5.00,-2.95,-2.95,')
  expect(lines.slice(3).map(l => l.split(',').slice(1, 2).concat(l.split(',').slice(4, 5), l.split(',').slice(10, 11)))).toEqual([
    ['Closing balance', 'AED', '-2.95'],
    ['Closing balance', 'INR', '5.00'],
  ])
})

test('CSV: a description that would run as a formula is escaped, a negative amount is not', () => {
  const st = buildStatement([expense('a', '=HYPERLINK("http://x")'), expense('b', '-2+3'), expense('c', '@SUM(A1)'), expense('d', '+1')], 'me', {})
  const csv = statementCsv(st, text)
  for (const bad of ['=HYPERLINK', '-2+3', '@SUM', '+1']) expect(csv).toContain(`'${bad}`)
  expect(csv).not.toMatch(/,=HYPERLINK|,-2\+3|,@SUM|,\+1,/)
})

test('HTML: one table per currency, closing balance, and every cell escaped', () => {
  const st = buildStatement([expense('a', '<script>alert(1)</script> & co'), expense('b', 'Taxi', {currency: 'AED', total: 200n})], 'me', {})
  const html = statementHtml(st, text, page, 'en-IN')
  expect(html).not.toContain('<script>')
  expect(html).toContain('&lt;script&gt;')
  expect(html.match(/<table>/g)?.length).toBe(2)
  expect(html).toContain('Closing balance')
  expect(html).toContain('You are owed')
  expect(statementHtml(buildStatement([], 'me', {}), text, page, 'en-IN')).toContain('Nothing in this range.')
})

test('CSV: the dispute column is last, says Disputed or On hold for a marked record and is empty elsewhere (F-1210)', () => {
  const st = buildStatement([expense('a', 'Lunch'), expense('b', 'Taxi'), expense('c', 'Tea')], 'me', {})
  const withDispute: StatementText = {
    ...text,
    columns: {...text.columns, dispute: 'Dispute'},
    dispute: row => ({a: 'Disputed', b: 'On hold'})[row.id as 'a' | 'b'] ?? '',
  }
  const lines = statementCsv(st, withDispute).trim().split('\r\n')
  expect(lines[0]).toBe('Date,Type,Description,Group,Currency,Amount,Paid by,You paid,Your share,Effect,Balance,Location,Dispute')
  expect(lines[1]!.endsWith(',5.00,,Disputed')).toBe(true)
  expect(lines[2]!.endsWith(',10.00,,On hold')).toBe(true)
  expect(lines[3]!.endsWith(',15.00,,')).toBe(true)
  // The closing row keeps the same number of cells.
  expect(lines.at(-1)!.split(',').length).toBe(13)
  // Without the column nothing changes.
  expect(statementCsv(st, text).split('\r\n')[0]).toBe('Date,Type,Description,Group,Currency,Amount,Paid by,You paid,Your share,Effect,Balance,Location')
})
