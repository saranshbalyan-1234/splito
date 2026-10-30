import {describe, expect, test} from 'bun:test'

import {parseAmount} from '@splito/domain'

import {type Group, type Person} from '../src/mutations'
import {searchStore} from '../src/search'
import {wordsOf} from '../src/searchTerms'
import {openSqlStore} from '../src/sqlStore'
import {bunExecutor} from './bunExecutor'
import {entity, expense, put, resetClock} from './searchFixture'

/*
 * The term keys are the whole search, so they must give exactly the answer the rows give. A seeded ledger of mixed
 * expenses (groups, people, currencies, dates, deletions) is searched with every kind of token, and each answer is
 * compared with the same question asked of the rows one by one.
 */
const today = '2026-10-26'
const categories = [
  {id: 'food', name: 'Food'},
  {id: 'transport', name: 'Transport'},
]
const names: Record<string, string> = {me: 'Asha Rao', riya: 'Riya Sharma', sam: 'Sam Carter', ravi: 'Ravi Kumar'}
const groupNames: Record<string, string> = {goa: 'Goa trip Candolim', lis: 'Lisbon', flat: 'Flat'}
const titles = ['dinner', 'lunch', 'cab ride', 'rent', 'groceries', 'movie night', 'coffee', 'hotel', 'flight', 'snacks']

let seed = 7
const rand = (n: number) => {
  seed = (seed * 1103515245 + 12345) % 2147483648
  return (seed >> 8) % n
}

function build(size: number) {
  const out: ReturnType<typeof expense>[] = []
  const ppl = Object.keys(names)
  for (let i = 0; i < size; i++) {
    const payer = ppl[rand(ppl.length)]!
    const among = ppl.filter(() => rand(2) === 0)
    if (!among.length) among.push('me')
    const total = BigInt((1 + rand(900)) * 200)
    const each = total / BigInt(among.length)
    const e = expense(`x${i}`, {
      title: `${titles[rand(titles.length)]} ${rand(50)}`,
      notes: rand(5) === 0 ? 'with friends after work' : '',
      groupId: ['goa', 'lis', 'flat', null][rand(4)] ?? null,
      currency: ['INR', 'EUR', 'JPY'][rand(3)]!,
      total,
      payers: {[payer]: total},
      split: {mode: 'equal', participants: among},
      shares: Object.fromEntries(among.map(p => [p, each])),
      date: `2026-${String(1 + rand(12)).padStart(2, '0')}-${String(1 + rand(28)).padStart(2, '0')}`,
      category: ['food', 'transport', 'misc'][rand(3)]!,
    })
    // A few payers/shares don't add up exactly after integer division; the store only needs them present.
    if (rand(15) === 0) e.deleted = true
    out.push(e)
  }
  return out
}

describe('the keys give the answer the rows give', () => {
  test('words, groups, people, categories, amounts, months, payers and currencies on 1,200 expenses', async () => {
    resetClock()
    const store = await openSqlStore(bunExecutor(':memory:'))
    const rows = build(1200)
    await put(store, [
      ...Object.entries(names).map(([id, name]) => entity<Person>('person', id, {name, isMe: id === 'me'})),
      ...Object.entries(groupNames).map(([id, name]) => entity<Group>('group', id, {name, kind: 'trip', currency: 'INR', members: [], startDate: null, endDate: null, archived: false})),
      ...rows,
    ])
    const catName = new Map(categories.map(c => [c.id, c.name]))
    const wordsOfRow = (e: (typeof rows)[number]) => {
      const d = e.data
      const text = [d.title, d.notes, catName.get(d.category) ?? '', d.groupId ? groupNames[d.groupId]! : '']
      for (const id of new Set([...Object.keys(d.payers), ...Object.keys(d.shares)])) text.push(names[id]!)
      return wordsOf(text.join(' '))
    }
    const newestFirst = (a: (typeof rows)[number], b: (typeof rows)[number]) =>
      a.data.date === b.data.date ? b.createdAt - a.createdAt || (a.id < b.id ? -1 : 1) : a.data.date < b.data.date ? 1 : -1
    /** What a typed number means in the expense's own currency (a yen has no cents). */
    const typed = (e: (typeof rows)[number], n: number) => parseAmount(String(n), e.data.currency)
    const month = (e: (typeof rows)[number]) => e.data.date.slice(5, 7)
    const cases: Array<[string, (e: (typeof rows)[number]) => boolean]> = [
      ['dinner', e => wordsOfRow(e).some(w => w.startsWith('dinner'))],
      ['d', e => wordsOfRow(e).some(w => w.startsWith('d'))],
      ['goa', e => wordsOfRow(e).some(w => w.startsWith('goa'))],
      ['candolim', e => wordsOfRow(e).some(w => w.startsWith('candolim'))],
      ['riya', e => wordsOfRow(e).some(w => w.startsWith('riya'))],
      ['transport', e => e.data.category === 'transport'],
      ['dinner goa', e => wordsOfRow(e).some(w => w.startsWith('dinner')) && wordsOfRow(e).some(w => w.startsWith('goa'))],
      ['> 500', e => e.data.total > typed(e, 500)],
      ['between 100 and 300', e => e.data.total >= typed(e, 100) && e.data.total <= typed(e, 300)],
      ['paid by sam', e => Object.keys(e.data.payers).includes('sam')],
      ['with ravi', e => [...Object.keys(e.data.payers), ...Object.keys(e.data.shares)].includes('ravi')],
      ['march', e => month(e) === '03' || wordsOfRow(e).some(w => w.startsWith('march'))],
      ['last month', e => e.data.date >= '2026-09-01' && e.data.date <= '2026-09-31'],
      ['EUR', e => e.data.currency === 'EUR'],
      ['deleted', e => e.deleted],
      ['march or june', e => ['03', '06'].includes(month(e))],
      ['food or transport', e => ['food', 'transport'].includes(e.data.category)],
      ['paid by riya march over 300', e => Object.keys(e.data.payers).includes('riya') && month(e) === '03' && e.data.total > typed(e, 300)],
    ]
    for (const [q, keep] of cases) {
      const want = rows.filter(keep).sort(newestFirst)
      const got = await searchStore(store, q, {today, categories, me: 'me'})
      if (want.length === 0) throw new Error(`the oracle finds nothing for "${q}"`)
      expect(got.expenses.map(e => e.id)).toEqual(want.map(e => e.id))
      const live = want.filter(e => !e.deleted)
      const totals: Record<string, bigint> = {}
      for (const e of live) totals[e.data.currency] = (totals[e.data.currency] ?? 0n) + e.data.total
      expect(got.totals).toEqual(totals)
    }
    await store.close()
  })
})
