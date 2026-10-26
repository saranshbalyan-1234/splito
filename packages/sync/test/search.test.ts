import {describe, expect, test} from 'bun:test'

import {type Expense, type Group, type Person} from '../src/mutations'
import {buildSearchIndex, highlightRanges, parseSearchQuery, search} from '../src/search'
import {type Entity} from '../src/types'

const entity = <T>(type: Entity['type'], id: string, data: T, deleted = false): Entity<T> => ({type, id, data, version: 1, deleted, updatedAt: 1})

const people = [
  entity<Person>('person', 'me', {name: 'Asha Rao', isMe: true}),
  entity<Person>('person', 'riya', {name: 'Riya Sharma', isMe: false}),
  entity<Person>('person', 'sam', {name: 'Sam Carter', isMe: false}),
]
const groups = [
  entity<Group>('group', 'goa', {name: 'Goa trip', kind: 'trip', currency: 'INR', members: [], startDate: null, endDate: null, archived: false}),
  entity<Group>('group', 'lis', {name: 'Lisbon', kind: 'trip', currency: 'EUR', members: [], startDate: null, endDate: null, archived: false}),
]
const categories = [
  {id: 'food', name: 'Food'},
  {id: 'transport', name: 'Transport'},
]

function expense(id: string, over: Partial<Expense>): Entity<Expense> {
  return entity<Expense>('expense', id, {
    title: 'Something',
    groupId: null,
    currency: 'INR',
    total: 10000n,
    payers: {me: 10000n},
    split: {mode: 'equal', participants: ['me', 'riya']},
    shares: {me: 5000n, riya: 5000n},
    date: '2026-01-01',
    tz: 'Asia/Kolkata',
    category: 'food',
    notes: '',
    ...over,
  })
}

const expenses = [
  expense('dinner', {title: 'Dinner at Thalassa', groupId: 'goa', total: 1250000n, date: '2025-12-22'}),
  expense('pasteis', {title: 'Pastéis de Belém', groupId: 'lis', currency: 'EUR', total: 2400n, date: '2026-04-11', shares: {me: 1200n, sam: 1200n}, payers: {me: 2400n}}),
  expense('tram', {title: 'Tram 28 tickets', groupId: 'lis', currency: 'EUR', total: 1250n, date: '2026-04-11', category: 'transport', shares: {me: 625n, sam: 625n}, payers: {sam: 1250n}}),
  expense('ramiro', {title: 'Seafood at Ramiro', groupId: 'lis', currency: 'EUR', total: 18400n, date: '2026-04-13', notes: 'Farewell dinner', shares: {me: 9200n, sam: 9200n}}),
  expense('chai', {title: 'Chai', total: 45000n, date: '2026-03-08'}),
  expense('bar', {
    title: 'Bar tab',
    groupId: 'goa',
    total: 300000n,
    date: '2026-10-25',
    split: {mode: 'items', items: [{id: 'i1', name: 'Kingfisher pints', amount: 300000n, participants: ['me', 'riya']}], tax: 0n, tip: 0n, discount: 0n},
  }),
  expense('today', {title: 'Lunch', total: 150000n, date: '2026-10-26'}),
  expense('gone', {title: 'Dinner deleted'}),
]
expenses[expenses.length - 1]!.deleted = true

const index = buildSearchIndex({expenses, people, groups, categories})
const today = '2026-10-26'
const ids = (q: string) => search(index, q, {today}).expenses.map(e => e.id)

describe('parseSearchQuery', () => {
  test('splits words, amounts, comparisons and dates', () => {
    expect(parseSearchQuery('Dinner > 1,000 march 2026')).toEqual([
      {kind: 'compare', op: '>', amount: '1000'},
      {kind: 'text', text: 'dinner'},
      {kind: 'month', month: '03', year: '2026', text: 'march'},
    ])
    expect(parseSearchQuery('₹450 yesterday')).toEqual([
      {kind: 'amount', amount: '450', text: '450'},
      {kind: 'day', offset: -1, text: 'yesterday'},
    ])
    expect(parseSearchQuery('<=12,50')).toEqual([{kind: 'compare', op: '<=', amount: '12.50'}])
    expect(parseSearchQuery('   ')).toEqual([])
  })
})

describe('search', () => {
  test('matches word prefixes, ignoring case and accents', () => {
    expect(ids('din')).toEqual(['ramiro', 'dinner'])
    expect(ids('PASTEIS bel')).toEqual(['pasteis'])
    expect(ids('inner')).toEqual([])
  })

  test('looks in notes, items, category, people and group', () => {
    expect(ids('farewell')).toEqual(['ramiro'])
    expect(ids('kingfisher')).toEqual(['bar'])
    expect(ids('transport')).toEqual(['tram'])
    expect(ids('sam lisbon')).toEqual(['ramiro', 'tram', 'pasteis'])
    expect(ids('goa riya')).toEqual(['bar', 'dinner'])
  })

  test('a number matches that amount in any currency, or the text', () => {
    expect(ids('450')).toEqual(['chai'])
    expect(ids('12.50')).toEqual(['tram'])
    expect(ids('28')).toEqual(['tram'])
    expect(ids('12500')).toEqual(['dinner'])
  })

  test('comparisons use each expense in its own currency', () => {
    expect(ids('> 1000')).toEqual(['today', 'bar', 'dinner'])
    expect(ids('>=1500')).toEqual(['today', 'bar', 'dinner'])
    expect(ids('>1500')).toEqual(['bar', 'dinner'])
    expect(ids('<24 lisbon')).toEqual(['tram'])
    // Same day: the later-added expense first.
    expect(ids('<=24 lisbon')).toEqual(['tram', 'pasteis'])
  })

  test('date words', () => {
    expect(ids('yesterday')).toEqual(['bar'])
    expect(ids('today')).toEqual(['today'])
    expect(ids('march')).toEqual(['chai'])
    expect(ids('apr 2026')).toEqual(['ramiro', 'tram', 'pasteis'])
    expect(ids('april 2025')).toEqual([])
    expect(ids('2025')).toEqual(['dinner'])
  })

  test('people and groups match by name; deleted expenses never show', () => {
    const r = search(index, 'sa', {today})
    expect(r.people.map(p => p.id)).toEqual(['sam'])
    expect(search(index, 'goa', {today}).groups.map(g => g.id)).toEqual(['goa'])
    expect(search(index, '> 10', {today}).people).toEqual([])
    expect(ids('deleted')).toEqual([])
  })

  test('totals per currency, never mixed', () => {
    expect(search(index, 'din', {today}).totals).toEqual({EUR: 18400n, INR: 1250000n})
    expect(search(index, '', {today})).toEqual({expenses: [], people: [], groups: [], totals: {}, terms: []})
  })

  test('terms are what to highlight', () => {
    expect(search(index, 'Dinner > 100 apr', {today}).terms).toEqual(['dinner', 'apr'])
  })
})

describe('highlightRanges', () => {
  test('marks word prefixes in the original text', () => {
    expect(highlightRanges('Dinner at Thalassa', ['din', 'th'])).toEqual([
      [0, 3],
      [10, 12],
    ])
    expect(highlightRanges('Pastéis de Belém', ['pasteis', 'bel'])).toEqual([
      [0, 7],
      [11, 14],
    ])
    expect(highlightRanges('Thalassa', ['ala'])).toEqual([])
    expect(highlightRanges('Riya', [])).toEqual([])
  })
})

describe('speed', () => {
  test('2,000 expenses: every query under 50 ms', () => {
    const words = ['dinner', 'lunch', 'cab', 'rent', 'groceries', 'movie', 'coffee', 'hotel', 'flight', 'snacks']
    const many = Array.from({length: 2000}, (_, i) =>
      expense(`e${i}`, {
        title: `${words[i % words.length]} ${i}`,
        notes: i % 7 ? '' : 'with friends after work',
        groupId: i % 3 ? 'goa' : null,
        currency: i % 5 ? 'INR' : 'EUR',
        total: BigInt(1000 + ((i * 7919) % 500000)),
        date: `2026-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`,
      }),
    )
    let t0 = performance.now()
    const big = buildSearchIndex({expenses: many, people, groups, categories})
    const buildMs = performance.now() - t0
    const queries = ['d', 'di', 'din', 'dinner', 'dinner goa', '450', '> 1000', '< 50 riya', 'march', 'yesterday', 'friends work', 'f', 'zzz']
    let worst = 0
    for (const q of queries) {
      t0 = performance.now()
      search(big, q, {today})
      worst = Math.max(worst, performance.now() - t0)
    }
    console.log(`search index: build ${buildMs.toFixed(1)} ms, worst query ${worst.toFixed(2)} ms over ${queries.length} queries`)
    expect(worst).toBeLessThan(50)
    expect(buildMs).toBeLessThan(500)
  })
})
