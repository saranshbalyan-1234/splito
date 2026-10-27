import {Database} from 'bun:sqlite'
import {afterEach, expect, setSystemTime, test} from 'bun:test'
import {ensureMe, type MutationCtx, openSqlStore} from '@splito/sync'

import {seedDemoData} from '#/data/demoSeed'

const ME = 'me-0001'

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

afterEach(() => setSystemTime())

async function counts(store: Awaited<ReturnType<typeof memoryStore>>) {
  const [people, groups, expenses, repayments, writeoffs, requests, links] = await Promise.all(
    (['person', 'group', 'expense', 'repayment', 'writeoff', 'friendRequest', 'inviteLink'] as const).map(t => store.count(t)),
  )
  return {people, groups, expenses, repayments, writeoffs, requests, links}
}

test('the demo seed dates records on the local day of their time zone (audit m18)', async () => {
  // 01:30 on 28 Oct in India is still 27 Oct in UTC: the case a UTC slice dated one day early.
  setSystemTime(new Date('2026-10-27T20:00:00Z'))
  const store = await memoryStore()
  let n = 0
  const ctx: MutationCtx = {deviceId: 'd', actor: ME, now: () => Date.now(), newId: () => `op-${++n}`}
  await ensureMe(store, ctx, 'Me')
  await seedDemoData(store, ctx)
  const cruise = (await store.getAll<{title: string; date: string}>('expense')).find(e => e.data.title === 'Sunset cruise')!
  // Added 3 days earlier: 2026-10-24T20:00Z = 25 Oct 01:30 in Asia/Kolkata.
  expect(cruise.data.date).toBe('2026-10-25')
  const payment = (await store.getAll<{date: string}>('repayment'))[0]!
  expect(payment.data.date).toBe('2026-10-26')
})

test('seeding twice, or after a seed cut short, adds nothing twice (audit m18)', async () => {
  const store = await memoryStore()
  let n = 0
  const ctx: MutationCtx = {deviceId: 'd', actor: ME, now: () => Date.now(), newId: () => `op-${++n}`}
  await ensureMe(store, ctx, 'Me')
  await seedDemoData(store, ctx)
  const once = await counts(store)
  expect(once.groups).toBeGreaterThan(0)
  expect(once.requests).toBeGreaterThan(0)
  await seedDemoData(store, ctx)
  expect(await counts(store)).toEqual(once)
})
