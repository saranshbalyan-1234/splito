import {expect, test} from 'bun:test'
import {type CurrencyCode, type DateRange, NO_RULES, recordCells, type SpendCell, ZERO} from '@splito/domain'

import {answerIntent, type AskEnv} from './answer'
import {parseQuestion} from './parse'
import {resolvePeriod} from './period'
import {type AskSource} from './source'
import {type Answer} from './types'

/*
 * The engine on a scripted source: what it does with what it reads, apart
 * from the database (data/askSource.test.ts checks it against the real
 * store and the screens).
 */

const ME = 'me'
const TODAY = '2026-10-27'
const expense = (id: string, currency: CurrencyCode, total: bigint, mine: bigint, date: string, category = 'food', groupId: string | null = null) =>
  recordCells({kind: 'expense', id, groupId, currency, total, payers: {[ME]: total}, shares: {[ME]: mine, a: total - mine}, date, deleted: false, ...({category} as object)} as never)

const CELLS: Record<CurrencyCode, SpendCell[]> = {
  INR: [
    ...expense('e1', 'INR', 100000n, 50000n, '2026-10-03', 'food'),
    ...expense('e2', 'INR', 60000n, 30000n, '2026-10-10', 'transport'),
    ...expense('e3', 'INR', 40000n, 20000n, '2026-03-05', 'food', 'g1'),
  ],
  EUR: expense('e4', 'EUR', 2000n, 1000n, '2026-10-04', 'food'),
}

function source(over: Partial<AskSource> = {}): AskSource {
  return {
    balanceRows: async () => [],
    groupNets: async () => ({nets: {}, rules: NO_RULES}),
    currencies: async () => ['INR', 'EUR'],
    cells: async (currency, range: DateRange) => (CELLS[currency] ?? []).filter(c => c.date >= range.from && c.date <= range.to),
    bounds: async currency => ((CELLS[currency] ?? []).length ? {from: '2026-03-05', to: '2026-10-10'} : null),
    search: async () => ({found: [], isDone: true, totals: {}}),
    ...over,
  }
}

const categories = [
  {id: 'food', name: 'Food', color: '#f97316'},
  {id: 'transport', name: 'Transport', color: '#0ea5e9'},
  {id: 'other', name: 'Other', color: '#94a3b8'},
]
const env = (over: Partial<AskEnv> = {}): AskEnv => ({
  source: source(),
  me: ME,
  today: TODAY,
  weekStart: 1,
  defaultCurrency: 'INR',
  mark: '.',
  people: [{id: 'a', name: 'Asha Rao'}],
  groups: [{id: 'g1', name: 'Goa trip'}],
  categories,
  ...over,
})
const ask = (q: string, e = env()): Promise<Answer> => answerIntent(parseQuestion(q, {people: e.people, groups: e.groups, categories: e.categories}), e)

test('periods resolve on today: this month, last week, a named month, the last 30 days', () => {
  expect(resolvePeriod({kind: 'month', offset: 0}, TODAY, 1)).toMatchObject({from: '2026-10-01', to: '2026-10-31'})
  expect(resolvePeriod({kind: 'week', offset: -1}, TODAY, 1)).toMatchObject({from: '2026-10-19', to: '2026-10-25'})
  expect(resolvePeriod({kind: 'monthOf', month: 12}, TODAY, 1)).toMatchObject({from: '2025-12-01', to: '2025-12-31'})
  expect(resolvePeriod({kind: 'monthOf', month: 2, year: 2024}, TODAY, 1)).toMatchObject({from: '2024-02-01', to: '2024-02-29'})
  expect(resolvePeriod({kind: 'days', n: 30}, TODAY, 1)).toMatchObject({from: '2026-09-28', to: TODAY})
  expect(resolvePeriod({kind: 'months', n: 3}, TODAY, 1)).toMatchObject({from: '2026-08-01', to: TODAY})
  expect(resolvePeriod({kind: 'yesterday'}, TODAY, 1)).toMatchObject({from: '2026-10-26', to: '2026-10-26'})
  expect(resolvePeriod({kind: 'all'}, TODAY, 1)).toBeNull()
})

test('spending is one line per currency and never summed across them', async () => {
  const a = await ask('How much did I spend this month?')
  if (a.kind !== 'spend') throw new Error(a.kind)
  expect(a.measure).toBe('share')
  expect(a.currencies.map(c => [c.currency, c.share, c.count])).toEqual([
    ['INR', 80000n, 2],
    ['EUR', 1000n, 1],
  ])
  expect(a.period).toMatchObject({kind: 'month', from: '2026-10-01', to: '2026-10-31'})
  // An open question gets the category split, in its own currency.
  expect(a.currencies[0]!.slices.map(s => [s.key, s.value])).toEqual([['food', 50000n], ['transport', 30000n]])
})

test('a category that is gone is drawn as the real Other, with its colour, not as a blank', async () => {
  const gone = await ask('How much did I spend this month?', env({source: source(), categories: categories.filter(c => c.id !== 'transport')}))
  if (gone.kind !== 'spend') throw new Error(gone.kind)
  expect(gone.currencies[0]!.slices.find(s => s.key === 'transport')).toMatchObject({label: 'Other', color: '#94a3b8'})
})

test('a category and a measure narrow the figure: food, what I paid, everyone\'s total', async () => {
  const food = await ask('How much did I spend on food this month?')
  if (food.kind !== 'spend') throw new Error(food.kind)
  expect(food.category?.id).toBe('food')
  expect(food.currencies.map(c => [c.currency, c.share])).toEqual([['INR', 50000n], ['EUR', 1000n]])
  const total = await ask('How much did everyone spend on food this month?')
  if (total.kind !== 'spend') throw new Error(total.kind)
  expect(total.measure).toBe('total')
  expect(total.currencies[0]!.total).toBe(100000n)
})

test('a person narrows to their share, a group to its records', async () => {
  const asha = await ask('how much did Asha spend this month')
  if (asha.kind !== 'spend') throw new Error(asha.kind)
  expect(asha.currencies[0]!.share).toBe(80000n)
  const goa = await ask('how much did I spend in Goa trip')
  if (goa.kind !== 'spend') throw new Error(goa.kind)
  expect(goa.period.kind).toBe('all')
  expect(goa.currencies).toHaveLength(1)
  expect(goa.currencies[0]).toMatchObject({currency: 'INR', share: 20000n})
})

test('a period with nothing in it is an empty answer, not an error', async () => {
  const a = await ask('how much did I spend yesterday')
  if (a.kind !== 'spend') throw new Error(a.kind)
  expect(a.currencies).toEqual([])
})

test('a trend by day over a long period is drawn by month and says so', async () => {
  const a = await ask('daily spending all time')
  if (a.kind !== 'trend') throw new Error(a.kind)
  expect(a.bucket).toBe('month')
  expect(a.isCoarsened).toBe(true)
  const inr = a.currencies.find(c => c.currency === 'INR')!
  expect(inr.total).toBe(100000n)
  expect(inr.points.map(p => p.key)).toEqual(['2026-03-01', '2026-04-01', '2026-05-01', '2026-06-01', '2026-07-01', '2026-08-01', '2026-09-01', '2026-10-01'])
})

test('a trend by day over a short period stays by day', async () => {
  const a = await ask('daily spending this month')
  if (a.kind !== 'trend') throw new Error(a.kind)
  expect(a.bucket).toBe('day')
  expect(a.isCoarsened).toBe(false)
  expect(a.currencies[0]!.points).toHaveLength(31)
})

test('splitting an amount N ways is exact, and the odd minor unit is shown', async () => {
  const a = await ask('split 1000 3 ways')
  expect(a).toEqual({kind: 'split', title: undefined, ways: 3, amount: {currency: 'INR', amount: 100000n}, each: {high: 33334n, low: 33333n, highCount: 1}})
  const even = await ask('split $90 among 3 people')
  expect(even).toMatchObject({amount: {currency: 'USD', amount: 9000n}, each: {high: 3000n, low: 3000n, highCount: 3}})
  const nothing = await ask("Split last night's dinner 3 ways")
  expect(nothing).toMatchObject({kind: 'split', title: 'Dinner', ways: 3, amount: undefined, each: undefined})
})

test('find reports how many it read and whether that is all', async () => {
  const partial = await ask('find expenses with pizza', env({source: source({search: async (q, limit) => ({found: Array.from({length: limit}, (_, i) => ({id: `e${i}`, title: `Pizza ${i}`, date: '2026-10-01', currency: 'INR', total: 1000n, groupId: i % 2 ? 'g1' : null})), isDone: false, totals: {}})})}))
  if (partial.kind !== 'find') throw new Error(partial.kind)
  expect(partial).toMatchObject({query: 'pizza', count: 30, isPartial: true, totals: []})
  expect(partial.rows).toHaveLength(5)
  expect(partial.rows[1]!.group).toBe('Goa trip')
  const done = await ask('find expenses with pizza', env({source: source({search: async () => ({found: [{id: 'x', title: 'Pizza', date: '2026-10-01', currency: 'INR', total: 1000n, groupId: null}], isDone: true, totals: {INR: 1000n}})})}))
  expect(done).toMatchObject({count: 1, isPartial: false, totals: [{currency: 'INR', amount: 1000n}]})
})

test('who owes whom in a group is the settle-up plan per currency, and my net is read from the same sums', async () => {
  const e = env({source: source({groupNets: async () => ({nets: {INR: {[ME]: 3000n, a: -3000n}, EUR: {[ME]: -500n, a: 500n}}, rules: NO_RULES})})})
  const a = await ask('Who owes whom in Goa trip?', e)
  if (a.kind !== 'groupBalance') throw new Error(a.kind)
  expect(a.mine).toEqual([{currency: 'EUR', amount: -500n}, {currency: 'INR', amount: 3000n}])
  expect(a.owes.map(t => [t.currency, t.from.id, t.to.id, t.amount])).toEqual([['EUR', ME, 'a', 500n], ['INR', 'a', ME, 3000n]])
})

test('rankings are per currency, largest first, and a settled friend is left out', async () => {
  const rows = [
    {person: 'a', groupId: null, currency: 'INR', amount: 5000n},
    {person: 'b', groupId: null, currency: 'INR', amount: 9000n},
    {person: 'c', groupId: null, currency: 'INR', amount: -2000n},
    {person: 'a', groupId: 'g1', currency: 'EUR', amount: 300n},
  ]
  const e = env({people: [{id: 'a', name: 'Asha'}, {id: 'b', name: 'Bo'}, {id: 'c', name: 'Cy'}], source: source({balanceRows: async () => rows})})
  const a = await ask('Who owes me the most?', e)
  if (a.kind !== 'ranking') throw new Error(a.kind)
  expect(a.owedToMe.map(r => [r.person.id, r.currency, r.amount])).toEqual([['b', 'INR', 9000n], ['a', 'INR', 5000n], ['a', 'EUR', 300n]])
  expect(a.iOwe.map(r => [r.person.id, r.amount])).toEqual([['c', 2000n]])
  expect(a.totals.owedToMe).toEqual([{currency: 'INR', amount: 14000n}, {currency: 'EUR', amount: 300n}].sort((x, y) => (x.currency === 'INR' ? -1 : 1) * (y.currency === x.currency ? 0 : 1)))
  expect(a.totals.owedToMe.every(t => t.amount > ZERO)).toBe(true)
})

test('what the engine cannot answer comes back as it is, never as a figure', async () => {
  const a = await ask('Will I be able to afford a new phone?')
  expect(a.kind).toBe('unsupported')
  expect(await ask('hi')).toEqual({kind: 'help'})
})

test('a balance shows each way on its own, never netted across direct and groups (as People does)', async () => {
  const rows = [
    {person: 'a', groupId: null, currency: 'INR', amount: -45000n},
    {person: 'a', groupId: 'g1', currency: 'INR', amount: 602800n},
  ]
  const e = env({source: source({balanceRows: async () => rows})})
  const a = await ask('What does Asha owe me?', e)
  if (a.kind !== 'balance') throw new Error(a.kind)
  expect(a.lines).toHaveLength(1)
  expect(a.lines[0]).toMatchObject({currency: 'INR', owed: 602800n, owe: 45000n, direct: -45000n})
  expect(a.lines[0]!.groups).toEqual([{group: {id: 'g1', name: 'Goa trip'}, amount: 602800n}])
})

test('a friend\'s spend is their share and counts only the records they are in', async () => {
  // Two records: one shared with Asha, one that is only mine. Whole-record counts and totals would include both.
  const cells = [
    ...recordCells({kind: 'expense', id: 'x1', groupId: null, currency: 'INR', total: 10000n, payers: {[ME]: 10000n}, shares: {[ME]: 5000n, a: 5000n}, date: '2026-10-03', deleted: false, ...({category: 'food'} as object)} as never),
    ...recordCells({kind: 'expense', id: 'x2', groupId: null, currency: 'INR', total: 90000n, payers: {[ME]: 90000n}, shares: {[ME]: 90000n}, date: '2026-10-04', deleted: false, ...({category: 'food'} as object)} as never),
  ]
  const e = env({source: source({currencies: async () => ['INR'], cells: async () => cells})})
  const asha = {id: 'a', name: 'Asha Rao'}
  for (const measure of ['share', 'total', 'paid'] as const) {
    const a = await answerIntent({kind: 'spend', measure, person: asha, period: {kind: 'month', offset: 0}}, e)
    if (a.kind !== 'spend') throw new Error(a.kind)
    expect(a.measure, measure).toBe('share')
    expect(a.currencies.map(c => [c.share, c.count]), measure).toEqual([[5000n, 1]])
  }
  // Someone in none of the records has no spending, not "2 expenses".
  const nobody = await answerIntent({kind: 'spend', measure: 'share', person: {id: 'zed', name: 'Zed'}, period: {kind: 'month', offset: 0}}, e)
  if (nobody.kind !== 'spend') throw new Error(nobody.kind)
  expect(nobody.currencies).toEqual([])
})

/** A source that records what the engine asked it to read. */
function spy() {
  const reads: Array<{currency: string; range: DateRange; exact: boolean; groupId?: string}> = []
  const src = source({
    cells: async (currency, range, exact, groupId) => {
      reads.push({currency, range, exact, groupId})
      return (CELLS[currency] ?? []).filter(c => c.date >= range.from && c.date <= range.to && (!groupId || c.groupId === groupId))
    },
  })
  return {reads, src}
}

test('"weekly spending all time" is drawn by month from the stored aggregates, one range for every currency', async () => {
  const {reads, src} = spy()
  const a = await ask('weekly spending all time', env({source: src}))
  if (a.kind !== 'trend') throw new Error(a.kind)
  expect(a.bucket).toBe('month')
  expect(a.isCoarsened).toBe(true)
  // No currency was read by day or week (that is a date-index read of every record), and all read the same dates.
  expect(reads.map(r => r.exact)).toEqual([false, false])
  expect(new Set(reads.map(r => `${r.range.from}:${r.range.to}`)).size).toBe(1)
  expect(a.currencies.every(c => c.points.every(p => p.key.endsWith('-01')))).toBe(true)
})

test('a trend uses Analytics\' limits: days up to 31 (92 in a group), weeks up to 183, otherwise months', async () => {
  // The trip runs 47 days: more than a month of days, fewer than a trip's 92.
  const trip = env({source: source({bounds: async (_c, groupId) => (groupId ? {from: '2026-03-05', to: '2026-04-20'} : {from: '2026-03-05', to: '2026-10-10'})})})
  const bucketOf = async (q: string) => {
    const a = await ask(q, trip)
    if (a.kind !== 'trend') throw new Error(a.kind)
    return [a.bucket, a.isCoarsened]
  }
  expect(await bucketOf('daily spending in the last 30 days')).toEqual(['day', false])
  expect(await bucketOf('daily spending in the last 40 days')).toEqual(['month', true])
  expect(await bucketOf('Goa trip spending by day')).toEqual(['day', false])
  expect(await bucketOf('spending by day in the last 47 days')).toEqual(['month', true])
  expect(await bucketOf('weekly spending in the last 3 months')).toEqual(['week', false])
  expect(await bucketOf('weekly spending this year')).toEqual(['month', true])
  // Nothing asked: the natural width for the dates (a month of days, a half year of weeks).
  expect(await bucketOf('spending trend in the last 60 days')).toEqual(['week', false])
})

test('a group in scope is read through its own date index', async () => {
  const {reads, src} = spy()
  const a = await ask('Show my Goa trip spending by day', env({source: src}))
  if (a.kind !== 'trend') throw new Error(a.kind)
  expect(reads.length).toBeGreaterThan(0)
  expect(reads.every(r => r.groupId === 'g1')).toBe(true)
  expect(a.currencies.map(c => c.currency)).toEqual(['INR'])
})

test('who owes whom says when the plan goes outside the rules, and when a currency has no plan', async () => {
  const closed = {allowListOnly: true, edges: {}}
  const e = env({
    source: source({
      groupNets: async () => ({
        nets: {INR: {[ME]: 3000n, a: -3000n}, EUR: {a: 100n}},
        rules: closed,
      }),
    }),
  })
  const a = await ask('Who owes whom in Goa trip?', e)
  if (a.kind !== 'groupBalance') throw new Error(a.kind)
  expect(a.outside).toEqual(['INR'])
  // EUR does not add up to zero, so it has no plan: it is named, never dropped.
  expect(a.unplanned).toEqual(['EUR'])
})
