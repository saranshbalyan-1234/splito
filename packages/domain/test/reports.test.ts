import {describe, expect, test} from 'bun:test'
import fc from 'fast-check'

import {type ExpenseRecord, pairwiseBalances, type RepaymentRecord} from '../src/ledger'
import {
  addDays,
  axisTicks,
  balanceTrend,
  buckets,
  csvCell,
  dataRange,
  formatAmountCompact,
  granularityFor,
  periodRange,
  type ReportExpense,
  reportCsv,
  type ReportFilter,
  selectExpenses,
  spendingByCategory,
  spendingByGroup,
  spendingByPerson,
  spendingOverTime,
  spendingTotals,
  todayIn,
  toCsv,
} from '../src/reports'
import {computeShares} from '../src/split'

const exp = (e: Partial<ReportExpense> & Pick<ReportExpense, 'id' | 'total' | 'payers' | 'shares'>): ReportExpense => ({
  kind: 'expense',
  groupId: null,
  currency: 'INR',
  date: '2026-01-10',
  deleted: false,
  category: 'food',
  title: 'Lunch',
  ...e,
})
const rep = (r: Partial<RepaymentRecord> & Pick<RepaymentRecord, 'from' | 'to' | 'amount'>): RepaymentRecord => ({
  kind: 'repayment',
  id: 'r' + r.from + r.to + r.amount,
  groupId: null,
  currency: 'INR',
  date: '2026-01-15',
  deleted: false,
  ...r,
})

/* A small known ledger: me, a, b. Dates span two months; one EUR record; one deleted; one repayment. */
const lunch = exp({id: 'lunch', total: 300n, payers: {me: 300n}, shares: {me: 100n, a: 100n, b: 100n}, date: '2026-01-10'})
const cab = exp({id: 'cab', total: 200n, payers: {a: 200n}, shares: {me: 100n, a: 100n}, date: '2026-01-20', category: 'transport', groupId: 'trip'})
const rent = exp({id: 'rent', total: 900n, payers: {b: 900n}, shares: {me: 300n, a: 300n, b: 300n}, date: '2026-02-01', category: 'bills', groupId: 'flat'})
const euro = exp({id: 'euro', currency: 'EUR', total: 50n, payers: {me: 50n}, shares: {me: 25n, a: 25n}, date: '2026-01-12'})
const gone = exp({id: 'gone', total: 999n, payers: {me: 999n}, shares: {me: 999n}, deleted: true})
const payback = rep({from: 'me', to: 'b', amount: 300n, date: '2026-02-05', groupId: 'flat'})
const LEDGER = [lunch, cab, rent, euro, gone, payback]

const ALL_INR: ReportFilter = {currency: 'INR', range: {from: '2026-01-01', to: '2026-12-31'}, includeGroups: true}

describe('dates and periods', () => {
  test('todayIn uses the chosen timezone, not UTC', () => {
    const now = Date.UTC(2026, 9, 25, 20, 0) // 2026-10-25 20:00Z
    expect(todayIn('Asia/Kolkata', now)).toBe('2026-10-26')
    expect(todayIn('America/Los_Angeles', now)).toBe('2026-10-25')
    expect(todayIn('UTC', now)).toBe('2026-10-25')
  })
  test('addDays crosses months, years and leap days', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01')
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
  })
  test('week honours the week start preference', () => {
    // 2026-10-28 is a Wednesday.
    expect(periodRange('week', '2026-10-28', 1)).toEqual({from: '2026-10-26', to: '2026-11-01'})
    expect(periodRange('week', '2026-10-28', 0)).toEqual({from: '2026-10-25', to: '2026-10-31'})
    expect(periodRange('week', '2026-10-28', 6)).toEqual({from: '2026-10-24', to: '2026-10-30'})
    expect(periodRange('week', '2026-10-26', 1)).toEqual({from: '2026-10-26', to: '2026-11-01'})
  })
  test('month and year, with offsets to step back and forward', () => {
    expect(periodRange('month', '2026-02-14', 1)).toEqual({from: '2026-02-01', to: '2026-02-28'})
    expect(periodRange('month', '2026-01-31', 1, -1)).toEqual({from: '2025-12-01', to: '2025-12-31'})
    expect(periodRange('month', '2026-12-05', 1, 1)).toEqual({from: '2027-01-01', to: '2027-01-31'})
    expect(periodRange('year', '2026-06-01', 1, -1)).toEqual({from: '2025-01-01', to: '2025-12-31'})
    expect(periodRange('week', '2026-01-01', 1, -1)).toEqual({from: '2025-12-22', to: '2025-12-28'})
  })
  test('a month boundary follows the viewer timezone at the instant it is read', () => {
    const now = Date.UTC(2026, 9, 31, 20, 0) // Oct 31 20:00Z = Nov 1 01:30 in Kolkata
    const oct31 = exp({id: 'x', total: 10n, payers: {me: 10n}, shares: {me: 10n}, date: '2026-10-31'})
    const inMonth = (tz: string) =>
      selectExpenses([oct31], {currency: 'INR', includeGroups: true, range: periodRange('month', todayIn(tz, now), 1)}).length
    expect(inMonth('America/Los_Angeles')).toBe(1)
    expect(inMonth('Asia/Kolkata')).toBe(0)
  })
  test('granularity grows with the range', () => {
    expect(granularityFor({from: '2026-10-01', to: '2026-10-31'})).toBe('day')
    expect(granularityFor({from: '2026-01-01', to: '2026-03-31'})).toBe('week')
    expect(granularityFor({from: '2025-01-01', to: '2026-12-31'})).toBe('month')
    expect(granularityFor({from: '2020-01-01', to: '2026-12-31'})).toBe('year')
  })
  test('buckets tile the range exactly, clipped at both ends', () => {
    const b = buckets({from: '2026-10-28', to: '2026-11-10'}, 'week', 1)
    expect(b).toEqual([
      {key: '2026-10-26', from: '2026-10-28', to: '2026-11-01'},
      {key: '2026-11-02', from: '2026-11-02', to: '2026-11-08'},
      {key: '2026-11-09', from: '2026-11-09', to: '2026-11-10'},
    ])
    expect(buckets({from: '2026-01-01', to: '2026-12-31'}, 'month', 1)).toHaveLength(12)
    expect(buckets({from: '2026-02-01', to: '2026-02-28'}, 'day', 1)).toHaveLength(28)
    expect(buckets({from: '2025-06-01', to: '2026-02-01'}, 'year', 1).map(x => x.key)).toEqual(['2025-01-01', '2026-01-01'])
  })
  test('dataRange spans live records and today', () => {
    expect(dataRange(LEDGER, '2026-03-01')).toEqual({from: '2026-01-10', to: '2026-03-01'})
    expect(dataRange([exp({id: 'f', total: 1n, payers: {me: 1n}, shares: {me: 1n}, date: '2026-12-01'})], '2026-03-01')).toEqual({
      from: '2026-03-01',
      to: '2026-12-01',
    })
    expect(dataRange([], '2026-03-01')).toBeNull()
  })
})

describe('selectExpenses', () => {
  test('one currency, live expenses only; repayments are never spending', () =>
    expect(selectExpenses(LEDGER, ALL_INR).map(e => e.id)).toEqual(['rent', 'cab', 'lunch']))
  test('include groups off keeps non-group expenses only', () =>
    expect(selectExpenses(LEDGER, {...ALL_INR, includeGroups: false}).map(e => e.id)).toEqual(['lunch']))
  test('a group filter keeps that group, whatever include groups says', () =>
    expect(selectExpenses(LEDGER, {...ALL_INR, groupId: 'flat', includeGroups: false}).map(e => e.id)).toEqual(['rent']))
  test('range is inclusive at both ends', () =>
    expect(selectExpenses(LEDGER, {...ALL_INR, range: {from: '2026-01-10', to: '2026-01-20'}}).map(e => e.id)).toEqual(['cab', 'lunch']))
  test('EUR stands alone', () => expect(selectExpenses(LEDGER, {...ALL_INR, currency: 'EUR'}).map(e => e.id)).toEqual(['euro']))
})

describe('spending', () => {
  const inr = selectExpenses(LEDGER, ALL_INR)
  test('totals: your share, what you paid, everyone together', () =>
    expect(spendingTotals(inr, 'me')).toEqual({share: 500n, paid: 300n, total: 1400n, covered: -200n, count: 3}))
  test('over time, by month, keeps empty buckets', () =>
    expect(spendingOverTime(inr, 'me', {from: '2026-01-01', to: '2026-03-31'}, 'month', 1)).toEqual([
      {key: '2026-01-01', from: '2026-01-01', to: '2026-01-31', share: 200n, paid: 300n, total: 500n, covered: 100n, count: 2},
      {key: '2026-02-01', from: '2026-02-01', to: '2026-02-28', share: 300n, paid: 0n, total: 900n, covered: -300n, count: 1},
      {key: '2026-03-01', from: '2026-03-01', to: '2026-03-31', share: 0n, paid: 0n, total: 0n, covered: 0n, count: 0},
    ]))
  test('by category, largest first, ties by id', () =>
    expect(spendingByCategory(inr, 'me')).toEqual([
      {key: 'bills', share: 300n, count: 1},
      {key: 'food', share: 100n, count: 1},
      {key: 'transport', share: 100n, count: 1},
    ]))
  test('a missing category counts as other', () =>
    expect(spendingByCategory([exp({id: 'n', total: 5n, payers: {me: 5n}, shares: {me: 5n}, category: undefined})], 'me')).toEqual([
      {key: 'other', share: 5n, count: 1},
    ]))
  test('by person: everyone’s share of the same expenses', () =>
    expect(spendingByPerson(inr)).toEqual([
      {key: 'a', share: 500n, count: 3},
      {key: 'me', share: 500n, count: 3},
      {key: 'b', share: 400n, count: 2},
    ]))
  test('by group: your share, non-group expenses under null', () =>
    expect(spendingByGroup(inr, 'me')).toEqual([
      {key: 'flat', share: 300n, count: 1},
      {key: null, share: 100n, count: 1},
      {key: 'trip', share: 100n, count: 1},
    ]))
  test('expenses you are not part of still count for the group, not for you', () => {
    const others = [exp({id: 'o', total: 80n, payers: {a: 80n}, shares: {a: 40n, b: 40n}, groupId: 'flat'})]
    expect(spendingTotals(others, 'me')).toEqual({share: 0n, paid: 0n, total: 80n, covered: 0n, count: 1})
    expect(spendingByCategory(others, 'me')).toEqual([])
    expect(spendingByGroup(others, 'me')).toEqual([])
  })
  test('a zero share is not counted as taking part', () =>
    expect(spendingByPerson([exp({id: 'z', total: 10n, payers: {me: 10n}, shares: {me: 10n, a: 0n}})])).toEqual([{key: 'me', share: 10n, count: 1}]))
  test('the parts always add up to the total (property)', () => {
    const people = ['me', 'a', 'b', 'c']
    const arb = fc.array(
      fc.record({
        total: fc.bigInt({min: 1n, max: 10n ** 9n}),
        payer: fc.constantFrom(...people),
        parts: fc.subarray(people, {minLength: 1}),
        category: fc.constantFrom('food', 'bills', 'stay'),
        groupId: fc.constantFrom(null, 'g1', 'g2'),
        day: fc.integer({min: 0, max: 400}),
      }),
      {maxLength: 30},
    )
    fc.assert(
      fc.property(arb, rows => {
        const xs = rows.map((r, i) =>
          exp({
            id: 'e' + i,
            total: r.total,
            payers: {[r.payer]: r.total},
            shares: computeShares(r.total, {mode: 'equal', participants: r.parts}),
            category: r.category,
            groupId: r.groupId,
            date: addDays('2025-06-01', r.day),
          }),
        )
        const t = spendingTotals(xs, 'me')
        const sum = (vs: bigint[]) => vs.reduce((x, y) => x + y, 0n)
        const range = {from: '2025-06-01', to: '2026-07-06'}
        expect(sum(spendingOverTime(xs, 'me', range, 'month', 1).map(b => b.share))).toBe(t.share)
        expect(sum(spendingOverTime(xs, 'me', range, 'week', 0).map(b => b.paid))).toBe(t.paid)
        expect(sum(spendingByCategory(xs, 'me').map(c => c.share))).toBe(t.share)
        expect(sum(spendingByGroup(xs, 'me').map(c => c.share))).toBe(t.share)
        expect(sum(spendingByPerson(xs).map(c => c.share))).toBe(t.total)
      }),
    )
  })
})

describe('balanceTrend', () => {
  test('running balance at the end of each bucket, starting from earlier history, repayments included', () =>
    expect(balanceTrend(LEDGER, 'me', {...ALL_INR, range: {from: '2026-02-01', to: '2026-02-28'}}, 'week', 1)).toEqual([
      // Before Feb: lunch +200 (a and b owe me 100 each), cab -100 (I owe a) => +100.
      {key: '2026-01-26', from: '2026-02-01', to: '2026-02-01', balance: -200n},
      {key: '2026-02-02', from: '2026-02-02', to: '2026-02-08', balance: 100n},
      {key: '2026-02-09', from: '2026-02-09', to: '2026-02-15', balance: 100n},
      {key: '2026-02-16', from: '2026-02-16', to: '2026-02-22', balance: 100n},
      {key: '2026-02-23', from: '2026-02-23', to: '2026-02-28', balance: 100n},
    ]))
  test('ends where the People balances end', () => {
    const trend = balanceTrend(LEDGER, 'me', {...ALL_INR, range: {from: '2026-01-01', to: '2026-12-31'}}, 'month', 1)
    const people = pairwiseBalances(LEDGER, 'me')
      .filter(r => r.currency === 'INR')
      .reduce((s, r) => s + r.amount, 0n)
    expect(trend.at(-1)!.balance).toBe(people)
  })
  test('a multi-payer group expense where everyone paid their share moves nothing', () => {
    const even = exp({id: 'm', groupId: 'trip', date: '2026-03-01', total: 30000n, payers: {me: 10000n, a: 10000n, b: 10000n}, shares: {me: 10000n, a: 10000n, b: 10000n}})
    const trend = balanceTrend([even], 'me', {...ALL_INR, range: {from: '2026-03-01', to: '2026-03-31'}}, 'month', 1)
    expect(trend.at(-1)!.balance).toBe(0n)
  })
  test('scoped to one group', () =>
    expect(
      balanceTrend(LEDGER, 'me', {...ALL_INR, groupId: 'flat', range: {from: '2026-02-01', to: '2026-02-28'}}, 'month', 1),
    ).toEqual([{key: '2026-02-01', from: '2026-02-01', to: '2026-02-28', balance: 0n}]))
})

describe('CSV', () => {
  test('cells that a spreadsheet would run as a formula are defused', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`)
    expect(csvCell('+1')).toBe("'+1")
    expect(csvCell('-cmd')).toBe("'-cmd")
    expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)")
    expect(csvCell('\tx')).toBe("'\tx")
    expect(csvCell('\rx')).toBe(`"'\rx"`)
  })
  test('plain numbers stay numbers, even negative ones', () => {
    expect(csvCell('-12.50')).toBe('-12.50')
    expect(csvCell('1200')).toBe('1200')
  })
  test('quotes, commas and newlines are quoted per RFC 4180', () => {
    expect(csvCell('Dinner, drinks')).toBe('"Dinner, drinks"')
    expect(csvCell('6" sub')).toBe('"6"" sub"')
    expect(csvCell('a\nb')).toBe('"a\nb"')
    expect(csvCell('Pastéis')).toBe('Pastéis')
  })
  test('rows join with CRLF', () => expect(toCsv([['a', 'b'], ['1', '2']])).toBe('a,b\r\n1,2\r\n'))
  test('report rows: exact decimals in the currency’s scale, a currency column, names from the caller', () => {
    const rows = reportCsv([cab, {...lunch, title: '=1+1'}], 'me', {
      header: ['Date', 'Description', 'Category', 'Group', 'Currency', 'Total', 'You paid', 'Your share'],
      categoryName: id => (id === 'food' ? 'Food' : 'Transport'),
      groupName: id => (id === 'trip' ? 'Goa, trip' : ''),
    })
    expect(rows).toBe(
      'Date,Description,Category,Group,Currency,Total,You paid,Your share\r\n' +
        '2026-01-20,Lunch,Transport,"Goa, trip",INR,2.00,0.00,1.00\r\n' +
        "2026-01-10,'=1+1,Food,,INR,3.00,3.00,1.00\r\n",
    )
  })
  test('zero-decimal and three-decimal currencies keep their scale', () => {
    const yen = exp({id: 'y', currency: 'JPY', total: 1200n, payers: {me: 1200n}, shares: {me: 600n, a: 600n}})
    const kwd = exp({id: 'k', currency: 'KWD', total: 1500n, payers: {a: 1500n}, shares: {me: 1500n}})
    const csv = (e: ReportExpense) =>
      reportCsv([e], 'me', {header: [], categoryName: () => '', groupName: () => ''}).split('\r\n')[1]!.split(',').slice(4)
    expect(csv(yen)).toEqual(['JPY', '1200', '1200', '600'])
    expect(csv(kwd)).toEqual(['KWD', '1.500', '0.000', '1.500'])
  })
})

describe('chart axes', () => {
  test('ticks are round steps from zero past the maximum', () => {
    expect(axisTicks(0n, 1234n)).toEqual([0n, 500n, 1000n, 1500n])
    expect(axisTicks(0n, 4000000n)).toEqual([0n, 1000000n, 2000000n, 3000000n, 4000000n])
    expect(axisTicks(0n, 7n)).toEqual([0n, 2n, 4n, 6n, 8n])
  })
  test('signed ranges keep zero as a tick', () => expect(axisTicks(-300n, 200n)).toEqual([-400n, -200n, 0n, 200n]))
  test('nothing to show is a single zero tick', () => expect(axisTicks(0n, 0n)).toEqual([0n]))
  test('compact labels', () => {
    expect(formatAmountCompact(4000000n, 'INR', 'en-US')).toBe('₹40K')
    expect(formatAmountCompact(123456789n, 'USD', 'en-US')).toBe('$1.2M')
    expect(formatAmountCompact(0n, 'EUR', 'en-US')).toBe('€0')
  })
})

/* Keeps the ExpenseRecord import honest: a plain ledger record is a valid report expense. */
const _plain: ReportExpense = {...(lunch as ExpenseRecord)}
void _plain
