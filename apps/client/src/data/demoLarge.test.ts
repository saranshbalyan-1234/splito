import {Database} from 'bun:sqlite'
import {expect, test} from 'bun:test'
import {ensureMe, type MutationCtx, openSqlStore} from '@splito/sync'

import {addLargeDemo, removeLargeDemo} from '#/data/demoLarge'

const ME = 'me-0001'
const NOW = Date.parse('2026-10-27T14:30:00Z')

/* Through the real mutations, on the SQLite store engine (bun:sqlite in memory). */
function memoryStore() {
  const db = new Database(':memory:')
  return openSqlStore({
    exec: async sql => void db.run(sql),
    run: async (sql, params) => void db.query(sql).run(...(params as never[])),
    all: async (sql, params) =>
      db.query(sql).all(...(params as never[])) as never,
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

test('add writes the plan through the mutations; adding twice is a no-op; remove erases exactly it', async () => {
  const store = await memoryStore()
  let n = 0
  const ctx: MutationCtx = {
    deviceId: 'd',
    actor: ME,
    now: () => NOW,
    newId: () => `op-${++n}`,
  }
  await ensureMe(store, ctx, 'Me')
  const counts = await addLargeDemo(store, ctx)
  expect(counts?.expenses).toBeGreaterThan(1400)
  const expenses = await store.getAll('expense')
  expect(expenses.filter(e => !e.deleted).length).toBe(counts!.expenses)
  expect(await addLargeDemo(store, ctx)).toBeNull()
  expect((await store.getAll('expense')).length).toBe(expenses.length)
  await removeLargeDemo(store)
  for (const type of ['group', 'expense', 'repayment', 'writeoff'] as const)
    expect(await store.getAll(type)).toEqual([])
  expect((await store.getAll('person')).map(p => p.id)).toEqual([ME])
  expect((await store.outbox()).map(o => o.entityId)).toEqual([ME])
}, 60_000)
