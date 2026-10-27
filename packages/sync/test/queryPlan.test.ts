/*
 * ARCHITECTURE 9.8: every hot read goes through an index. This records the
 * SQL the typed store reads send to SQLite and asks SQLite for each plan: a
 * `SCAN` of a table is a failure (only maintenance reads whole tables).
 */
import {Database} from 'bun:sqlite'
import {expect, test} from 'bun:test'
import {mkdtempSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'

import {createExpense, createGroup, createPerson, createRepayment, ensureMe} from '../src/mutations'
import {openSqlStore, type SqlExecutor} from '../src/sqlStore'
import {bunExecutor} from './bunExecutor'
import {makeCtx} from './storeV2Contract'

test('the typed reads use an index on every table they touch', async () => {
  const path = join(mkdtempSync(join(tmpdir(), 'splito-plan-')), 'db.sqlite')
  const inner = bunExecutor(path)
  const seen: Array<{sql: string; params: unknown[]}> = []
  let recording = false
  const db: SqlExecutor = {
    ...inner,
    all: (sql, params) => (recording && seen.push({sql, params}), inner.all(sql, params)),
  }
  const s = await openSqlStore(db)
  const ctx = makeCtx()
  await ensureMe(s, ctx, 'Me')
  const a = await createPerson(s, ctx, {name: 'Asha'})
  const g = await createGroup(s, ctx, {name: 'Goa', kind: 'trip', currency: 'INR', memberIds: [a.id], startDate: null, endDate: null})
  const e = await createExpense(s, ctx, {
    title: 'T', groupId: g.id, currency: 'INR', total: 100n, payers: {me: 100n}, split: {mode: 'equal', participants: ['me', a.id]},
    date: '2026-10-01', tz: 'UTC', category: 'c', notes: '',
  })
  await createRepayment(s, ctx, {groupId: null, currency: 'INR', from: 'me', to: a.id, amount: 5n, date: '2026-10-02', tz: 'UTC', note: ''})

  recording = true
  await s.get('expense', e.id)
  await s.page('expense', {index: 'byGroupDate', eq: [g.id], dir: 'prev', limit: 20})
  await s.page('expense', {index: 'byDate', min: '2026-10-01', max: '2026-10-31', dir: 'prev', limit: 20})
  await s.page('expense', {index: 'byDeleted', eq: [1], min: 0})
  await s.page('expense', {index: 'byUpdatedAt', dir: 'prev', limit: 20})
  await s.page('repayment', {index: 'byFrom', eq: ['me'], dir: 'prev', limit: 20, after: ['me', '2026-10-02', 'zzz']})
  await s.page('group', {index: 'byUpdatedAt', dir: 'prev', limit: 20})
  await s.page('person', {index: 'byName', limit: 50})
  await s.parties({index: 'byPersonDate', eq: [a.id], dir: 'prev', limit: 20})
  await s.parties({index: 'byGroupPerson', eq: [g.id, a.id], dir: 'prev', limit: 20})
  await s.members({groupId: g.id})
  await s.members({personId: a.id})
  await s.balances({personId: 'me'})
  await s.balances({groupId: g.id})
  await s.pairBalances('me')
  await s.lastActivity(['me', a.id])
  await s.historyPage({limit: 20})
  await s.history('expense', e.id)
  await s.outboxByStatus('queued')
  await s.syncCounts()
  recording = false

  expect(seen.length).toBeGreaterThan(30)
  const raw = new Database(path)
  /** A table walk: any SCAN, except an index walk that stops at a LIMIT (the newest history rows). */
  const scansOf = (sql: string, params: unknown[]) =>
    (raw.query(`EXPLAIN QUERY PLAN ${sql}`).all(...(params as never[])) as Array<{detail: string}>)
      .map(r => r.detail)
      .filter(detail => /^SCAN /.test(detail) && !(/USING (COVERING )?INDEX/.test(detail) && / LIMIT /.test(sql)))
  const scans = seen.flatMap(({sql, params}) => scansOf(sql, params).map(d => `${sql}\n  -> ${d}`))
  expect(scans).toEqual([])
  // The check has teeth: reading a whole money table is a scan.
  expect(scansOf('SELECT * FROM "expenses" ORDER BY "id"', [])).toHaveLength(1)
  raw.close()
  await s.close()
})
