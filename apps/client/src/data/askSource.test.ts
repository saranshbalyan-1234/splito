import {Database} from 'bun:sqlite'
import {expect, test} from 'bun:test'
import {
  balanceRows,
  cellsByCategory,
  cellTotals,
  computeShares,
  type CurrencyCode,
  magnitude,
  personSummary,
  ZERO,
} from '@splito/domain'
import {
  createExpense,
  createGroup,
  createPerson,
  createRepayment,
  DEFAULT_CATEGORIES,
  ensureMe,
  type Expense,
  type Group,
  type MutationCtx,
  openSqlStore,
  type Store,
  toExpenseRecord,
  toRepaymentRecord,
  toWriteOffRecord,
  type WriteOff,
  type Repayment,
  type Entity,
} from '@splito/sync'

import {answerIntent, type AskEnv} from '#/lib/ask/answer'
import {parseQuestion} from '#/lib/ask/parse'
import {type Answer, type Vocab} from '#/lib/ask/types'
import {storeAskSource} from '#/data/askSource'
import {DEMO_EXPENSES, DEMO_FRIENDS, DEMO_GROUPS, demoSplit, type DemoGroupKey, type DemoPersonKey} from '#/data/demoData'

/*
 * Ask Splito's answers against the screens they quote (F-2301 acc 3): the
 * demo set goes in through the real mutations on the SQLite store, and each
 * answer is checked against figures worked out here from the records
 * themselves, never from the engine's own reads.
 */

const NOW = Date.parse('2026-10-27T14:30:00Z')
const TODAY = '2026-10-27'

function memoryStore() {
  const db = new Database(':memory:')
  return openSqlStore({
    exec: async sql => void db.run(sql),
    run: async (sql, params) => void db.query(sql).run(...(params as never[])),
    all: async (sql, params) => db.query(sql).all(...(params as never[])) as never,
    withTransaction: async fn => {
      db.run('BEGIN IMMEDIATE')
      try {
        const r = await fn()
        db.run('COMMIT')
        return r
      } catch (e) {
        db.run('ROLLBACK')
        throw e
      }
    },
    close: async () => db.close(),
  })
}

async function seedDemo() {
  const store: Store = await memoryStore()
  let n = 0
  const ctx: MutationCtx = {deviceId: 'd', actor: 'me-0001', now: () => NOW, newId: () => `op-${++n}`}
  await ensureMe(store, ctx, 'Me')
  const ids = {me: ctx.actor} as Record<DemoPersonKey, string>
  for (const [key, name] of Object.entries(DEMO_FRIENDS)) ids[key as DemoPersonKey] = (await createPerson(store, ctx, {name})).id
  const groupIds = {} as Record<DemoGroupKey, string>
  for (const [key, g] of Object.entries(DEMO_GROUPS)) {
    groupIds[key as DemoGroupKey] = (
      await createGroup(store, ctx, {name: g.name, kind: g.kind, currency: g.currency, startDate: g.startDate, endDate: g.endDate, tz: g.tz, memberIds: g.members.map(m => ids[m])} as never)
    ).id
  }
  for (const e of DEMO_EXPENSES) {
    await createExpense(store, ctx, {
      title: e.title,
      groupId: e.group ? groupIds[e.group] : null,
      currency: e.currency,
      total: e.total,
      payers: Object.fromEntries(Object.entries(e.payers).map(([k, v]) => [ids[k as DemoPersonKey], v])),
      split: demoSplit(e, p => ids[p]),
      date: e.date,
      tz: e.group ? DEMO_GROUPS[e.group].tz : 'Asia/Kolkata',
      category: e.category,
      notes: e.notes ?? '',
    })
  }
  // A settle-up the other way, so a balance has a payment in it.
  await createRepayment(store, ctx, {groupId: null, currency: 'INR', from: ids.riya, to: ids.me, amount: 5_000_00n, date: '2026-06-20', tz: 'Asia/Kolkata', note: ''})
  return {store, ctx, ids, groupIds}
}

async function envFor(store: Store, me: string): Promise<AskEnv> {
  const people = (await store.getAll('person')).filter(p => !p.deleted)
  const groups = (await store.getAll<Group>('group')).filter(g => !g.deleted)
  const categories = DEFAULT_CATEGORIES.map(c => ({id: c.id, name: c.name, color: c.color}))
  return {
    source: storeAskSource(store, me, {today: TODAY, mark: '.', categories}),
    me,
    today: TODAY,
    weekStart: 1,
    defaultCurrency: 'INR',
    mark: '.',
    people: people.filter(p => p.id !== me).map(p => ({id: p.id, name: (p.data as {name: string}).name})),
    groups: groups.map(g => ({id: g.id, name: g.data.name})),
    categories,
  }
}

const vocabOf = (env: AskEnv): Vocab => ({people: env.people, groups: env.groups, categories: env.categories})
const ask = async (q: string, env: AskEnv): Promise<Answer> => answerIntent(parseQuestion(q, vocabOf(env)), env)

/** Every live money record, read for the test's own ground truth. */
async function records(store: Store) {
  const expenses = (await store.getAll<Expense>('expense')).map(e => toExpenseRecord(e as Entity<Expense>))
  const repayments = (await store.getAll<Repayment>('repayment')).map(e => toRepaymentRecord(e as Entity<Repayment>))
  const writeOffs = (await store.getAll<WriteOff>('writeoff')).map(e => toWriteOffRecord(e as Entity<WriteOff>))
  return {expenses, all: [...expenses, ...repayments, ...writeOffs]}
}

test('"What does Riya owe me?" is the People balance, down to the group parts, for every friend', async () => {
  const {store, ctx, ids} = await seedDemo()
  const env = await envFor(store, ctx.actor)
  const groups = (await store.getAll<Group>('group')).filter(g => !g.deleted)
  const truth = personSummary(
    balanceRows((await records(store)).all, ctx.actor, Object.fromEntries(groups.map(g => [g.id, g.data.rules]))),
    {includeGroups: true},
  )
  let checked = 0
  for (const [key, name] of Object.entries(DEMO_FRIENDS)) {
    const a = await ask(`What does ${name.split(' ')[0]} owe me?`, env)
    expect(a.kind).toBe('balance')
    if (a.kind !== 'balance') continue
    expect(a.person.id).toBe(ids[key as DemoPersonKey])
    const want = truth.find(s => s.person === a.person.id)
    const got = Object.fromEntries(a.lines.map(l => [l.currency, l.total]))
    const expected = Object.fromEntries(Object.entries(want?.byCurrency ?? {}).filter(([, c]) => c.total !== ZERO).map(([cur, c]) => [cur, c.total]))
    expect(got, name).toEqual(expected)
    // One line per currency, never one summed figure.
    expect(new Set(a.lines.map(l => l.currency)).size).toBe(a.lines.length)
    checked++
  }
  expect(checked).toBe(6)
  // Riya really is in the books: owes or is owed in INR.
  const riya = await ask('What does Riya owe me?', env)
  expect(riya.kind === 'balance' && riya.lines.some(l => l.currency === 'INR' && l.total !== ZERO)).toBe(true)
})

test('who owes me the most and whom I owe the most match the balances, largest first, per currency', async () => {
  const {store, ctx} = await seedDemo()
  const env = await envFor(store, ctx.actor)
  const groups = (await store.getAll<Group>('group')).filter(g => !g.deleted)
  const truth = personSummary(balanceRows((await records(store)).all, ctx.actor, Object.fromEntries(groups.map(g => [g.id, g.data.rules]))), {includeGroups: true})
  const owed: Record<string, bigint> = {}
  const owe: Record<string, bigint> = {}
  for (const s of truth) for (const [cur, c] of Object.entries(s.byCurrency)) (c.total > ZERO ? (owed[`${s.person}:${cur}`] = c.total) : c.total < ZERO ? (owe[`${s.person}:${cur}`] = magnitude(c.total)) : 0)
  const a = await ask('Who owes me the most?', env)
  const b = await ask('Whom do I owe the most?', env)
  if (a.kind !== 'ranking' || b.kind !== 'ranking') throw new Error('not a ranking')
  expect(Object.fromEntries(a.owedToMe.map(r => [`${r.person.id}:${r.currency}`, r.amount]))).toEqual(owed)
  expect(Object.fromEntries(b.iOwe.map(r => [`${r.person.id}:${r.currency}`, r.amount]))).toEqual(owe)
  // Within a currency the largest is first.
  for (const cur of new Set(a.owedToMe.map(r => r.currency))) {
    const xs = a.owedToMe.filter(r => r.currency === cur).map(r => r.amount)
    expect(xs).toEqual([...xs].sort((x, y) => (x > y ? -1 : x < y ? 1 : 0)))
  }
})

test('category totals equal Analytics: this year, last month and one named month, per currency', async () => {
  const {store, ctx} = await seedDemo()
  const env = await envFor(store, ctx.actor)
  const expenses = (await store.getAll<Expense>('expense')).filter(e => !e.deleted)
  /* The figures Analytics draws, worked out from the records: my share by category. */
  const truth = (from: string, to: string, currency: CurrencyCode) => {
    const mine = new Map<string, bigint>()
    for (const e of expenses) {
      const d = e.data
      const share = d.shares[ctx.actor] ?? ZERO
      if (d.date < from || d.date > to || d.currency !== currency || share === ZERO) continue
      mine.set(d.category ?? 'other', (mine.get(d.category ?? 'other') ?? ZERO) + share)
    }
    return mine
  }
  for (const [question, from, to] of [
    ['Show my spending by category in 2026', '2026-01-01', '2026-12-31'],
    ['Show my spending by category in december 2025', '2025-12-01', '2025-12-31'],
    ['Show my spending by category in april 2026', '2026-04-01', '2026-04-30'],
    ['Show my spending by category all time', '0000-01-01', '9999-12-31'],
  ] as const) {
    const a = await ask(question, env)
    if (a.kind !== 'spend') throw new Error(`${question}: ${a.kind}`)
    expect(a.breakdown).toBe('category')
    for (const c of a.currencies) {
      const want = truth(from, to, c.currency)
      expect(Object.fromEntries(c.slices.map(s => [s.key, s.value])), `${question} ${c.currency}`).toEqual(Object.fromEntries(want))
      // The headline is the sum of that currency's categories (all of them were shown: fewer than 8).
      expect(c.share).toBe([...want.values()].reduce((x, y) => x + y, ZERO))
    }
    // Both demo currencies show up as their own lines when the period holds both.
    expect(new Set(a.currencies.map(c => c.currency)).size).toBe(a.currencies.length)
  }
  // And the same cells Analytics itself folds.
  const food = await ask('How much did I spend on food in december 2025?', env)
  if (food.kind !== 'spend') throw new Error('not spend')
  const inr = food.currencies.find(c => c.currency === 'INR')!
  const cells = (await env.source.cells('INR', {from: '2025-12-01', to: '2025-12-31'}, false)).filter(c => c.kind === 'expense' && c.category === 'food')
  expect(inr.share).toBe(cellTotals(cells, ctx.actor).share)
  expect(cellsByCategory(await env.source.cells('INR', {from: '2025-12-01', to: '2025-12-31'}, false), ctx.actor).find(s => s.key === 'food')?.share).toBe(inr.share)
})

test('a group: the trip by day sums to my share, and who owes whom is the settle-up plan', async () => {
  const {store, ctx, groupIds} = await seedDemo()
  const env = await envFor(store, ctx.actor)
  const trend = await ask('Show my Goa trip spending by day', env)
  if (trend.kind !== 'trend') throw new Error(trend.kind)
  expect(trend.bucket).toBe('day')
  expect(trend.group?.id).toBe(groupIds.goa)
  expect(trend.period.from).toBe('2025-12-20')
  expect(trend.period.to).toBe('2025-12-27')
  expect(trend.currencies).toHaveLength(1)
  const line = trend.currencies[0]!
  expect(line.points).toHaveLength(8)
  const goa = DEMO_EXPENSES.filter(e => e.group === 'goa')
  const mine = goa.map(e => computeShares(e.total, demoSplit(e, p => (p === 'me' ? ctx.actor : p)))[ctx.actor] ?? ZERO)
  expect(line.total).toBe(mine.reduce((x, y) => x + y, ZERO))

  const owes = await ask('Who owes whom in Goa trip?', env)
  if (owes.kind !== 'groupBalance') throw new Error(owes.kind)
  const nets = await store.balances({groupId: groupIds.goa})
  // Everything the plan moves is what the group's members net out to.
  const sent: Record<string, bigint> = {}
  for (const t of owes.owes) {
    sent[t.from.id] = (sent[t.from.id] ?? ZERO) + t.amount
    sent[t.to.id] = (sent[t.to.id] ?? ZERO) - t.amount
  }
  for (const n of nets.filter(n => n.currency === 'INR')) expect(sent[n.personId] ?? ZERO).toBe(-n.amount)
})

test('find hands the words to Search and says whether it read everything', async () => {
  const {store, ctx} = await seedDemo()
  const env = await envFor(store, ctx.actor)
  const a = await ask('find expenses with dinner', env)
  if (a.kind !== 'find') throw new Error(a.kind)
  expect(a.query).toBe('dinner')
  expect(a.count).toBeGreaterThan(0)
  expect(a.rows.every(r => r.title.length > 0)).toBe(true)
  const over = await ask('show expenses over 50000', env)
  if (over.kind !== 'find') throw new Error(over.kind)
  expect(over.rows.every(r => r.currency !== 'INR' || r.total > 50_000_00n)).toBe(true)
})

test('on the large demo set: every friend\'s balance equals People\'s and a year of category totals equals the records', async () => {
  const {addLargeDemo} = await import('#/data/demoLarge')
  const store: Store = await memoryStore()
  let n = 0
  const ctx: MutationCtx = {deviceId: 'd', actor: 'me-0001', now: () => NOW, newId: () => `op-${++n}`}
  await ensureMe(store, ctx, 'Me')
  await addLargeDemo(store, ctx)
  const today = new Date().toISOString().slice(0, 10)
  const env = {...(await envFor(store, ctx.actor)), today}
  const groups = (await store.getAll<Group>('group')).filter(g => !g.deleted)
  const truth = personSummary(balanceRows((await records(store)).all, ctx.actor, Object.fromEntries(groups.map(g => [g.id, g.data.rules]))), {includeGroups: true})
  let checked = 0
  for (const p of env.people) {
    // Two friends can share a first name, so ask by the full name.
    const a = await ask(`What does ${p.name} owe me?`, env)
    if (a.kind === 'clarify') continue
    if (a.kind !== 'balance') throw new Error(`${p.name}: ${a.kind}`)
    const want = Object.fromEntries(Object.entries(truth.find(s => s.person === a.person.id)?.byCurrency ?? {}).filter(([, c]) => c.total !== ZERO).map(([cur, c]) => [cur, c.total]))
    expect(Object.fromEntries(a.lines.map(l => [l.currency, l.total])), p.name).toEqual(want)
    checked++
  }
  expect(checked).toBeGreaterThan(5)

  const year = today.slice(0, 4)
  const a = await ask('Show my spending by category this year', env)
  if (a.kind !== 'spend') throw new Error(a.kind)
  const expenses = (await store.getAll<Expense>('expense')).filter(e => !e.deleted)
  expect(a.currencies.length).toBeGreaterThan(0)
  for (const c of a.currencies) {
    const mine = new Map<string, bigint>()
    for (const e of expenses) {
      const d = e.data
      const share = d.shares[ctx.actor] ?? ZERO
      if (!d.date.startsWith(year) || d.currency !== c.currency || share === ZERO) continue
      mine.set(d.category ?? 'other', (mine.get(d.category ?? 'other') ?? ZERO) + share)
    }
    // The answer shows at most 8 slices; the headline is the whole.
    expect(c.share, c.currency).toBe([...mine.values()].reduce((x, y) => x + y, ZERO))
    for (const s of c.slices) expect(s.value, `${c.currency} ${s.key}`).toBe(mine.get(s.key))
  }
}, 120_000)
