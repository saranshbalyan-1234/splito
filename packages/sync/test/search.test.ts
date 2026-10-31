import 'fake-indexeddb/auto'
import os from 'node:os'
import {IDBFactory} from 'fake-indexeddb'

import {beforeAll, describe, expect, test} from 'bun:test'

import {openIdbStore} from '../src/idbStore'
import {type Expense, type Group, type Person, type Repayment} from '../src/mutations'
import {highlightRanges, openSearch, parseSearchQuery, SEARCH_PAGE, searchStore, summarizeSearch} from '../src/search'
import {openSqlStore} from '../src/sqlStore'
import {type Store} from '../src/store'
import {bunExecutor} from './bunExecutor'
import {entity, expense, put, resetClock} from './searchFixture'

const people = [
  entity<Person>('person', 'me', {name: 'Asha Rao', isMe: true}),
  entity<Person>('person', 'riya', {name: 'Riya Sharma', isMe: false}),
  entity<Person>('person', 'sam', {name: 'Sam Carter', isMe: false}),
]
const groups = [
  entity<Group>('group', 'goa', {name: 'Goa trip', location: 'Candolim beach', kind: 'trip', currency: 'INR', members: [], startDate: null, endDate: null, archived: false}),
  entity<Group>('group', 'lis', {name: 'Lisbon', kind: 'trip', currency: 'EUR', members: [], startDate: null, endDate: null, archived: false}),
]
const categories = [
  {id: 'food', name: 'Food'},
  {id: 'transport', name: 'Transport'},
]

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

const today = '2026-10-26'
const ENGINES: Array<[string, () => Promise<Store>]> = [
  ['SQLite', () => openSqlStore(bunExecutor(':memory:'))],
  ['IndexedDB', () => openIdbStore('search', new IDBFactory())],
]
const searchWith = (s: Store) => (q: string, mark: '.' | ',' = '.') => searchStore(s, q, {today, mark, categories})
let find: ReturnType<typeof searchWith>
const ids = async (q: string) => (await find(q)).expenses.map(e => e.id)

describe('parseSearchQuery', () => {
  test('splits words, amounts, comparisons and dates', () => {
    expect(parseSearchQuery('Dinner > 1,000 march 2026')).toEqual([
      {kind: 'text', text: 'dinner'},
      {kind: 'compare', op: '>', amounts: ['1000']},
      {kind: 'month', month: '03', year: '2026', text: 'march'},
    ])
    expect(parseSearchQuery('₹450 yesterday')).toEqual([
      {kind: 'amount', amounts: ['450'], text: '450', currency: 'INR'},
      {kind: 'day', offset: -1, text: 'yesterday'},
    ])
    expect(parseSearchQuery('<=12,50')).toEqual([{kind: 'compare', op: '<=', amounts: ['12.50']}])
    expect(parseSearchQuery('   ')).toEqual([])
  })
})

for (const [engine, open] of ENGINES) {
  describe(`search (${engine})`, () => {
    beforeAll(async () => {
      resetClock()
      const store = await open()
      await put(store, [...people, ...groups, ...expenses])
      find = searchWith(store)
    })

    test('matches word prefixes, ignoring case and accents', async () => {
      expect(await ids('din')).toEqual(['ramiro', 'gone', 'dinner'])
      expect(await ids('PASTEIS bel')).toEqual(['pasteis'])
      expect(await ids('inner')).toEqual([])
    })

    test('looks in notes, items, category, people and group', async () => {
      expect(await ids('farewell')).toEqual(['ramiro'])
      expect(await ids('kingfisher')).toEqual(['bar'])
      expect(await ids('transport')).toEqual(['tram'])
      expect(await ids('sam lisbon')).toEqual(['ramiro', 'tram', 'pasteis'])
      expect(await ids('goa riya')).toEqual(['bar', 'dinner'])
    })

    test('a number matches that amount in any currency, or the text', async () => {
      expect(await ids('450')).toEqual(['chai'])
      expect(await ids('12.50')).toEqual(['tram'])
      expect(await ids('28')).toEqual(['tram'])
      expect(await ids('12500')).toEqual(['dinner'])
    })

    test('comparisons use each expense in its own currency', async () => {
      expect(await ids('> 1000')).toEqual(['today', 'bar', 'dinner'])
      expect(await ids('>=1500')).toEqual(['today', 'bar', 'dinner'])
      expect(await ids('>1500')).toEqual(['bar', 'dinner'])
      expect(await ids('<24 lisbon')).toEqual(['tram'])
      // Same day: the later-created expense first.
      expect(await ids('<=24 lisbon')).toEqual(['tram', 'pasteis'])
    })

    test('date words', async () => {
      expect(await ids('yesterday')).toEqual(['bar'])
      expect(await ids('today')).toEqual(['today'])
      expect(await ids('march')).toEqual(['chai'])
      expect(await ids('apr 2026')).toEqual(['ramiro', 'tram', 'pasteis'])
      expect(await ids('april 2025')).toEqual([])
      expect(await ids('2025')).toEqual(['dinner'])
    })

    test('people and groups match by name; a deleted expense is listed too (the app strikes it)', async () => {
      expect((await find('sa')).people.map(p => p.id)).toEqual(['sam'])
      expect((await find('goa')).groups.map(g => g.id)).toEqual(['goa'])
      // A trip's location is found like its name (owner 182), and so are its expenses.
      expect((await find('candol')).groups.map(g => g.id)).toEqual(['goa'])
      expect((await find('beach')).groups.map(g => g.id)).toEqual(['goa'])
      expect(await ids('candolim')).toEqual(['bar', 'dinner'])
      expect((await find('> 10')).people).toEqual([])
      expect(await ids('deleted')).toEqual(['gone'])
      // "Me" is not a result of its own, and my name does not list my whole ledger (every record is mine).
      expect((await find('asha')).people).toEqual([])
      expect(await ids('asha')).toEqual([])
      expect(await ids('as')).toEqual([])
    })

    test('totals per currency, never mixed', async () => {
      expect((await find('din')).totals).toEqual({EUR: 18400n, INR: 1250000n})
      expect(await find('')).toEqual({expenses: [], people: [], groups: [], payments: [], totals: {}, terms: []})
    })

    test('terms are what to highlight', async () => {
      expect((await find('Dinner > 100 apr')).terms).toEqual(['dinner', 'apr'])
    })

    test('a rename, a deletion and a restore move the keys with them', async () => {
      const store = await open()
      resetClock()
      await put(store, [...people, ...groups, expense('a', {title: 'Alpha', total: 777n, date: '2026-05-05'})])
      const f = searchWith(store)
      expect((await f('alpha')).expenses.map(e => e.id)).toEqual(['a'])
      const a = (await store.get<Expense>('expense', 'a'))!
      await store.transaction(tx => tx.put({...a, version: 2, updatedAt: 99, data: {...a.data, title: 'Beta', total: 888n}}))
      expect((await f('alpha')).expenses).toEqual([])
      expect((await f('beta')).expenses.map(e => e.id)).toEqual(['a'])
      expect((await f('7.77')).expenses).toEqual([])
      expect((await f('8.88')).expenses.map(e => e.id)).toEqual(['a'])
      await store.transaction(tx => tx.put({...a, version: 3, updatedAt: 100, deleted: true, data: {...a.data, title: 'Beta', total: 888n}}))
      // Deleted: still listed (struck by the app), found by its old words and amount, never in the totals.
      expect((await f('beta')).expenses.map(e => [e.id, e.deleted])).toEqual([['a', true]])
      expect((await f('beta')).totals).toEqual({})
      const gone = (await store.get<Expense>('expense', 'a'))!
      await store.transaction(tx => tx.put({...gone, version: 4, updatedAt: 101, deleted: false}))
      expect((await f('beta')).expenses.map(e => e.id)).toEqual(['a'])
      // A person renamed: their expenses are found by the new name at once.
      const riya = (await store.get<Person>('person', 'riya'))!
      await store.transaction(tx => tx.put({...riya, version: 2, updatedAt: 102, data: {...riya.data, name: 'Rhea Sharma'}}))
      expect((await f('rhea')).people.map(p => p.id)).toEqual(['riya'])
      expect((await f('rhea')).expenses.map(e => e.id)).toEqual(['a'])
      expect((await f('riya')).people).toEqual([])
      await store.close()
    })
  })
}

describe.each(ENGINES)('paged search on a broad match (%s)', (_engine, open) => {
  let store: Store
  const opts = {today, categories}
  beforeAll(async () => {
    store = await open()
    resetClock()
    // 700 expenses over 20 days (35 a day, so a day always spans pages), 600 of them "broad ...", every 7th deleted.
    await put(store, [...people, ...groups])
    await put(
      store,
      Array.from({length: 700}, (_, i) =>
        expense(`b${i}`, {
          title: i % 7 === 3 ? `Other ${i}` : `Broad item ${i}`,
          currency: i % 2 ? 'INR' : 'EUR',
          total: BigInt(1000 + i),
          date: `2026-03-${String((i % 20) + 1).padStart(2, '0')}`,
        }),
      ),
    )
    const gone = (await store.get<Expense>('expense', 'b0'))!
    await store.transaction(tx => tx.put({...gone, version: 2, updatedAt: 9999, deleted: true}))
  })

  /** Every match, worked out without the search. */
  async function expected(prefix: string) {
    const all = await store.page<Expense>('expense', {index: 'byDate', limit: 10_000})
    return all.items
      .filter(e => e.data.title.toLowerCase().startsWith(prefix))
      .sort((x, y) => (x.data.date === y.data.date ? y.createdAt - x.createdAt || (x.id < y.id ? -1 : 1) : x.data.date < y.data.date ? 1 : -1))
      .map(e => e.id)
  }

  test('the first page is read on open, in the final order, and the count is known at once', async () => {
    const want = await expected('broad')
    expect(want.length).toBeGreaterThan(500)
    const session = await openSearch(store, 'broad', opts)
    expect(session.summary.count).toBe(want.length)
    expect(session.isDone()).toBe(false)
    expect(session.found().map(e => e.id)).toEqual(want.slice(0, SEARCH_PAGE))
  })

  test('walking to the end gives every match once, newest first, equal to the whole answer', async () => {
    const want = await expected('broad')
    const session = await openSearch(store, 'broad', opts)
    let prev: string[] = []
    while (!session.isDone()) {
      await session.step()
      const now = session.found().map(e => e.id)
      expect(now.slice(0, prev.length)).toEqual(prev)
      prev = now
    }
    expect(session.found().map(e => e.id)).toEqual(want)
    const whole = await searchStore(store, 'broad', opts)
    expect(whole.expenses.map(e => e.id)).toEqual(want)
  })

  test('totals add up every match, per currency, without reading the rows', async () => {
    const want = await expected('broad')
    const session = await openSearch(store, 'broad', opts)
    const rows = (await store.getMany<Expense>('expense', want)).filter(e => !e.deleted)
    // b0 is deleted: listed and counted as a row, never added up.
    expect(session.summary.count).toBe(want.length)
    const sum = (c: string) => rows.filter(e => e.data.currency === c).reduce((a, e) => a + e.data.total, 0n)
    expect(session.summary.totals).toEqual({EUR: sum('EUR'), INR: sum('INR')})
    expect(summarizeSearch(rows)).toEqual({count: rows.length, totals: session.summary.totals})
  })

  test('overlapping steps share one read', async () => {
    const session = await openSearch(store, 'broad', opts)
    await Promise.all([session.step(), session.step(), session.step()])
    expect(session.found().length).toBe(2 * SEARCH_PAGE)
  })

  test('a broad amount comparison pages the same way', async () => {
    // Totals are 10.00 + i cents (b0 is deleted, still listed): "> 12" is i > 200, "< 14" is i <= 400 with b0.
    for (const [q, count, ok] of [
      ['> 12', 499, (t: bigint) => t > 1200n],
      ['< 14', 400, (t: bigint) => t < 1400n],
    ] as const) {
      const session = await openSearch(store, q, opts)
      expect(session.summary.count).toBe(count)
      while (!session.isDone()) await session.step()
      expect(session.found().length).toBe(count)
      for (const e of session.found()) expect(ok(e.data.total)).toBe(true)
    }
  })
})

describe.each(ENGINES)('what an expense can be found by is what the keys say (%s)', (_engine, open) => {
  test('a deleted person or group, and a category id that is not in the list, are not words, on the broad read path too', async () => {
    const store = await open()
    resetClock()
    const group = (id: string, name: string, deleted = false) => entity<Group>('group', id, {name, kind: 'trip', currency: 'INR', members: [], startDate: null, endDate: null, archived: false}, deleted)
    await put(store, [
      ...people,
      entity<Person>('person', 'samir', {name: 'Samir Khan', isMe: false}),
      entity<Person>('person', 'sam2', {name: 'Sam Gone', isMe: false}, true),
      group('lisbonne', 'Lisbonne'),
      group('lis2', 'Lisbon gone', true),
    ])
    // 200 fillers by live Samir in live Lisbonne, category Transportation: every word below reaches 200 expenses (broad).
    await put(
      store,
      Array.from({length: 200}, (_, i) =>
        expense(`f${i}`, {title: `Filler ${i}`, groupId: 'lisbonne', payers: {samir: 10000n}, shares: {samir: 10000n}, split: {mode: 'equal', participants: ['samir']}, category: 'tr2', date: '2026-02-01'}),
      ),
    )
    // One more, naming only the deleted person and group and a category id the list does not have.
    await put(store, [expense('x', {title: 'Filler x', groupId: 'lis2', payers: {sam2: 10000n}, shares: {sam2: 10000n}, split: {mode: 'equal', participants: ['sam2']}, category: 'transport', date: '2026-02-02'})])
    const cats = [{id: 'tr2', name: 'Transportation'}]
    const f = (q: string) => searchStore(store, q, {today, categories: cats}).then(r => r.expenses.map(e => e.id))
    for (const q of ['filler sam', 'filler lisbon', 'filler transport']) {
      const found = await f(q)
      expect(found).toHaveLength(200)
      expect(found).not.toContain('x')
    }
    expect(await f('filler x')).toEqual(['x'])
    await store.close()
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
  /*
   * What the drawer waits for: people, groups, the counts and per-currency totals of every match, and the first page
   * of payments and of expenses. A wall-clock budget for a dev machine at load under 10 (docs/ARCHITECTURE 17.1): shared
   * CI runners are several times slower and noisy (170 ms on GitHub's). The median of three runs of each query is
   * judged, after one warm-up; CPU time is printed beside it (on a loaded machine the wall time is the scheduler's).
   */
  const words = ['dinner', 'lunch', 'cab', 'rent', 'groceries', 'movie', 'coffee', 'hotel', 'flight', 'snacks']
  const queries = [
    'd',
    'di',
    'din',
    'dinner',
    'dinner goa',
    'zanzibar',
    '450',
    '98',
    'as',
    '> 1000',
    '>= 1000 EUR',
    '< 50 riya',
    'between 100 and 5000',
    'around 1k',
    'march',
    'last month',
    'yesterday',
    'friends work',
    'f',
    'zzz',
    'dinner 4',
    'paid by riya',
    'with riya over 100',
    'food or travel in goa over 500',
    'food or travel or rent',
    'dinner or lunch or cab',
    'payments',
    'deleted',
    'settled',
    'owed',
    'dinner owed',
    'zanzibar owed',
    'hidden',
  ]
  async function seed(store: Store, size: number) {
    resetClock()
    await put(store, [
      entity<Person>('person', 'me', {name: 'Asha Rao', isMe: true}),
      entity<Person>('person', 'riya', {name: 'Riya Sharma', isMe: false, contact: {kind: 'phone', value: '+919876543210'}}),
      entity<Person>('person', 'sam', {name: 'Sam Carter', isMe: false, upiId: 'sam@okaxis'}),
      ...groups,
    ])
    for (let from = 0; from < size; from += 500)
      await put(
        store,
        Array.from({length: 500}, (_, k) => {
          const i = from + k
          const total = BigInt(1000 + ((i * 7919) % 500000))
          const payer = i % 4 ? 'me' : 'riya'
          const other = i % 2 ? 'riya' : 'sam'
          const e = expense(`e${i}`, {
            title: i === 777 ? 'Zanzibar ferry' : `${words[i % words.length]} ${i}`,
            notes: i % 7 ? '' : 'with friends after work',
            groupId: i % 3 ? 'goa' : null,
            currency: i % 5 ? 'INR' : 'EUR',
            total,
            date: `2026-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`,
            payers: {[payer]: total},
            split: {mode: 'equal', participants: [payer, other]},
            shares: {[payer]: total / 2n, [other]: total - total / 2n},
          })
          e.deleted = i % 50 === 0
          return e
        }),
      )
    await put(
      store,
      Array.from({length: 600}, (_, i) =>
        entity<Repayment>(i % 6 ? 'repayment' : 'writeoff', `p${i}`, {groupId: i % 3 ? 'goa' : null, currency: 'INR', from: i % 2 ? 'riya' : 'sam', to: 'me', amount: BigInt(500 + i), date: `2026-${String((i % 12) + 1).padStart(2, '0')}-10`, tz: 'Asia/Kolkata', note: i % 4 ? '' : 'settle up'}),
      ),
    )
  }

  const SPEED: Array<[string, number, () => Promise<Store>]> = [
    ['SQLite', 5000, () => openSqlStore(bunExecutor(':memory:'))],
    ['SQLite', 10000, () => openSqlStore(bunExecutor(':memory:'))],
    ['IndexedDB', 10000, () => openIdbStore('speed', new IDBFactory())],
  ]
  describe.skipIf(!!process.env.CI).each(SPEED)('%s, %d expenses and 600 payments: every query under 50 ms', (engine, size, open) => {
    test('openSearch with the counts, totals and first pages', async () => {
      const store = await open()
      await seed(store, size)
      const opts = {today, categories, me: 'me', hiddenGroups: ['lis'], hiddenItems: ['e7', 'p3']}
      await openSearch(store, 'warm up', opts)
      const timings: Array<[string, number, number]> = []
      for (const q of queries) {
        const runs: Array<[wall: number, cpu: number]> = []
        for (let k = 0; k < 3; k++) {
          const c0 = process.cpuUsage()
          const t0 = performance.now()
          await openSearch(store, q, opts)
          const c = process.cpuUsage(c0)
          runs.push([performance.now() - t0, (c.user + c.system) / 1000])
        }
        timings.push([q, runs.map(r => r[0]).sort((x, y) => x - y)[1]!, runs.map(r => r[1]).sort((x, y) => x - y)[1]!])
      }
      const [slowest, worst, cpu] = timings.reduce((a, b) => (b[1] > a[1] ? b : a))
      console.log(`search ${engine}: worst query ${worst.toFixed(1)} ms wall, ${cpu.toFixed(1)} ms cpu ("${slowest}") over ${queries.length} queries on ${size} expenses (median of 3, load ${os.loadavg()[0]!.toFixed(1)})`)
      expect(worst).toBeLessThan(50)
      // The keys give the same answer as the rows: "> 1000" is every INR/EUR expense above 10.00.
      const all = await store.page<Expense>('expense', {index: 'byDate', limit: size + 1})
      expect((await openSearch(store, '> 1000', opts)).summary.count).toBe(all.items.filter(e => e.data.total > 100000n).length)
      await store.close()
    }, 300_000)
  })

  test.skipIf(!!process.env.CI)('IndexedDB, 10,000 expenses: a stale index is rebuilt in chunks that let the app run between them', async () => {
    const factory = new IDBFactory()
    const first = await openIdbStore('rebuild', factory)
    await seed(first, 10000)
    await first.close()
    // An older index version: the next open rebuilds.
    await new Promise<void>((resolve, reject) => {
      const req = factory.open('rebuild')
      req.onerror = () => reject(req.error)
      req.onsuccess = () => {
        const tx = req.result.transaction('meta', 'readwrite')
        tx.objectStore('meta').put({key: 'searchIndex', value: '1'})
        tx.oncomplete = () => {
          req.result.close()
          resolve()
        }
      }
    })
    const store = await openIdbStore('rebuild', factory)
    let ticks = 0
    const ticker = setInterval(() => ticks++, 0)
    const t0 = performance.now()
    const c0 = process.cpuUsage()
    await store.prepareSearch()
    const c = process.cpuUsage(c0)
    clearInterval(ticker)
    console.log(`search index rebuild IndexedDB: 10,600 records in ${(performance.now() - t0).toFixed(0)} ms wall, ${((c.user + c.system) / 1000).toFixed(0)} ms cpu, ${ticks} timer turns between chunks (load ${os.loadavg()[0]!.toFixed(1)})`)
    // About 22 chunks of 500 rows (plus people, groups, comments): the timer ran between them.
    expect(ticks).toBeGreaterThan(10)
    expect((await openSearch(store, 'zanzibar', {today, categories})).found().map(e => e.id)).toEqual(['e777'])
    expect((await openSearch(store, 'payments', {today, categories})).paymentCount).toBe(500)
    await store.close()
  }, 300_000)
})

describe('F-111 M14: amounts in the user number format', () => {
  let found: (q: string, mark?: '.' | ',') => Promise<string[]>
  beforeAll(async () => {
    const store = await openSqlStore(bunExecutor(':memory:'))
    resetClock()
    await put(store, [
      ...people,
      expense('rent', {title: 'Rent', total: 10000000n}),
      expense('k', {title: 'Hotel', currency: 'EUR', total: 100000n, payers: {me: 100000n}}),
      expense('one', {title: 'Coffee', currency: 'EUR', total: 100n, payers: {me: 100n}}),
      expense('odd', {title: 'Flights', currency: 'EUR', total: 123456n, payers: {me: 123456n}}),
    ])
    const f = searchWith(store)
    found = async (q, mark = '.') => (await f(q, mark)).expenses.map(e => e.id).sort()
  })

  test('Indian grouping finds the ₹1,00,000 rent', async () => expect(await found('1,00,000')).toEqual(['rent']))
  test('de-DE "1.000" is a thousand, not one', async () => expect(await found('1.000', ',')).toEqual(['k']))
  test('de-DE "1.234,56" is one amount', async () => expect(await found('1.234,56', ',')).toEqual(['odd']))
  test('en "1.000" could be either, so both match', async () => expect(await found('1.000')).toEqual(['k', 'one']))
  test('comparisons read the format too', async () => expect(await found('>1.000,00', ',')).toEqual(['odd', 'rent']))
})
