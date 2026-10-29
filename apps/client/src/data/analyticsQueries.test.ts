import {Database} from 'bun:sqlite'
import {expect, test} from 'bun:test'
import {type DateRange, type SpendCell} from '@splito/domain'
import {cellsOfEntity, type Expense, openSqlStore, type Repayment, type SqlExecutor, type Store} from '@splito/sync'

import {cellsQuery} from './analyticsQueries'

/*
 * The period cells Analytics shows are made of stored month sums (whole
 * months) and reads of the date indexes (the partial months at the edges).
 * Both must agree with the cells worked out from the records themselves,
 * for any range: partial head and tail, one month, a range before the data,
 * deleted rows, and a row of a shape this build does not know.
 */

function memoryExecutor(): SqlExecutor {
  const db = new Database(':memory:')
  return {
    exec: async sql => void db.run(sql),
    run: async (sql, params) => void db.query(sql).run(...(params as never[])),
    all: async (sql, params) => db.query(sql).all(...(params as never[])) as never,
    async withTransaction(fn) {
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
  }
}

/** mulberry32, so a failing seed replays. */
function rng(seed: number) {
  let a = seed >>> 0
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return {next, int: (lo: number, hi: number) => lo + Math.floor(next() * (hi - lo + 1))}
}

const day = (m: number, d: number) => `2026-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
const key = (c: SpendCell) => JSON.stringify([c.date.slice(0, 7), c.currency, c.groupId, c.category, c.person, c.kind])
/** Cells folded by month and key, so stored month rows and per-day cells compare. */
function folded(cells: SpendCell[]) {
  const m = new Map<string, bigint[]>()
  for (const c of cells) {
    const v = m.get(key(c)) ?? [0n, 0n, 0n, 0n, 0n]
    v[0]! += c.total
    v[1]! += c.paid
    v[2]! += c.share
    v[3]! += c.net
    v[4]! += BigInt(c.count)
    m.set(key(c), v)
  }
  return [...m].filter(([, v]) => v.some(x => x !== 0n)).sort(([x], [y]) => (x < y ? -1 : 1))
}

async function seed(store: Store, rand: ReturnType<typeof rng>) {
  const entities = Array.from({length: 120}, (_, i) => {
    const date = day(rand.int(1, 8), rand.int(1, 28))
    const isTransfer = i % 5 === 0
    const base = {version: 1, deleted: i % 11 === 0, createdAt: i + 1, updatedAt: i + 1, syncStatus: 'local' as const, serverVersion: null, syncedAt: null, syncError: null}
    return isTransfer
      ? {...base, type: 'repayment' as const, id: `r${i}`, data: {groupId: i % 2 ? 'g1' : null, from: 'me', to: 'a', currency: 'INR', amount: BigInt(rand.int(1, 9000)), date, tz: 'UTC', note: ''} as Repayment}
      : {
          ...base,
          type: 'expense' as const,
          id: `e${i}`,
          data: {title: `E${i}`, groupId: i % 3 ? 'g1' : null, currency: i % 7 === 0 ? 'EUR' : 'INR', total: 1000n, payers: {me: 1000n}, split: {mode: 'equal', participants: ['me', 'a']}, shares: {me: 500n, a: 500n}, date, tz: 'UTC', category: i % 2 ? 'food' : 'fun', notes: ''} as unknown as Expense,
        }
  })
  // A row from a newer build: dated in range, but not a shape this build reads. It counts for nothing, in the sums and in the reads.
  const alien = {type: 'expense' as const, id: 'alien', data: {date: day(4, 10), currency: 'INR', total: 'many'} as unknown as Expense, version: 1, deleted: false, createdAt: 999, updatedAt: 999, syncStatus: 'local' as const, serverVersion: null, syncedAt: null, syncError: null}
  await store.transaction(async tx => {
    for (const e of [...entities, alien]) await tx.put(e)
  })
  return [...entities, alien]
}

test('period cells equal the cells of the records, for random ranges (partial head and tail, one month, before the data)', async () => {
  const store = await openSqlStore(memoryExecutor())
  const rand = rng(2026)
  const entities = await seed(store, rand)
  const all = entities.flatMap(e => cellsOfEntity(e as never)).filter(c => c.currency === 'INR')
  const ranges: DateRange[] = [
    {from: day(3, 1), to: day(5, 31)}, // whole months
    {from: day(3, 10), to: day(5, 31)}, // partial head
    {from: day(3, 1), to: day(5, 12)}, // partial tail
    {from: day(3, 10), to: day(5, 12)}, // both
    {from: day(4, 5), to: day(4, 20)}, // inside one month
    {from: day(4, 1), to: day(4, 30)}, // exactly one month
    {from: '2025-01-01', to: '2025-06-30'}, // before the data
    ...Array.from({length: 12}, (): DateRange => {
      const a = day(rand.int(1, 9), rand.int(1, 28))
      const b = day(rand.int(1, 9), rand.int(1, 28))
      return a < b ? {from: a, to: b} : {from: b, to: a}
    }),
  ]
  for (const range of ranges)
    for (const exact of [false, true]) {
      const load = cellsQuery('INR', range, exact).loader(store, {reload() {}})
      const got = await load('unknown', undefined)
      const inside = all.filter(c => c.date >= range.from && c.date <= range.to)
      const earlier = all.filter(c => c.date < range.from)
      expect([range, exact, folded(got.period)]).toEqual([range, exact, folded(inside)])
      expect([range, exact, folded(got.before)]).toEqual([range, exact, folded(earlier)])
    }
  // One group: the same cells as the records of that group, read by its own date index.
  const g1 = all.filter(c => c.groupId === 'g1')
  for (const range of ranges.slice(0, 6))
    for (const exact of [false, true]) {
      const got = await cellsQuery('INR', range, exact, 'g1').loader(store, {reload() {}})('unknown', undefined)
      expect([range, exact, folded(got.period)]).toEqual([range, exact, folded(g1.filter(c => c.date >= range.from && c.date <= range.to))])
    }
  await store.close()
})
