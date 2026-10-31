import 'fake-indexeddb/auto'
import {IDBFactory} from 'fake-indexeddb'

import {beforeAll, describe, expect, test} from 'bun:test'

import {type Comment} from '../src/comments'
import {type Dispute} from '../src/disputes'
import {openIdbStore} from '../src/idbStore'
import {type Expense, type Group, type Person, type Repayment} from '../src/mutations'
import {openSearch, searchStore} from '../src/search'
import {parseQuery, removeChip} from '../src/searchQuery'
import {openSqlStore} from '../src/sqlStore'
import {type Store} from '../src/store'
import {bunExecutor} from './bunExecutor'
import {entity, expense as baseExpense, put, resetClock} from './searchFixture'

/*
 * One ledger that has every field F-246 lists, searched on both engines: title, notes, item names, people (names and
 * contacts), group names, trip location, category, amounts and ranges, dates and periods, currency, payer, status
 * (settled, owed, disputed, deleted, hidden, inactive), types and comments. Today is Monday 2026-10-26.
 */
const today = '2026-10-26'
const categories = [
  {id: 'food', name: 'Food'},
  {id: 'transport', name: 'Transport'},
  {id: 'home', name: 'Home'},
]
/** An expense whose payers and shares add up to its total: `payer` paid it, `among` share it equally. */
function expense(id: string, over: Partial<Expense> & {payer?: string; among?: string[]}) {
  const {payer = 'me', among = ['me', 'riya'], ...rest} = over
  const total = rest.total ?? 10000n
  const each = total / BigInt(among.length)
  return baseExpense(id, {payers: {[payer]: total}, split: {mode: 'equal', participants: among}, shares: Object.fromEntries(among.map(p => [p, each])), ...rest})
}
const group = (id: string, name: string, over: Partial<Group> = {}, deleted = false) =>
  entity<Group>('group', id, {name, kind: 'trip', currency: 'INR', members: [], startDate: null, endDate: null, archived: false, ...over}, deleted)
const repayment = (id: string, over: Partial<Repayment>) =>
  entity<Repayment>('repayment', id, {groupId: null, currency: 'INR', from: 'sam', to: 'me', amount: 1000n, date: '2026-10-20', tz: 'Asia/Kolkata', note: '', ...over})

const rows = () => [
  entity<Person>('person', 'me', {name: 'Asha Rao', isMe: true}),
  entity<Person>('person', 'riya', {name: 'Riya Sharma', isMe: false, contact: {kind: 'email', value: 'riya.sharma@example.com'}, upiId: 'riya@okhdfc'}),
  entity<Person>('person', 'sam', {name: 'Sam Carter', isMe: false, contact: {kind: 'phone', value: '+919876543210'}}),
  entity<Person>('person', 'oldpal', {name: 'Old Pal', isMe: false}, true),
  group('goa', 'Goa trip', {location: 'Candolim beach'}),
  group('lis', 'Lisbon', {currency: 'EUR', inactive: true}),
  group('flat', 'Flat', {kind: 'home'}),
  group('secret', 'Secret club', {kind: 'other', currency: 'USD'}),
  group('lost', 'Lost trip', {}, true),
  expense('dinner', {title: 'Dinner at Thalassa', groupId: 'goa', total: 1250000n, date: '2025-12-22', notes: 'Anniversary'}),
  expense('cab', {title: 'Cab to airport', groupId: 'goa', total: 80000n, date: '2026-03-08', category: 'transport', payer: 'riya'}),
  expense('pasteis', {
    title: 'Pastéis de Belém',
    groupId: 'lis',
    currency: 'EUR',
    total: 2400n,
    date: '2026-04-11',
    among: ['me', 'sam'],
    split: {mode: 'items', items: [{id: 'i1', name: 'Custard tarts', amount: 2400n, participants: ['me', 'sam']}], tax: 0n, tip: 0n, discount: 0n},
  }),
  expense('rent', {title: 'Rent', groupId: 'flat', total: 2500000n, date: '2026-10-01', category: 'home', payer: 'riya'}),
  expense('coffee', {title: 'Coffee', total: 45000n, date: '2026-10-25', notes: 'with friends after work'}),
  expense('tea', {title: 'Tea', total: 10000n, date: '2026-10-20', among: ['me', 'sam']}),
  expense('old', {title: 'Old bill', groupId: 'goa', total: 100000n, date: '2026-02-02'}),
  expense('gift', {title: 'Gift', groupId: 'secret', currency: 'USD', total: 5000n, date: '2026-09-09', among: ['me']}),
  expense('lunch', {title: 'Lunch', total: 150000n, date: '2026-10-26', among: ['me']}),
  expense('chai', {title: 'चाय पार्टी', total: 30000n, date: '2026-10-19', among: ['me']}),
  expense('groupdinner', {title: 'Group dinner', total: 70000n, date: '2026-08-15', among: ['me']}),
  repayment('settle', {groupId: 'goa', from: 'riya', to: 'me', amount: 585000n, date: '2026-03-10', note: 'Settled Goa dinner'}),
  repayment('teamoney', {from: 'sam', to: 'me', amount: 5000n, date: '2026-10-21', note: 'Tea money'}),
  entity<Repayment>('writeoff', 'even', {groupId: 'lis', currency: 'EUR', from: 'sam', to: 'me', amount: 1200n, date: '2026-04-12', tz: 'Asia/Kolkata', note: 'Called it even'}),
  entity<Comment>('comment', 'c1', {targetType: 'expense', targetId: 'cab', authorId: 'me', body: 'Please send the receipt', mentions: [], editedAt: null}),
  entity<Comment>('comment', 'c2', {targetType: 'repayment', targetId: 'settle', authorId: 'me', body: 'Thanks for sorting', mentions: [], editedAt: null}),
  entity<Dispute>('dispute', 'd1', {
    targetType: 'expense',
    targetId: 'rent',
    itemId: null,
    groupId: 'flat',
    raisedBy: 'me',
    recordedBy: 'me',
    kind: 'dispute',
    reason: 'wrong_amount',
    note: '',
    proposedFix: null,
    status: 'open',
    resolvedBy: null,
    resolution: '',
    resolvedAt: null,
    reopenCount: 0,
  } as unknown as Dispute),
]
// The deleted expense and the hidden things.
const deletedOld = (all: ReturnType<typeof rows>) => all.map(r => (r.id === 'old' ? {...r, deleted: true} : r))

const ENGINES: Array<[string, () => Promise<Store>]> = [
  ['SQLite', () => openSqlStore(bunExecutor(':memory:'))],
  ['IndexedDB', () => openIdbStore('search-fields', new IDBFactory())],
]

const opts = {today, categories, me: 'me', hiddenGroups: ['secret'], hiddenItems: ['old']}

describe.each(ENGINES)('search by every field (%s)', (_engine, open) => {
  let store: Store
  const ids = async (q: string) => (await searchStore(store, q, opts)).expenses.map(e => e.id)
  const payments = async (q: string) => (await searchStore(store, q, opts)).payments.map(e => e.id)
  beforeAll(async () => {
    resetClock()
    store = await open()
    await put(store, deletedOld(rows()))
  })

  test('title, notes and item names', async () => {
    expect(await ids('thalassa')).toEqual(['dinner'])
    expect(await ids('anniversary')).toEqual(['dinner'])
    expect(await ids('custard')).toEqual(['pasteis'])
    expect(await ids('PASTEIS')).toEqual(['pasteis'])
  })

  test('people: a name finds the person and their records; a contact or UPI id finds the person only', async () => {
    const riya = await searchStore(store, 'riya', opts)
    expect(riya.people.map(p => p.id)).toEqual(['riya'])
    expect(riya.expenses.map(e => e.id)).toEqual(['coffee', 'rent', 'cab', 'old', 'dinner'])
    const person = async (q: string) => {
      const found = await searchStore(store, q, opts)
      return {people: found.people.map(p => p.id), records: [...found.expenses, ...found.payments].map(e => e.id)}
    }
    expect(await person('example')).toEqual({people: ['riya'], records: []})
    expect(await person('okhdfc')).toEqual({people: ['riya'], records: []})
    expect(await person('riya.sharma')).toEqual({people: ['riya'], records: ['coffee', 'rent', 'cab', 'old', 'dinner', 'settle']})
    // A phone number is found with or without its country code, and its digits never expand to the ledger (review C1).
    expect(await person('98765')).toEqual({people: ['sam'], records: []})
    expect(await person('919876')).toEqual({people: ['sam'], records: []})
    expect(await person('9876543210')).toEqual({people: ['sam'], records: []})
    expect(await person('+919876543210')).toEqual({people: ['sam'], records: []})
    expect(await person('91')).toEqual({people: ['sam'], records: []})
    expect(await person('98')).toEqual({people: ['sam'], records: []})
    // My own name lists nothing: every record is mine.
    expect(await person('as')).toEqual({people: [], records: []})
    // A deleted person is not a word of their records, and "me" is not a result of its own.
    expect((await searchStore(store, 'old pal', opts)).people.map(p => [p.id, p.deleted])).toEqual([['oldpal', true]])
    expect((await searchStore(store, 'asha', opts)).people).toEqual([])
  })

  test('group names and a trip location find the group and its expenses', async () => {
    const goa = await searchStore(store, 'goa', opts)
    expect(goa.groups.map(g => g.id)).toEqual(['goa'])
    expect(goa.expenses.map(e => e.id)).toEqual(['cab', 'old', 'dinner'])
    expect((await searchStore(store, 'candolim', opts)).groups.map(g => g.id)).toEqual(['goa'])
    expect(await ids('beach')).toEqual(['cab', 'old', 'dinner'])
  })

  test('category names', async () => {
    expect(await ids('transport')).toEqual(['cab'])
    expect(await ids('home')).toEqual(['rent'])
  })

  test('amounts: exact, comparisons, words, ranges, around and shorthand', async () => {
    expect(await ids('800')).toEqual(['cab'])
    expect(await ids('over 20000')).toEqual(['rent'])
    expect(await ids('> 20k')).toEqual(['rent'])
    expect(await ids('more than 12,500')).toEqual(['rent'])
    expect(await ids('at least 12500')).toEqual(['rent', 'dinner'])
    expect(await ids('under 100')).toEqual(['gift', 'pasteis'])
    expect(await ids('between 700 and 900')).toEqual(['groupdinner', 'cab'])
    expect(await ids('700-900')).toEqual(['groupdinner', 'cab'])
    expect(await ids('from 700 to 900')).toEqual(['groupdinner', 'cab'])
    expect(await ids('around 800')).toEqual(['cab'])
    expect(await ids('around 1k')).toEqual(['old'])
    expect(await ids('>= 0.2 lakh')).toEqual(['rent'])
    expect(await ids('1.5k lunch')).toEqual(['lunch'])
  })

  test('currency: a code, a symbol and with an amount', async () => {
    expect(await ids('EUR')).toEqual(['pasteis'])
    expect(await ids('usd')).toEqual(['gift'])
    expect(await ids('€24')).toEqual(['pasteis'])
    expect(await ids('24 INR')).toEqual([])
    expect(await ids('EUR between 10 and 50')).toEqual(['pasteis'])
    expect(await ids('> 20 EUR')).toEqual(['pasteis'])
    // The totals never mix them.
    expect((await searchStore(store, 'food', opts)).totals).toEqual({EUR: 2400n, USD: 5000n, INR: 1250000n + 45000n + 10000n + 150000n + 30000n + 70000n})
  })

  test('dates: days, months, years and periods', async () => {
    expect(await ids('today')).toEqual(['lunch'])
    expect(await ids('yesterday')).toEqual(['coffee'])
    expect(await ids('march')).toEqual(['cab'])
    expect(await ids('apr 2026')).toEqual(['pasteis'])
    expect(await ids('2025')).toEqual(['dinner'])
    expect(await ids('last year')).toEqual(['dinner'])
    expect(await ids('this month')).toEqual(['lunch', 'coffee', 'tea', 'chai', 'rent'])
    expect(await ids('last month')).toEqual(['gift'])
    expect(await ids('this week')).toEqual(['lunch'])
    expect(await ids('last week')).toEqual(['coffee', 'tea', 'chai'])
  })

  test('payer and participant: paid by, with, me, alternatives and a close spelling', async () => {
    expect(await ids('paid by riya')).toEqual(['rent', 'cab'])
    expect(await ids('by riya')).toEqual(['rent', 'cab'])
    expect(await ids('paid by rhiya')).toEqual(['rent', 'cab'])
    expect(await ids('with sam')).toEqual(['tea', 'pasteis'])
    expect(await ids('paid by me with sam')).toEqual(['tea', 'pasteis'])
    expect(await ids('paid by riya or sam')).toEqual(['rent', 'cab'])
    expect((await ids('paid by me')).includes('rent')).toBe(false)
    expect((await ids('paid by me')).includes('lunch')).toBe(true)
    // A name nobody has is just words: "with friends" is the note of the coffee.
    expect(await ids('with friends')).toEqual(['coffee'])
    // A close spelling must keep the first letter, and only a name is spelled close (never a contact or UPI id).
    expect(await ids('paid by xiya')).toEqual([])
    expect(await ids('with okhdfd')).toEqual([])
    expect(await ids(`with ${'r'.repeat(30)}`)).toEqual([])
  })

  test('status: deleted, disputed, hidden, inactive, settled, owed and owe', async () => {
    const deleted = await searchStore(store, 'deleted', opts)
    expect(deleted.expenses.map(e => [e.id, e.deleted])).toEqual([['old', true]])
    expect(deleted.people.map(p => p.id)).toEqual(['oldpal'])
    expect(deleted.groups.map(g => g.id)).toEqual(['lost'])
    expect(await ids('status:disputed')).toEqual(['rent'])
    expect(await ids('disputed')).toEqual(['rent'])
    const hidden = await searchStore(store, 'hidden', opts)
    expect(hidden.expenses.map(e => e.id)).toEqual(['gift', 'old'])
    expect(hidden.groups.map(g => g.id)).toEqual(['secret'])
    const inactive = await searchStore(store, 'inactive', opts)
    expect(inactive.expenses.map(e => e.id)).toEqual(['pasteis'])
    expect(inactive.groups.map(g => g.id)).toEqual(['lis'])
    // Goa and Lisbon are square (a payment, a write-off); outside groups, Sam is square and Riya owes me.
    expect((await ids('settled')).sort()).toEqual(['cab', 'chai', 'dinner', 'gift', 'groupdinner', 'lunch', 'old', 'pasteis', 'tea'])
    expect((await searchStore(store, 'settled', opts)).groups.map(g => g.id)).toEqual(['goa', 'lis', 'secret'])
    expect(await ids('owed')).toEqual(['coffee'])
    expect(await ids('owe')).toEqual(['rent'])
    expect((await searchStore(store, 'owe', opts)).groups.map(g => g.id)).toEqual(['flat'])
    expect(await ids('settled goa')).toEqual(['cab', 'old', 'dinner'])
    // A narrow answer checks the status on its rows; the same answer as the keys give.
    expect(await ids('owed coffee')).toEqual(['coffee'])
    expect(await ids('owe coffee')).toEqual([])
    expect(await ids('settled tea')).toEqual(['tea'])
    expect(await ids('hidden gift')).toEqual(['gift'])
    expect(await ids('inactive custard')).toEqual(['pasteis'])
  })

  test('types: expenses, payments, write-offs and comments', async () => {
    expect(await payments('payments')).toEqual(['teamoney', 'settle'])
    expect((await searchStore(store, 'payments', opts)).expenses).toEqual([])
    expect(await payments('write-off')).toEqual(['even'])
    expect(await payments('called')).toEqual(['even'])
    expect(await ids('expenses coffee')).toEqual(['coffee'])
    expect(await payments('expenses coffee')).toEqual([])
    expect(await payments('goa')).toEqual(['settle'])
    expect(await payments('over 5000')).toEqual(['settle'])
    expect(await payments('deleted payments')).toEqual([])
    expect(await ids('comments')).toEqual(['cab'])
    expect(await payments('comments')).toEqual(['settle'])
    // A payment is also found by the people on it.
    expect(await payments('sam')).toEqual(['teamoney', 'even'])
  })

  test('comments: the text of a comment finds its expense or payment and says so', async () => {
    const session = await openSearch(store, 'receipt', opts)
    expect(session.found().map(e => e.id)).toEqual(['cab'])
    expect(session.commentText('cab')).toBe('Please send the receipt')
    const thanks = await openSearch(store, 'thanks', opts)
    expect(thanks.foundPayments().map(p => p.id)).toEqual(['settle'])
    expect(thanks.commentText('settle')).toBe('Thanks for sorting')
  })

  test('a localised category name finds its expenses, and so does the stock one', async () => {
    const hindi = {...opts, categories: [{id: 'food', name: 'खाना'}, {id: 'food', name: 'Food'}, {id: 'transport', name: 'यातायात'}, {id: 'transport', name: 'Transport'}]}
    const found = async (q: string) => (await searchStore(store, q, hindi)).expenses.map(e => e.id)
    expect(await found('यातायात')).toEqual(['cab'])
    expect(await found('transport')).toEqual(['cab'])
    expect((await found('खाना')).length).toBe((await found('food')).length)
  })

  test('joining words, rupees and one day', async () => {
    expect(await ids('spent on rent')).toEqual(['rent'])
    expect(await ids('cab in march')).toEqual(['cab'])
    expect(await ids('in march')).toEqual(['cab'])
    expect(await ids('cab on 8 march')).toEqual(['cab'])
    expect(await ids('cab on 9 march')).toEqual([])
    expect(await ids('rs 800')).toEqual(['cab'])
    expect(await ids('rs800')).toEqual(['cab'])
    expect(await ids('dinner और thalassa')).toEqual(['dinner'])
    expect(await ids('thalassa या custard')).toEqual(['pasteis', 'dinner'])
  })

  test('facets combine: AND across, OR within', async () => {
    expect(await ids('food or transport in goa over 500')).toEqual(['cab', 'old', 'dinner'])
    expect(await ids('goa food')).toEqual(['old', 'dinner'])
    expect(await ids('paid by riya last month')).toEqual([])
    expect(await ids('paid by riya march')).toEqual(['cab'])
    expect(await ids('deleted goa')).toEqual(['old'])
    expect(await ids('march or april')).toEqual(['pasteis', 'cab'])
  })

  test('Hindi: periods, months, comparisons, statuses, payers and Hindi text', async () => {
    expect(await ids('कल')).toEqual(['coffee'])
    expect(await ids('पिछले महीने')).toEqual(['gift'])
    expect(await ids('अप्रैल')).toEqual(['pasteis'])
    expect(await ids('20000 से ज्यादा')).toEqual(['rent'])
    expect(await ids('हटाया')).toEqual(['old'])
    expect(await ids('riya ने')).toEqual(['rent', 'cab'])
    expect(await ids('चाय')).toEqual(['chai'])
    expect(await ids('इस हफ्ते')).toEqual(['lunch'])
  })

  test('a status or type word that finds nothing is searched as text', async () => {
    expect(await ids('group dinner')).toEqual(['groupdinner'])
  })

  test('chips: each facet is removable and re-runs the rest', async () => {
    const q = 'dinner paid by riya last month over 500'
    const {chips, tokens} = parseQuery(q)
    expect(chips.map(c => [c.facet, c.text])).toEqual([
      ['person', 'paid by riya'],
      ['period', 'last month'],
      ['amount', 'over 500'],
    ])
    expect(tokens.map(t => t.kind)).toEqual(['text', 'person', 'period', 'compare'])
    expect(removeChip(q, chips[1]!)).toBe('dinner paid by riya over 500')
    expect(removeChip(q, chips[0]!)).toBe('dinner last month over 500')
    expect((await openSearch(store, q, opts)).chips.map(c => c.facet)).toEqual(['person', 'period', 'amount'])
    const orChip = parseQuery('food or transport').chips
    expect(orChip.map(c => [c.facet, c.text])).toEqual([['any', 'food or transport']])
  })
})

describe.each(ENGINES)('the keys follow every change (%s)', (_engine, open) => {
  test('a payment edit, a comment edit and delete, a payment deleted and restored move the terms with them', async () => {
    resetClock()
    const store = await open()
    await put(store, [entity<Person>('person', 'me', {name: 'Asha', isMe: true}), expense('e', {title: 'Alpha'}), repayment('p', {note: 'Beta', amount: 500n}), entity<Comment>('comment', 'c', {targetType: 'expense', targetId: 'e', authorId: 'me', body: 'Gamma', mentions: [], editedAt: null})])
    const f = (q: string) => searchStore(store, q, {today, categories})
    expect((await f('beta')).payments.map(p => p.id)).toEqual(['p'])
    const p = (await store.get<Repayment>('repayment', 'p'))!
    await store.transaction(tx => tx.put({...p, version: 2, updatedAt: 90, data: {...p.data, note: 'Delta', amount: 700n}}))
    expect((await f('beta')).payments).toEqual([])
    expect((await f('delta')).payments.map(x => x.id)).toEqual(['p'])
    expect((await f('7')).payments.map(x => x.id)).toEqual(['p'])
    expect((await f('gamma')).expenses.map(e => e.id)).toEqual(['e'])
    const c = (await store.get<Comment>('comment', 'c'))!
    await store.transaction(tx => tx.put({...c, version: 2, updatedAt: 91, data: {...c.data, body: 'Omega'}}))
    expect((await f('gamma')).expenses).toEqual([])
    expect((await f('omega')).expenses.map(e => e.id)).toEqual(['e'])
    await store.transaction(tx => tx.put({...c, version: 3, updatedAt: 92, deleted: true, data: {...c.data, body: ''}}))
    expect((await f('omega')).expenses).toEqual([])
    // A deleted payment is listed, struck, and found by "deleted"; restored, it is live again and "deleted" no longer finds it.
    await store.transaction(tx => tx.put({...p, version: 3, updatedAt: 93, deleted: true, data: {...p.data, note: 'Delta', amount: 700n}}))
    expect((await f('deleted')).payments.map(x => [x.id, x.deleted])).toEqual([['p', true]])
    await store.transaction(tx => tx.put({...p, version: 4, updatedAt: 94, deleted: false, data: {...p.data, note: 'Delta', amount: 700n}}))
    expect((await f('deleted')).payments).toEqual([])
    expect((await f('delta')).payments.map(x => [x.id, x.deleted])).toEqual([['p', false]])
    await store.close()
  })

  test('a comment on a write-off finds the write-off', async () => {
    resetClock()
    const store = await open()
    await put(store, [
      entity<Person>('person', 'me', {name: 'Asha', isMe: true}),
      entity<Repayment>('writeoff', 'w', {groupId: null, currency: 'INR', from: 'sam', to: 'me', amount: 100n, date: '2026-10-01', tz: 'Asia/Kolkata', note: ''}),
      entity('comment', 'cw', {targetType: 'writeoff', targetId: 'w', authorId: 'me', body: 'Forgiven at the reunion', mentions: [], editedAt: null}),
    ])
    const found = await openSearch(store, 'reunion', {today, categories})
    expect(found.foundPayments().map(x => x.id)).toEqual(['w'])
    expect(found.commentText('w')).toBe('Forgiven at the reunion')
    await store.close()
  })

  test('more than 30 payments page like expenses, newest first', async () => {
    resetClock()
    const store = await open()
    await put(store, [entity<Person>('person', 'me', {name: 'Asha', isMe: true}), ...Array.from({length: 45}, (_, i) => repayment(`p${String(i).padStart(2, '0')}`, {note: 'Chai money', date: `2026-09-${String(1 + (i % 28)).padStart(2, '0')}`}))])
    const session = await openSearch(store, 'chai', {today, categories})
    expect(session.paymentCount).toBe(45)
    expect(session.foundPayments()).toHaveLength(30)
    expect(session.isPaymentsDone()).toBe(false)
    await session.stepPayments()
    expect(session.isPaymentsDone()).toBe(true)
    const all = session.foundPayments()
    expect(new Set(all.map(x => x.id)).size).toBe(45)
    const order = all.map(x => `${x.data.date}:${String(x.createdAt).padStart(13, '0')}`)
    expect(order).toEqual([...order].sort().reverse())
    await store.close()
  })

  test('"this week" and "last week" follow the first day of the week', async () => {
    resetClock()
    const store = await open()
    // Today is Monday 2026-10-26.
    await put(store, [entity<Person>('person', 'me', {name: 'Asha', isMe: true}), expense('sat', {title: 'Sat', date: '2026-10-24'}), expense('sun', {title: 'Sun', date: '2026-10-25'}), expense('mon', {title: 'Mon', date: '2026-10-26'}), expense('fri', {title: 'Fri', date: '2026-10-23'}), expense('prevsun', {title: 'PrevSun', date: '2026-10-18'})])
    const week = async (q: string, weekStart: 0 | 1 | 6) => (await searchStore(store, q, {today, categories, weekStart})).expenses.map(e => e.id)
    expect(await week('this week', 1)).toEqual(['mon'])
    expect(await week('this week', 0)).toEqual(['mon', 'sun'])
    expect(await week('this week', 6)).toEqual(['mon', 'sun', 'sat'])
    expect(await week('last week', 1)).toEqual(['sun', 'sat', 'fri'])
    expect(await week('last week', 0)).toEqual(['sat', 'fri', 'prevsun'])
    expect(await week('last week', 6)).toEqual(['fri', 'prevsun'])
    await store.close()
  })
})

test('a database whose terms predate the current index is rebuilt on its first search', async () => {
  // An older build kept no payment, comment or status terms and no index version: its terms and its marker are gone.
  resetClock()
  const executor = bunExecutor(':memory:')
  const first = await openSqlStore(executor)
  await put(first, [entity<Person>('person', 'me', {name: 'Asha', isMe: true}), repayment('p', {note: 'Beta'}), expense('e', {title: 'Alpha'})])
  await executor.run('DELETE FROM search_terms', [])
  await executor.run("DELETE FROM meta WHERE key = 'searchIndex'", [])
  const reopened = await openSqlStore(executor)
  expect((await searchStore(reopened, 'beta', {today, categories})).payments.map(p => p.id)).toEqual(['p'])
  expect((await searchStore(reopened, 'alpha', {today, categories})).expenses.map(e => e.id)).toEqual(['e'])
  // Marked current, so the terms are not rebuilt again.
  expect((await executor.all<{value: string}>("SELECT value FROM meta WHERE key = 'searchIndex'", [])).length).toBe(1)
})

test('a writer of the same index version that left records without terms (an older tab, a rollback) is rebuilt', async () => {
  resetClock()
  const executor = bunExecutor(':memory:')
  const first = await openSqlStore(executor)
  await put(first, [entity<Person>('person', 'me', {name: 'Asha', isMe: true}), repayment('p', {note: 'Beta'}), expense('e', {title: 'Alpha'}), expense('f', {title: 'Gamma'})])
  // The marker says current, but two records have no keys at all: what a build without them writes.
  await executor.run("DELETE FROM search_terms WHERE entityId IN ('e', 'p')", [])
  const reopened = await openSqlStore(executor)
  expect((await searchStore(reopened, 'alpha', {today, categories})).expenses.map(e => e.id)).toEqual(['e'])
  expect((await searchStore(reopened, 'beta', {today, categories})).payments.map(p => p.id)).toEqual(['p'])
  expect((await executor.all<{n: number}>("SELECT COUNT(*) AS n FROM search_terms WHERE kind = 'd'", []))[0]!.n).toBe(3)
})

test('a rebuild that fails is forgotten: the next search tries again (never a rejection kept for good)', async () => {
  resetClock()
  const inner = bunExecutor(':memory:')
  let isBroken = false
  const executor = {
    ...inner,
    run: async (sql: string, params: unknown[]) => {
      if (isBroken && /search_terms/.test(sql) && /INSERT/i.test(sql)) throw new Error('disk full')
      return inner.run(sql, params)
    },
  }
  const first = await openSqlStore(executor)
  await put(first, [entity<Person>('person', 'me', {name: 'Asha', isMe: true}), expense('e', {title: 'Alpha'})])
  await executor.run("DELETE FROM meta WHERE key = 'searchIndex'", [])
  const reopened = await openSqlStore(executor)
  isBroken = true
  await expect(reopened.prepareSearch()).rejects.toThrow('disk full')
  await expect(openSearch(reopened, 'alpha', {today, categories})).rejects.toThrow('disk full')
  isBroken = false
  expect((await searchStore(reopened, 'alpha', {today, categories})).expenses.map(e => e.id)).toEqual(['e'])
})
