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
