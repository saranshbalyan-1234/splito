import 'fake-indexeddb/auto'
import {IDBFactory} from 'fake-indexeddb'

import {describe, expect, test} from 'bun:test'

import {parseAmount, periodRange} from '@splito/domain'

import {type Comment} from '../src/comments'
import {openIdbStore} from '../src/idbStore'
import {type Expense, type Group, isGroupInactive, type Person, type Repayment} from '../src/mutations'
import {type SearchOptions, searchStore} from '../src/search'
import {dateTerm, recordPeople, type RecordType, termKey, termRows, wordsOf} from '../src/searchTerms'
import {openSqlStore} from '../src/sqlStore'
import {type Store} from '../src/store'
import {type Entity} from '../src/types'
import {bunExecutor} from './bunExecutor'
import {storedTerms} from './projectionCheck'
import {entity, expense, put, resetClock} from './searchFixture'

/*
 * The term keys are the whole search, so they must give exactly the answer the rows give, whatever happened to the
 * ledger. Each run builds a seeded ledger (expenses, payments, write-offs, comments, many same-day records and equal
 * creation times), then applies random edits, deletes, restores, renames, comment edits and deletes. Then (1) the stored
 * `search_terms` must equal the union of `termRows` over every entity, and (2) every kind of query (words, people,
 * groups, comments, amounts, dates, payers, currencies, types, statuses and hidden, narrow and broad) must give the
 * expenses, payments and totals that a row-by-row reference gives, in the same order.
 */
const today = '2026-10-26'
const categories = [
  {id: 'food', name: 'Food'},
  {id: 'transport', name: 'Transport'},
]
const titles = ['dinner', 'lunch', 'cab ride', 'rent', 'groceries', 'movie night', 'coffee', 'hotel', 'flight', 'snacks']
const notes = ['', '', '', 'with friends after work', 'receipt lost']
const bodies = ['please send the receipt', 'thanks', 'paid in cash', 'dinner was great']
const PEOPLE = ['me', 'riya', 'sam', 'ravi']
const GROUPS = ['goa', 'lis', 'flat']
/* Few dates, so many records share a day. */
const DATES = Array.from({length: 24}, (_, i) => `2026-${String(1 + (i % 12)).padStart(2, '0')}-${String(1 + ((i * 7) % 28)).padStart(2, '0')}`).concat(['2026-10-26', '2026-10-25', '2026-10-20'])

type Rec = Entity<Expense | Repayment>

function prng(seed: number) {
  let s = seed
  return (n: number) => {
    s = (s * 1103515245 + 12345) % 2147483648
    return (s >> 8) % n
  }
}

function makeExpense(rand: (n: number) => number, id: string): Entity<Expense> {
  const payer = PEOPLE[rand(PEOPLE.length)]!
  const among = PEOPLE.filter(() => rand(2) === 0)
  if (!among.length) among.push('me')
  const total = BigInt((1 + rand(900)) * 200)
  const each = total / BigInt(among.length)
  return expense(id, {
    title: `${titles[rand(titles.length)]} ${rand(50)}`,
    notes: notes[rand(notes.length)]!,
    groupId: [...GROUPS, null][rand(4)] ?? null,
    currency: ['INR', 'EUR', 'JPY'][rand(3)]!,
    total,
    payers: {[payer]: total},
    split: {mode: 'equal', participants: among},
    shares: Object.fromEntries(among.map(p => [p, each])),
    date: DATES[rand(DATES.length)]!,
    category: ['food', 'transport', 'misc'][rand(3)]!,
  })
}

function makePayment(rand: (n: number) => number, id: string, type: 'repayment' | 'writeoff'): Entity<Repayment> {
  const other = PEOPLE[1 + rand(3)]!
  const isToMe = rand(3) > 0
  return entity<Repayment>(type, id, {
    groupId: [...GROUPS, null][rand(4)] ?? null,
    currency: ['INR', 'EUR'][rand(2)]!,
    from: isToMe ? other : 'me',
    to: isToMe ? 'me' : other,
    amount: BigInt((1 + rand(400)) * 100),
    date: DATES[rand(DATES.length)]!,
    tz: 'Asia/Kolkata',
    note: rand(3) === 0 ? 'settle up dinner' : '',
  })
}

async function build(store: Store, seed: number) {
  resetClock()
  const rand = prng(seed)
  const people = [
    entity<Person>('person', 'me', {name: 'Asha Rao', isMe: true}),
    entity<Person>('person', 'riya', {name: 'Riya Sharma', isMe: false, contact: {kind: 'phone', value: '+919876543210'}}),
    entity<Person>('person', 'sam', {name: 'Sam Carter', isMe: false, upiId: 'sam@okaxis'}),
    entity<Person>('person', 'ravi', {name: 'Ravi Kumar', isMe: false}),
  ]
  const groups = [
    entity<Group>('group', 'goa', {name: 'Goa trip', location: 'Candolim', kind: 'trip', currency: 'INR', members: [], startDate: null, endDate: null, archived: false}),
    entity<Group>('group', 'lis', {name: 'Lisbon', kind: 'trip', currency: 'EUR', members: [], startDate: null, endDate: null, archived: false, inactive: true}),
    entity<Group>('group', 'flat', {name: 'Flat', kind: 'home', currency: 'INR', members: [], startDate: null, endDate: null, archived: false}),
  ]
  const records: Rec[] = [
    ...Array.from({length: 700}, (_, i) => makeExpense(rand, `x${i}`)),
    ...Array.from({length: 120}, (_, i) => makePayment(rand, `p${i}`, 'repayment')),
    ...Array.from({length: 40}, (_, i) => makePayment(rand, `w${i}`, 'writeoff')),
  ]
  // Equal creation times: the id decides between them.
  for (let i = 0; i + 1 < records.length; i += 37) records[i + 1]!.createdAt = records[i]!.createdAt
  const comments = Array.from({length: 60}, (_, i) => {
    const target = records[rand(records.length)]!
    return entity<Comment>('comment', `c${i}`, {targetType: target.type as 'expense', targetId: target.id, authorId: 'me', body: bodies[rand(bodies.length)]!, mentions: [], editedAt: null})
  })
  await put(store, [...people, ...groups])
  for (let i = 0; i < records.length; i += 200) await put(store, records.slice(i, i + 200))
  await put(store, comments)
  // A square group and records of mine alone: "settled" has something to find whatever the random balances are.
  await put(store, [
    entity<Group>('group', 'club', {name: 'Supper club', kind: 'other', currency: 'INR', members: [], startDate: null, endDate: null, archived: false}),
    expense('club1', {title: 'dinner club', groupId: 'club', total: 1000n, payers: {me: 1000n}, split: {mode: 'equal', participants: ['me', 'riya']}, shares: {me: 500n, riya: 500n}, date: DATES[3]!}),
    entity<Repayment>('repayment', 'club2', {groupId: 'club', currency: 'INR', from: 'riya', to: 'me', amount: 500n, date: DATES[3]!, tz: 'Asia/Kolkata', note: 'dinner club'}),
    expense('solo1', {title: 'dinner solo', total: 700n, payers: {me: 700n}, split: {mode: 'equal', participants: ['me']}, shares: {me: 700n}, date: DATES[3]!}),
  ])

  // Random changes, each its own transaction, as the app makes them.
  const edit = async <T,>(type: Entity['type'], id: string, change: (e: Entity<T>) => Entity<T>) => {
    const e = (await store.get<T>(type, id))!
    await store.transaction(tx => tx.put(change({...e, version: e.version + 1, updatedAt: e.updatedAt + 1000})))
  }
  for (let k = 0; k < 160; k++) {
    const r = records[rand(records.length)]!
    switch (rand(8)) {
      case 0:
        await edit<Expense & Repayment>(r.type, r.id, e => ({...e, deleted: true}))
        break
      case 1:
        await edit<Expense & Repayment>(r.type, r.id, e => ({...e, deleted: false}))
        break
      case 2:
        await edit<Expense & Repayment>(r.type, r.id, e => ({...e, data: {...e.data, date: DATES[rand(DATES.length)]!}}))
        break
      case 3:
        await edit<Expense & Repayment>(r.type, r.id, e => (e.type === 'expense' ? {...e, data: {...e.data, title: `${titles[rand(titles.length)]} edited`}} : {...e, data: {...e.data, note: 'dinner refund'}}))
        break
      case 4:
        await edit<Expense & Repayment>(r.type, r.id, e => ({...e, data: {...e.data, groupId: [...GROUPS, null][rand(4)] ?? null}}))
        break
      case 5: {
        const c = comments[rand(comments.length)]!
        await edit<Comment>('comment', c.id, e => (rand(3) === 0 ? {...e, deleted: true, data: {...e.data, body: ''}} : {...e, deleted: false, data: {...e.data, body: bodies[rand(bodies.length)]!}}))
        break
      }
      case 6:
        await edit<Person>('person', ['riya', 'sam', 'ravi'][rand(3)]!, e => ({...e, data: {...e.data, name: rand(2) ? `${e.data.name.split(' ')[0]} Renamed` : e.data.name.replace(' Renamed', ' Sharma')}}))
        break
      default:
        await edit<Group>('group', GROUPS[rand(3)]!, e => (rand(4) === 0 ? {...e, deleted: !e.deleted} : {...e, data: {...e.data, location: rand(2) ? 'Baga' : 'Candolim'}}))
    }
  }
  // One rename always lands last, so its new name is a word to find.
  await edit<Person>('person', 'ravi', e => ({...e, data: {...e.data, name: 'Ravi Renamed'}}))
  return {hiddenItems: records.filter((_, i) => i % 41 === 0).map(r => r.id)}
}

/** The answer of the rows, one record at a time. */
async function reference(store: Store, opts: SearchOptions) {
  const [people, groups, comments, ...records] = await Promise.all([
    store.getAll<Person>('person'),
    store.getAll<Group>('group'),
    store.getAll<Comment>('comment'),
    store.getAll<Expense>('expense'),
    store.getAll<Repayment>('repayment'),
    store.getAll<Repayment>('writeoff'),
  ])
  const all = records.flat() as Rec[]
  const liveGroup = new Map(groups.filter(g => !g.deleted).map(g => [g.id, g]))
  const otherName = new Map(people.filter(p => !p.deleted && !p.data.isMe).map(p => [p.id, p.data.name]))
  const catName = new Map(categories.map(c => [c.id, c.name]))
  const commentWords = new Map<string, string[]>()
  for (const c of comments) if (!c.deleted && c.data.body) commentWords.set(c.data.targetId, [...(commentWords.get(c.data.targetId) ?? []), ...wordsOf(c.data.body)])
  const peopleOn = (r: Rec) => recordPeople(r.type as RecordType, r.data as Expense & Repayment)
  const wordsOfRow = (r: Rec) => {
    const d = r.data as Expense & Repayment
    const g = d.groupId ? liveGroup.get(d.groupId) : undefined
    const text = [r.type === 'expense' ? d.title : d.note, d.notes ?? '', r.type === 'expense' ? (catName.get(d.category) ?? '') : '', g ? `${g.data.name} ${g.data.location ?? ''}` : '']
    for (const id of peopleOn(r)) text.push(otherName.get(id) ?? '')
    return [...wordsOf(text.join(' ')), ...(commentWords.get(r.id) ?? [])]
  }
  const has = (r: Rec, p: string) => wordsOfRow(r).some(w => w.startsWith(p))
  const amount = (r: Rec) => (r.type === 'expense' ? (r.data as Expense).total : (r.data as Repayment).amount)
  const typed = (r: Rec, n: number) => parseAmount(String(n), r.data.currency)

  /* Statuses, from the balance projections (their own property test checks them against the rows). */
  const nets = await store.balances()
  const pairs = await store.pairBalances('me')
  const netsOf = (g: string) => nets.filter(n => n.groupId === g)
  const groupIs = (g: string, s: 'settled' | 'owed' | 'owe') => liveGroup.has(g) && (s === 'settled' ? netsOf(g).every(n => n.amount === 0n) : netsOf(g).some(n => n.personId === 'me' && (s === 'owed' ? n.amount > 0n : n.amount < 0n)))
  const balanced = pairs.filter(p => p.amount !== 0n)
  const status = (r: Rec, s: 'settled' | 'owed' | 'owe' | 'hidden' | 'inactive' | 'deleted') => {
    const g = r.data.groupId
    if (s === 'deleted') return r.deleted
    if (s === 'hidden') return (!!g && opts.hiddenGroups!.includes(g)) || opts.hiddenItems!.includes(r.id)
    if (s === 'inactive') return !!g && !!liveGroup.get(g) && isGroupInactive(liveGroup.get(g)!.data)
    if (g) return groupIs(g, s)
    const on = peopleOn(r)
    if (s === 'settled') return !on.some(p => balanced.some(b => b.otherId === p))
    return on.some(p => balanced.some(b => b.otherId === p && (s === 'owed' ? b.amount > 0n : b.amount < 0n)))
  }
  const week = periodRange('week', today, opts.weekStart ?? 1, -1)
  const month = (r: Rec) => r.data.date.slice(5, 7)

  const cases: Array<[string, (r: Rec) => boolean]> = [
    ['dinner', r => has(r, 'dinner')],
    ['d', r => has(r, 'd')],
    ['goa', r => has(r, 'goa')],
    ['baga', r => has(r, 'baga')],
    ['riya', r => has(r, 'riya')],
    ['renamed', r => has(r, 'renamed')],
    ['receipt', r => has(r, 'receipt')],
    ['transport', r => r.type === 'expense' && (r.data as Expense).category === 'transport'],
    ['dinner goa', r => has(r, 'dinner') && has(r, 'goa')],
    ['> 500', r => amount(r) > typed(r, 500)],
    ['between 100 and 300', r => amount(r) >= typed(r, 100) && amount(r) <= typed(r, 300)],
    ['paid by sam', r => (r.type === 'expense' ? Object.entries((r.data as Expense).payers).some(([k, v]) => k === 'sam' && v !== 0n) : (r.data as Repayment).from === 'sam')],
    ['with ravi', r => peopleOn(r).includes('ravi')],
    ['march', r => month(r) === '03' || has(r, 'march')],
    ['last week', r => r.data.date >= week.from && r.data.date <= week.to],
    ['EUR', r => r.data.currency === 'EUR'],
    ['march or june', r => ['03', '06'].includes(month(r)) || has(r, 'march') || has(r, 'june')],
    ['food or transport', r => r.type === 'expense' && ['food', 'transport'].includes((r.data as Expense).category)],
    ['deleted', r => status(r, 'deleted')],
    ['hidden', r => status(r, 'hidden')],
    ['inactive', r => status(r, 'inactive')],
    ['settled', r => status(r, 'settled')],
    ['owed', r => status(r, 'owed')],
    ['owe', r => status(r, 'owe')],
    ['coffee owed', r => has(r, 'coffee') && status(r, 'owed')],
    ['dinner settled', r => has(r, 'dinner') && status(r, 'settled')],
    ['riya hidden', r => has(r, 'riya') && status(r, 'hidden')],
    ['payments', r => r.type === 'repayment'],
    ['write-off sam', r => r.type === 'writeoff' && has(r, 'sam')],
    ['paid by riya march over 300', r => (r.type === 'expense' ? Object.entries((r.data as Expense).payers).some(([k, v]) => k === 'riya' && v !== 0n) : (r.data as Repayment).from === 'riya') && month(r) === '03' && amount(r) > typed(r, 300)],
  ]
  const newestFirst = (rows: Rec[]) => rows.map(r => ({r, key: `${dateTerm(r.data.date, r.createdAt)}\u0000${r.id}`})).sort((a, b) => (a.key < b.key ? 1 : -1)).map(x => x.r.id)
  return cases.map(([q, keep]) => {
    const found = all.filter(keep)
    const expenses = found.filter(r => r.type === 'expense')
    const totals: Record<string, bigint> = {}
    for (const e of expenses) if (!e.deleted) totals[e.data.currency] = (totals[e.data.currency] ?? 0n) + amount(e)
    return {q, expenses: newestFirst(expenses), payments: newestFirst(found.filter(r => r.type !== 'expense')), totals}
  })
}

async function allEntities(store: Store) {
  return (await Promise.all((['person', 'group', 'expense', 'repayment', 'writeoff', 'comment'] as const).map(t => store.getAll(t)))).flat()
}

const ENGINES: Array<[string, (seed: number) => Promise<Store>]> = [
  ['SQLite', () => openSqlStore(bunExecutor(':memory:'))],
  ['IndexedDB', seed => openIdbStore(`search-oracle-${seed}`, new IDBFactory())],
]

describe.each(ENGINES)('the keys give the answer the rows give, after random changes (%s)', (_engine, open) => {
  test.each([7, 1234, 99991])('seed %d', async seed => {
    const store = await open(seed)
    const {hiddenItems} = await build(store, seed)
    // (1) The stored terms are exactly what the entities say.
    const want = (await allEntities(store)).flatMap(termRows).map(r => JSON.stringify(termKey(r)))
    expect(await storedTerms(store)).toEqual([...new Set(want)].sort())
    // (2) Every query answers as the rows do.
    const opts: SearchOptions = {today, categories, me: 'me', hiddenGroups: ['lis'], hiddenItems, weekStart: 0}
    let isNarrowSeen = false
    let isBroadSeen = false
    const empty: string[] = []
    for (const {q, expenses, payments, totals} of await reference(store, opts)) {
      if (expenses.length + payments.length === 0) empty.push(q)
      const got = await searchStore(store, q, opts)
      expect({q, expenses: got.expenses.map(e => e.id), payments: got.payments.map(p => p.id), totals: got.totals}).toEqual({q, expenses, payments, totals})
      isNarrowSeen ||= expenses.length + payments.length > 0 && expenses.length + payments.length <= 500
      isBroadSeen ||= expenses.length + payments.length > 500
    }
    // Both ways of answering were exercised, and the queries find something (an empty answer proves little).
    expect([isNarrowSeen, isBroadSeen]).toEqual([true, true])
    expect(empty).toEqual([])
    await store.close()
  }, 120_000)
})
