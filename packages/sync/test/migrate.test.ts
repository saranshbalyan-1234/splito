/*
 * ARCHITECTURE 9.8: v1 -> v2 is a versioned, idempotent migration, tested
 * with a v1 fixture, including the large demo set: every row, history entry,
 * outbox op and balance is identical before and after, on IndexedDB and on
 * SQLite alike. The v1 layout is written here the way the old engines wrote
 * it (one `entities` store keyed [type, id], plus `history` and `outbox`).
 */
import 'fake-indexeddb/auto'
import {IDBFactory} from 'fake-indexeddb'

import {Database} from 'bun:sqlite'
import {beforeAll, describe, expect, test} from 'bun:test'
import {type IDBPDatabase, wrap} from 'idb'
import {mkdtempSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'

import {encode} from '../src/codec'
import {applyDemoOp, generateLargeDemo, isDeferredOp} from '../src/demoLarge'
import {openIdbStore} from '../src/idbStore'
import {
  createExpense,
  createGroup,
  createPerson,
  createRepayment,
  createWriteOffs,
  deleteExpense,
  ensureMe,
} from '../src/mutations'
import {deleteFeedback, loadFeedback, saveFeedback} from '../src/feedback'
import {setPref} from '../src/preferences'
import {raiseDispute} from '../src/disputes'
import {scheduleReminder} from '../src/reminders'
import {createInviteLink, sendFriendRequest} from '../src/friends'
import {SCHEMA_VERSION, STORES} from '../src/schema'
import {openSqlStore, type SqlExecutor} from '../src/sqlStore'
import {insideTransaction, type Store, type StoreDump} from '../src/store'
import {bunExecutor} from './bunExecutor'
import {expectDerivedTablesMatch, expectProjectionsMatchLedger, storedAggregates, storedTerms} from './projectionCheck'
import {makeCtx} from './storeV2Contract'

/* -------------------------------------------------------------------------- */
/* Source data, written through the real mutations                             */
/* -------------------------------------------------------------------------- */

async function smallSet(): Promise<StoreDump> {
  const s = await openSqlStore(bunExecutor(':memory:'))
  const ctx = makeCtx()
  await ensureMe(s, ctx, 'Me')
  const a = await createPerson(s, ctx, {name: 'Asha', upiId: 'asha@upi'})
  const b = await createPerson(s, ctx, {name: 'Bilal'})
  const g = await createGroup(s, ctx, {name: 'Goa', kind: 'trip', currency: 'INR', memberIds: [a.id, b.id], startDate: '2026-10-01', endDate: null})
  const e = await createExpense(s, ctx, {
    title: 'Dinner', groupId: g.id, currency: 'INR', total: 1200n, payers: {me: 1200n},
    split: {mode: 'equal', participants: ['me', a.id, b.id]}, date: '2026-10-02', tz: 'Asia/Kolkata', category: 'food', notes: 'note',
  })
  const gone = await createExpense(s, ctx, {
    title: 'Oops', groupId: null, currency: 'EUR', total: 90n, payers: {[a.id]: 90n},
    split: {mode: 'equal', participants: ['me', a.id]}, date: '2026-10-03', tz: 'Europe/Lisbon', category: 'other', notes: '',
  })
  await deleteExpense(s, ctx, gone.id)
  await createRepayment(s, ctx, {groupId: null, currency: 'EUR', from: 'me', to: a.id, amount: 10n, date: '2026-10-04', tz: 'UTC', note: ''})
  await createWriteOffs(s, ctx, [{groupId: g.id, currency: 'INR', from: b.id, to: 'me', amount: 100n, date: '2026-10-05', tz: 'UTC', note: ''}])
  await setPref(s, ctx, 'defaultCurrency', 'EUR') // account scope: queued
  await setPref(s, ctx, 'analyticsScope', {nonGroup: true, groups: []}) // device scope: never queued
  await sendFriendRequest(s, ctx, {contact: {kind: 'email', value: 'zed@example.com'}, name: 'Zed', reach: 'unchecked'})
  await createInviteLink(s, ctx, {kind: 'group', groupId: g.id, maxUses: 5, expiresInMs: 86_400_000, approveJoins: false})
  // Feedback is kept on this device only (no endpoint yet): its own store, `local`, never queued. One is deleted (content stripped).
  const kept = await saveFeedback(s, ctx, {type: 'bug', message: 'The total on Home looks wrong', attachment: {uri: 'data:image/jpeg;base64,AAAA', mime: 'image/jpeg', width: 8, height: 8}, appInfo: {version: '1.0.0', platform: 'web', os: 'macOS', language: 'en', screen: '/settings'}, replyEmail: 'me@example.com'})
  const dropped = await saveFeedback(s, ctx, {type: 'idea', message: 'Please add a dark theme option', attachment: null, appInfo: null, replyEmail: null})
  await deleteFeedback(s, ctx, dropped.id)
  expect(kept.syncStatus).toBe('local')
  expect(e.version).toBe(1)
  const dump = await s.dump()
  await s.close()
  return dump
}

let large: StoreDump
/** The same with its disputes: a v1 file can hold any entity type, so the v1 upgrade must rebuild the disputed sums too. */
let largeWithDisputes: StoreDump
/** The balance sums the mutations kept while the large set was written: what a migration must rebuild exactly. */
let largeBalances: Awaited<ReturnType<Store['balances']>>
const sorted = (rows: Awaited<ReturnType<Store['balances']>>) => [...rows].sort((x, y) => (encode(x) < encode(y) ? -1 : 1))
beforeAll(async () => {
  const s = await openSqlStore(bunExecutor(':memory:'))
  const base = makeCtx()
  const ctx = {...base, actor: 'me-0001'}
  await ensureMe(s, ctx, 'Me')
  const now = Date.parse('2026-10-27T14:30:00Z')
  const { ops } = generateLargeDemo({me: ctx.actor, today: '2026-10-27', now})
  for (let i = 0; i < ops.length; i += 150)
    await s.transaction(async tx => {
      const batched = insideTransaction(s, tx)
      for (const op of ops.slice(i, i + 150)) if (!isDeferredOp(op)) await applyDemoOp(batched, ctx, op)
    })
  // The ops that read the store first (removing a friend, a group going, a member leaving) cannot join a batch.
  for (const op of ops.filter(isDeferredOp)) await applyDemoOp(s, ctx, op)
  const full = await s.dump()
  // The reminders store is new in v4 and the disputes store in v5: the older fixtures cannot hold them.
  const without = (types: string[]): StoreDump => ({
    ...full,
    entities: full.entities.filter(e => !types.includes(e.type)),
    history: full.history.filter(h => !types.includes(h.entityType)),
    outbox: full.outbox.filter(o => !types.includes(o.entityType)),
  })
  large = without(['reminder', 'dispute'])
  largeWithDisputes = without(['reminder'])
  largeBalances = await s.balances()
  await s.close()
}, 120_000)

/* -------------------------------------------------------------------------- */
/* The v1 layouts                                                              */
/* -------------------------------------------------------------------------- */

const v1Entity = (e: StoreDump['entities'][number]) => ({type: e.type, id: e.id, data: encode(e.data), version: e.version, deleted: e.deleted, updatedAt: e.updatedAt})
const v1History = (h: StoreDump['history'][number]) => ({...h, data: encode(h.data)})
const v1Op = ({status: _status, ...o}: StoreDump['outbox'][number]) => ({...o, payload: encode(o.payload)})

async function writeV1Idb(factory: IDBFactory, name: string, dump: StoreDump) {
  const req = factory.open(name, 1)
  req.onupgradeneeded = () => {
    const db = req.result
    db.createObjectStore('entities', {keyPath: ['type', 'id']})
    db.createObjectStore('history', {keyPath: ['entityType', 'entityId', 'version']})
    db.createObjectStore('outbox', {keyPath: 'seq', autoIncrement: true}).createIndex('opId', 'opId', {unique: true})
  }
  const db = (await wrap(req)) as IDBPDatabase
  const t = db.transaction(['entities', 'history', 'outbox'], 'readwrite')
  for (const e of dump.entities) void t.objectStore('entities').put(v1Entity(e))
  for (const h of dump.history) void t.objectStore('history').put(v1History(h))
  for (const o of dump.outbox) void t.objectStore('outbox').put(v1Op(o))
  await t.done
  db.close()
}

const V1_SQL = `CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  CREATE TABLE entities (type TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, version INTEGER NOT NULL,
    deleted INTEGER NOT NULL, updated_at INTEGER NOT NULL, PRIMARY KEY (type, id));
  CREATE TABLE history (entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, version INTEGER NOT NULL, data TEXT NOT NULL,
    deleted INTEGER NOT NULL, at INTEGER NOT NULL, actor TEXT NOT NULL, PRIMARY KEY (entity_type, entity_id, version));
  CREATE TABLE outbox (seq INTEGER PRIMARY KEY AUTOINCREMENT, op_id TEXT NOT NULL UNIQUE, device_id TEXT NOT NULL,
    actor TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, op_type TEXT NOT NULL,
    base_version INTEGER NOT NULL, payload TEXT NOT NULL, schema_version INTEGER NOT NULL, deps TEXT NOT NULL,
    attempts INTEGER NOT NULL, next_attempt_at INTEGER, last_error TEXT);
  INSERT INTO meta (key, value) VALUES ('schema_version', '1');`

function writeV1Sql(path: string, dump: StoreDump) {
  const db = new Database(path)
  db.run('BEGIN')
  for (const stmt of V1_SQL.split(';').filter(x => x.trim())) db.run(stmt)
  for (const e of dump.entities) {
    const r = v1Entity(e)
    db.query('INSERT INTO entities VALUES (?, ?, ?, ?, ?, ?)').run(r.type, r.id, r.data, r.version, r.deleted ? 1 : 0, r.updatedAt)
  }
  for (const h of dump.history) {
    const r = v1History(h)
    db.query('INSERT INTO history VALUES (?, ?, ?, ?, ?, ?, ?)').run(r.entityType, r.entityId, r.version, r.data, r.deleted ? 1 : 0, r.at, r.actor)
  }
  for (const o of dump.outbox) {
    const r = v1Op(o)
    db.query('INSERT INTO outbox VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
      r.seq!, r.opId, r.deviceId, r.actor, r.entityType, r.entityId, r.opType, r.baseVersion, r.payload, r.schemaVersion, JSON.stringify(r.deps), r.attempts, r.nextAttemptAt, r.lastError,
    )
  }
  db.run('COMMIT')
  db.close()
}

/* -------------------------------------------------------------------------- */
/* Checks                                                                      */
/* -------------------------------------------------------------------------- */

const keyOf = (e: {type: string; id: string}) => `${e.type}:${e.id}`
const byKey = <T extends {type: string; id: string}>(xs: T[]) => [...xs].sort((x, y) => (keyOf(x) < keyOf(y) ? -1 : 1))

/** Everything v1 held, compared before and after: only the new sync fields and the op status are new. */
async function expectSameAsV1(after: Store, before: StoreDump) {
  const now = await after.dump()
  const plain = (e: StoreDump['entities'][number]) => ({type: e.type, id: e.id, data: e.data, version: e.version, deleted: e.deleted, updatedAt: e.updatedAt})
  expect(byKey(now.entities).map(plain)).toEqual(byKey(before.entities).map(plain))
  const hkey = (h: StoreDump['history'][number]) => `${h.entityType}:${h.entityId}:${String(h.version).padStart(9, '0')}`
  expect([...now.history].sort((x, y) => (hkey(x) < hkey(y) ? -1 : 1))).toEqual([...before.history].sort((x, y) => (hkey(x) < hkey(y) ? -1 : 1)))
  expect(now.outbox.map(({status, ...o}) => ({...o, status: undefined}))).toEqual(before.outbox.map(o => ({...o, status: undefined})))
  expect(now.outbox.every(o => o.status === 'queued')).toBe(true)

  // A row with an op waiting is pending; every other v1 row was never queued.
  const queued = new Set(before.outbox.map(o => `${o.entityType}:${o.entityId}`))
  for (const e of now.entities) expect([keyOf(e), e.syncStatus]).toEqual([keyOf(e), queued.has(keyOf(e)) ? 'pending' : 'local'])

  // Balances: the tables built by the migration equal a recomputation, and the source store's own sums.
  await expectProjectionsMatchLedger(after)
  expect(Object.keys((await after.syncCounts()).expenses ?? {})).toHaveLength(5)
}


/** Feedback written before the upgrade is still there, in its own store, on this device only. */
async function expectFeedbackKept(store: Store, dump: StoreDump) {
  const before = dump.entities.filter(e => e.type === 'feedback')
  expect(before.length).toBe(2)
  const now = (await store.getAll('feedback')).sort((x, y) => (x.id < y.id ? -1 : 1))
  expect(now.map(({syncStatus: _s, serverVersion: _v, syncedAt: _a, syncError: _e, createdAt: _c, ...e}) => e)).toEqual(
    [...before].sort((x, y) => (x.id < y.id ? -1 : 1)).map(({syncStatus: _s, serverVersion: _v, syncedAt: _a, syncError: _e, createdAt: _c, ...e}) => e),
  )
  for (const f of now) expect(f.syncStatus).toBe('local')
  expect((await store.syncCounts()).feedback).toEqual({local: 2, pending: 0, syncing: 0, synced: 0, failed: 0})
  expect(await store.outbox()).toEqual(expect.not.arrayContaining([expect.objectContaining({entityType: 'feedback'})]))
  const listed = await loadFeedback(store)
  expect(listed.map(f => f.data.message)).toEqual(['The total on Home looks wrong'])
  expect(listed[0]!.data.attachment?.mime).toBe('image/jpeg')
  // A new one after the upgrade lands in the same store, still local.
  const fresh = await saveFeedback(store, {...makeCtx(), newId: () => 'fb-after-' + Math.random().toString(36).slice(2)}, {type: 'question', message: 'How do I export my data?', attachment: null, appInfo: null, replyEmail: null})
  expect(fresh.syncStatus).toBe('local')
  expect((await loadFeedback(store)).length).toBe(2)
}

const open: Record<string, (name: string, dump: StoreDump) => Promise<{store: () => Promise<Store>; version: () => Promise<number>}>> = {
  async IndexedDB(name, dump) {
    const factory = new IDBFactory()
    await writeV1Idb(factory, name, dump)
    return {
      factory,
      store: () => openIdbStore(name, factory),
      version: async () => {
        const req = factory.open(name)
        const db = (await wrap(req)) as IDBPDatabase
        const v = db.version
        db.close()
        return v
      },
    }
  },
  async SQLite(_name, dump) {
    const path = join(mkdtempSync(join(tmpdir(), 'splito-v1-')), 'db.sqlite')
    writeV1Sql(path, dump)
    return {
      path,
      store: () => openSqlStore(bunExecutor(path)),
      version: async () => {
        const db = new Database(path)
        const v = (db.query('PRAGMA user_version').get() as {user_version: number}).user_version
        db.close()
        return v
      },
    }
  },
}

describe.each(Object.keys(open))('%s v1 -> current', engine => {
  test('a small set with every kind of row survives exactly', async () => {
    const dump = await smallSet()
    const v1 = await open[engine]!('small', dump)
    const store = await v1.store()
    await expectSameAsV1(store, dump)
    await expectDerivedTablesMatch(store)
    expect(await v1.version()).toBe(SCHEMA_VERSION)
    await expectFeedbackKept(store, dump)
    // The deleted expense is still there, to be listed struck in its place.
    expect((await store.dump()).entities.some(e => e.type === 'expense' && e.deleted)).toBe(true)
    await store.close()
  })

  test('the large demo set: every row, history entry, op and balance identical', async () => {
    const v1 = await open[engine]!('large', largeWithDisputes)
    const t0 = performance.now()
    const store = await v1.store()
    const ms = performance.now() - t0
    console.log(`${engine} v1 -> v2 migration of ${large.entities.length} rows, ${large.history.length} history rows, ${large.outbox.length} ops: ${ms.toFixed(0)} ms`)
    await expectSameAsV1(store, largeWithDisputes)
    expect((await store.getAll('dispute')).length).toBeGreaterThan(8)
    expect((await store.disputedBalances()).length).toBeGreaterThan(0)
    // The sums the migration built equal the ones the mutations kept while the source set was written.
    expect(sorted(await store.balances())).toEqual(sorted(largeBalances))
    const people = large.entities.filter(e => e.type === 'person' && !e.deleted).map(e => e.id)
    expect((await store.balances()).length).toBeGreaterThan(100)
    expect(people.length).toBeGreaterThan(20)
    await store.close()
  }, 120_000)

  test('is idempotent: reopening changes nothing and runs no second migration', async () => {
    const dump = await smallSet()
    const v1 = await open[engine]!('idem', dump)
    const first = await v1.store()
    const after = await first.dump()
    await first.close()
    const second = await v1.store()
    expect(await second.dump()).toEqual(after)
    expect(await v1.version()).toBe(SCHEMA_VERSION)
    await second.close()
  })

  test('a new row written after migration lands in the new stores and moves the sums', async () => {
    const dump = await smallSet()
    const store = await (await open[engine]!('after', dump)).store()
    const ctx = makeCtx()
    const people = dump.entities.filter(e => e.type === 'person' && !(e.data as {isMe: boolean}).isMe)
    await createExpense(store, { ...ctx, newId: () => 'fresh-' + Math.random().toString(36).slice(2) }, {
      title: 'Later', groupId: null, currency: 'INR', total: 600n, payers: {me: 600n},
      split: {mode: 'equal', participants: ['me', people[0]!.id]}, date: '2026-11-01', tz: 'UTC', category: 'food', notes: '',
    })
    await expectProjectionsMatchLedger(store)
    await store.close()
  })
})

/* -------------------------------------------------------------------------- */
/* v2 -> v3                                                                    */
/* -------------------------------------------------------------------------- */

/** Rewrites a current (v3) IndexedDB database as the v2 layout that shipped before: no aggregates, no search terms, no people activity. */
async function downgradeIdb(from: IDBFactory, name: string, version: 2 | 3 | 4 = 2): Promise<IDBFactory> {
  const source = (await wrap(from.open(name))) as IDBPDatabase
  const to = new IDBFactory()
  const req = to.open(name, version)
  // v3 (and v2) had no `reminders`; v2 had neither projections nor the people activity column.
  const v5 = ['disputes', 'disputed_balances', 'disputed_pairs']
  const gone = version === 4 ? v5 : version === 3 ? ['reminders', ...v5] : ['aggregates', 'search_terms', 'reminders', ...v5]
  const kept = Object.keys(STORES).filter(n => !gone.includes(n)) as Array<keyof typeof STORES>
  req.onupgradeneeded = () => {
    for (const store of kept) {
      const spec = STORES[store] as {key: readonly string[]; auto?: boolean; indexes: Record<string, {columns: readonly string[]; unique?: boolean}>}
      const os = spec.auto ? req.result.createObjectStore(store, {keyPath: spec.key[0]!, autoIncrement: true}) : req.result.createObjectStore(store, {keyPath: [...spec.key]})
      for (const [ix, def] of Object.entries(spec.indexes)) if (version >= 3 || !(store === 'people' && ix === 'byActivity')) os.createIndex(ix, [...def.columns], {unique: !!def.unique})
    }
  }
  const target = (await wrap(req)) as IDBPDatabase
  const rows = new Map<string, Array<Record<string, unknown>>>()
  for (const store of kept) rows.set(store, (await source.getAll(store)) as Array<Record<string, unknown>>)
  const t = target.transaction(kept, 'readwrite')
  for (const store of kept)
    for (const row of rows.get(store)!) {
      const { lastActivityAt: _skip, ...v2 } = row
      void t.objectStore(store).put(store === 'people' && version === 2 ? v2 : row)
    }
  await t.done
  source.close()
  target.close()
  return to
}

/** The same for SQLite: drop what v3 added and stamp version 2. */
function downgradeSql(path: string) {
  const db = new Database(path)
  for (const t of ['disputes', 'disputed_balances', 'disputed_pairs']) db.run(`DROP TABLE ${t}`)
  db.run('DROP TABLE reminders')
  db.run('DROP TABLE aggregates')
  db.run('DROP TABLE search_terms')
  db.run('DROP INDEX ix_people_byActivity')
  db.run('ALTER TABLE people DROP COLUMN lastActivityAt')
  db.run("UPDATE meta SET value = '2' WHERE key = 'schemaVersion'")
  db.run('PRAGMA user_version = 2')
  db.close()
}

describe.each(['IndexedDB', 'SQLite'])('%s v2 -> v3', engine => {
  const fixtures: Array<[string, () => StoreDump]> = [['a small set', () => smallDump], ['the large demo set', () => large]]
  let smallDump: StoreDump
  beforeAll(async () => {
    smallDump = await smallSet()
  })

  test.each(fixtures)('%s: every row survives, and the new projections equal a fresh build', async (_name, dump) => {
    const set = dump()
    // The v3 reference: the v1 fixture migrated straight to the current layout.
    const handle = await open[engine]!('v2', set)
    const reference = await handle.store()
    const want = {aggregates: await storedAggregates(reference), terms: await storedTerms(reference), groups: [...(await reference.groupActivity())].sort(), people: [...(await reference.lastActivity())].sort()}
    expect(want.aggregates.length).toBeGreaterThan(0)
    expect(want.terms.length).toBeGreaterThan(0)
    await reference.close()

    let upgraded: Store
    if (engine === 'IndexedDB') {
      const name = 'v2'
      const factory = (handle as unknown as {factory: IDBFactory}).factory
      upgraded = await openIdbStore(name, await downgradeIdb(factory, name))
    } else {
      const path = (handle as unknown as {path: string}).path
      downgradeSql(path)
      upgraded = await openSqlStore(bunExecutor(path))
    }
    await expectSameAsV1(upgraded, set)
    await expectDerivedTablesMatch(upgraded)
    expect(await storedAggregates(upgraded)).toEqual(want.aggregates)
    expect(await storedTerms(upgraded)).toEqual(want.terms)
    if (set === smallDump) await expectFeedbackKept(upgraded, set)
    expect([...(await upgraded.groupActivity())].sort()).toEqual(want.groups)
    expect([...(await upgraded.lastActivity())].sort()).toEqual(want.people)
    // New writes keep every derived table exact.
    const me = set.entities.find(e => e.type === 'person' && (e.data as {isMe: boolean}).isMe)!.id
    const friend = set.entities.find(e => e.type === 'person' && !e.deleted && !(e.data as {isMe: boolean}).isMe)!.id
    const ctx = {...makeCtx(), actor: me, newId: () => 'later-' + Math.random().toString(36).slice(2)}
    await createExpense(upgraded, ctx, {
      title: 'After the upgrade', groupId: null, currency: 'INR', total: 600n, payers: {[me]: 600n}, split: {mode: 'equal', participants: [me, friend]}, date: '2026-11-01', tz: 'UTC', category: 'food', notes: '',
    })
    await expectDerivedTablesMatch(upgraded)
    await upgraded.close()
  }, 120_000)
})

/* -------------------------------------------------------------------------- */
/* v3 -> v4                                                                    */
/* -------------------------------------------------------------------------- */

/** The same for SQLite: drop the v4 table and stamp version 3. */
function downgradeSqlToV3(path: string) {
  const db = new Database(path)
  for (const t of ['disputes', 'disputed_balances', 'disputed_pairs']) db.run(`DROP TABLE ${t}`)
  db.run('DROP TABLE reminders')
  db.run("UPDATE meta SET value = '3' WHERE key = 'schemaVersion'")
  db.run('PRAGMA user_version = 3')
  db.close()
}

describe.each(['IndexedDB', 'SQLite'])('%s v3 -> v4 (the reminders store)', engine => {
  let smallDump: StoreDump
  beforeAll(async () => {
    smallDump = await smallSet()
  })
  const fixtures: Array<[string, () => StoreDump]> = [['a small set', () => smallDump], ['the large demo set', () => large]]

  /** A v3 database holding `dump`: the current layout of the v1 fixture, with v4's store removed. */
  async function v3Of(set: StoreDump) {
    const handle = await open[engine]!('v3', set)
    const current = await handle.store()
    const before = await current.dump()
    const balances = await current.balances()
    const aggregates = await storedAggregates(current)
    const terms = await storedTerms(current)
    await current.close()
    if (engine === 'IndexedDB') {
      const factory = (handle as unknown as {factory: IDBFactory}).factory
      const v3 = await downgradeIdb(factory, 'v3', 3)
      return {before, balances, aggregates, terms, reopen: () => openIdbStore('v3', v3), version: async () => { const db = (await wrap(v3.open('v3'))) as IDBPDatabase; const v = db.version; db.close(); return v }, factory: v3}
    }
    const path = (handle as unknown as {path: string}).path
    downgradeSqlToV3(path)
    return {
      before, balances, aggregates, terms, reopen: () => openSqlStore(bunExecutor(path)),
      version: async () => { const db = new Database(path); const v = (db.query('PRAGMA user_version').get() as {user_version: number}).user_version; db.close(); return v },
      factory: undefined,
    }
  }

  test.each(fixtures)('%s: every row, history entry, op and balance survives; the store starts empty and works', async (_name, dump) => {
    const v3 = await v3Of(dump())
    expect(await v3.version()).toBe(3)
    const store = await v3.reopen()
    expect(await store.dump()).toEqual(v3.before)
    expect(sorted(await store.balances())).toEqual(sorted(v3.balances))
    expect(await storedAggregates(store)).toEqual(v3.aggregates)
    expect(await storedTerms(store)).toEqual(v3.terms)
    await expectDerivedTablesMatch(store)
    expect(await store.getAll('reminder')).toEqual([])
    expect((await store.syncCounts()).reminders).toEqual({local: 0, pending: 0, syncing: 0, synced: 0, failed: 0})
    // New writes land in the new store and leave every other table exact.
    const me = v3.before.entities.find(e => e.type === 'person' && (e.data as {isMe: boolean}).isMe)!.id
    const friend = v3.before.entities.find(e => e.type === 'person' && !e.deleted && !(e.data as {isMe: boolean}).isMe)!.id
    const ctx = {...makeCtx(), actor: me, newId: () => 'later-' + Math.random().toString(36).slice(2)}
    const r = await scheduleReminder(store, ctx, {personId: friend, groupId: null, dueAt: Date.parse('2026-11-01T09:00:00Z'), repeat: 'weekly'})
    expect((await store.getAll('reminder')).map(e => e.id)).toEqual([r.id])
    expect((await store.page('reminder', {index: 'byDue', eq: ['self']})).items.map(e => e.id)).toEqual([r.id])
    await expectDerivedTablesMatch(store)
    await store.close()
    expect(await v3.version()).toBe(SCHEMA_VERSION)
    // Idempotent: a second open runs no step and keeps the reminder.
    const again = await v3.reopen()
    expect((await again.getAll('reminder')).map(e => e.id)).toEqual([r.id])
    await again.close()
  }, 120_000)
})

/* -------------------------------------------------------------------------- */
/* v4 -> v5                                                                    */
/* -------------------------------------------------------------------------- */

/** The same for SQLite: drop the v5 tables and stamp version 4. */
function downgradeSqlToV4(path: string) {
  const db = new Database(path)
  for (const t of ['disputes', 'disputed_balances', 'disputed_pairs']) db.run(`DROP TABLE ${t}`)
  db.run("UPDATE meta SET value = '4' WHERE key = 'schemaVersion'")
  db.run('PRAGMA user_version = 4')
  db.close()
}

describe.each(['IndexedDB', 'SQLite'])('%s v4 -> v5 (the disputes store)', engine => {
  let smallDump: StoreDump
  beforeAll(async () => {
    smallDump = await smallSet()
  })
  const fixtures: Array<[string, () => StoreDump]> = [['a small set', () => smallDump], ['the large demo set', () => large]]

  async function v4Of(set: StoreDump) {
    const handle = await open[engine]!('v4', set)
    const current = await handle.store()
    const before = await current.dump()
    const balances = await current.balances()
    await current.close()
    if (engine === 'IndexedDB') {
      const factory = (handle as unknown as {factory: IDBFactory}).factory
      const v4 = await downgradeIdb(factory, 'v4', 4)
      return {before, balances, reopen: () => openIdbStore('v4', v4), version: async () => { const db = (await wrap(v4.open('v4'))) as IDBPDatabase; const v = db.version; db.close(); return v }}
    }
    const path = (handle as unknown as {path: string}).path
    downgradeSqlToV4(path)
    return {
      before, balances, reopen: () => openSqlStore(bunExecutor(path)),
      version: async () => { const db = new Database(path); const v = (db.query('PRAGMA user_version').get() as {user_version: number}).user_version; db.close(); return v },
    }
  }

  test.each(fixtures)('%s: every row, history entry, op and balance survives; the disputes store starts empty and works', async (_name, dump) => {
    const v4 = await v4Of(dump())
    expect(await v4.version()).toBe(4)
    const store = await v4.reopen()
    expect(await store.dump()).toEqual(v4.before)
    expect(sorted(await store.balances())).toEqual(sorted(v4.balances))
    await expectDerivedTablesMatch(store)
    expect(await store.getAll('dispute')).toEqual([])
    expect(await store.disputedBalances()).toEqual([])
    expect(await store.disputedPairs('nobody')).toEqual([])
    expect((await store.syncCounts()).disputes).toEqual({local: 0, pending: 0, syncing: 0, synced: 0, failed: 0})
    // A dispute lands in the new store, marks its record's balances as disputed and moves nothing else.
    const me = v4.before.entities.find(e => e.type === 'person' && (e.data as {isMe: boolean}).isMe)!.id
    const expense = v4.before.entities.find(e => e.type === 'expense' && !e.deleted && Object.keys((e.data as {shares: object}).shares).includes(me))!
    const ctx = {...makeCtx(), actor: me, newId: () => 'later-' + Math.random().toString(36).slice(2)}
    const d = await raiseDispute(store, ctx, {targetType: 'expense', targetId: expense.id, reason: 'wrong_amount', note: 'check'})
    expect((await store.getAll('dispute')).map(e => e.id)).toEqual([d.id])
    expect((await store.disputedBalances({personId: me})).length).toBeGreaterThan(0)
    expect(sorted(await store.balances())).toEqual(sorted(v4.balances))
    await expectDerivedTablesMatch(store)
    await store.close()
    expect(await v4.version()).toBe(SCHEMA_VERSION)
    // Idempotent: a second open runs no step and keeps the dispute and its sums.
    const again = await v4.reopen()
    expect((await again.getAll('dispute')).map(e => e.id)).toEqual([d.id])
    expect((await again.disputedBalances({personId: me})).length).toBeGreaterThan(0)
    await again.close()
  }, 120_000)
})

describe('a migration that fails leaves v1 exactly as it was', () => {
  test('IndexedDB', async () => {
    const dump = await smallSet()
    const bad = structuredClone(dump)
    const factory = new IDBFactory()
    await writeV1Idb(factory, 'bad', bad)
    // Corrupt one row after writing: its data is not codec JSON.
    const req = factory.open('bad', 1)
    const raw = (await wrap(req)) as IDBPDatabase
    const person = bad.entities.find(e => e.type === 'person')!
    await raw.put('entities', {...v1Entity(person), data: '{not json'})
    raw.close()
    await expect(openIdbStore('bad', factory)).rejects.toThrow(/JSON|Expected|parse/i)
    const again = (await wrap(factory.open('bad', 1))) as IDBPDatabase
    expect(again.version).toBe(1)
    expect(await again.count('entities')).toBe(dump.entities.length)
    expect(await again.count('outbox')).toBe(dump.outbox.length)
    again.close()
  })

  test('SQLite', async () => {
    const dump = await smallSet()
    const path = join(mkdtempSync(join(tmpdir(), 'splito-bad-')), 'db.sqlite')
    writeV1Sql(path, dump)
    const raw = new Database(path)
    const person = dump.entities.find(e => e.type === 'person')!
    raw.query('UPDATE entities SET data = ? WHERE type = ? AND id = ?').run('{not json', person.type, person.id)
    raw.close()
    await expect(openSqlStore(bunExecutor(path))).rejects.toThrow()
    const check = new Database(path)
    expect((check.query('PRAGMA user_version').get() as {user_version: number}).user_version).toBe(0)
    expect((check.query('SELECT COUNT(*) AS n FROM entities').get() as {n: number}).n).toBe(dump.entities.length)
    expect((check.query('SELECT COUNT(*) AS n FROM outbox').get() as {n: number}).n).toBe(dump.outbox.length)
    check.close()
  })
})

describe('a v1 row of a type this build does not know aborts the upgrade (fail closed, like a corrupt row)', () => {
  const alien = {type: 'receipt', id: 'r1', data: {}, version: 1, deleted: false, createdAt: 1, updatedAt: 1, syncStatus: 'local', serverVersion: null, syncedAt: null, syncError: null} as unknown as StoreDump['entities'][number]

  test('IndexedDB', async () => {
    const dump = await smallSet()
    const factory = new IDBFactory()
    await writeV1Idb(factory, 'alien', {...dump, entities: [...dump.entities, alien]})
    await expect(openIdbStore('alien', factory)).rejects.toThrow(/receipt/)
    const again = (await wrap(factory.open('alien', 1))) as IDBPDatabase
    expect(again.version).toBe(1)
    expect(await again.count('entities')).toBe(dump.entities.length + 1)
    again.close()
  })

  test('SQLite', async () => {
    const dump = await smallSet()
    const path = join(mkdtempSync(join(tmpdir(), 'splito-alien-')), 'db.sqlite')
    writeV1Sql(path, dump)
    const raw = new Database(path)
    raw.query('INSERT INTO entities VALUES (?, ?, ?, ?, ?, ?)').run('receipt', 'r1', '{}', 1, 0, 1)
    raw.close()
    await expect(openSqlStore(bunExecutor(path))).rejects.toThrow(/receipt/)
    const check = new Database(path)
    expect((check.query('PRAGMA user_version').get() as {user_version: number}).user_version).toBe(0)
    expect((check.query('SELECT COUNT(*) AS n FROM entities').get() as {n: number}).n).toBe(dump.entities.length + 1)
    check.close()
  })
})

test('a SQLite file already in v2 shape but with a lost user_version is stamped, not re-migrated', async () => {
  const path = join(mkdtempSync(join(tmpdir(), 'splito-lost-')), 'db.sqlite')
  const exec: SqlExecutor = bunExecutor(path)
  const first = await openSqlStore(exec)
  const ctx = makeCtx()
  await ensureMe(first, ctx, 'Me')
  const before = await first.dump()
  await first.close()
  const raw = new Database(path)
  raw.run('PRAGMA user_version = 0')
  raw.close()
  const second = await openSqlStore(bunExecutor(path))
  expect(await second.dump()).toEqual(before)
  await second.close()
})

test('a v2-shaped SQLite file with a lost user_version is upgraded to v3, not stamped as it is', async () => {
  const path = join(mkdtempSync(join(tmpdir(), 'splito-lost2-')), 'db.sqlite')
  const first = await openSqlStore(bunExecutor(path))
  const ctx = makeCtx()
  await ensureMe(first, ctx, 'Me')
  const a = await createPerson(first, ctx, {name: 'Asha'})
  await createExpense(first, ctx, {
    title: 'Dinner', groupId: null, currency: 'INR', total: 600n, payers: {me: 600n},
    split: {mode: 'equal', participants: ['me', a.id]}, date: '2026-10-02', tz: 'UTC', category: 'food', notes: '',
  })
  const before = await first.dump()
  await first.close()
  downgradeSql(path)
  const raw = new Database(path)
  raw.run('PRAGMA user_version = 0')
  raw.close()
  const second = await openSqlStore(bunExecutor(path))
  expect((await second.dump()).entities).toEqual(before.entities)
  await expectDerivedTablesMatch(second)
  // The write that used to fail with "table people has no column named lastActivityAt".
  await createPerson(second, makeCtx(), {name: 'Bilal'})
  await createExpense(second, {...makeCtx(), newId: () => 'later-1'}, {
    title: 'Lunch', groupId: null, currency: 'INR', total: 300n, payers: {me: 300n},
    split: {mode: 'equal', participants: ['me', a.id]}, date: '2026-10-03', tz: 'UTC', category: 'food', notes: '',
  })
  await expectDerivedTablesMatch(second)
  await second.close()
  const check = new Database(path)
  expect((check.query('PRAGMA user_version').get() as {user_version: number}).user_version).toBe(SCHEMA_VERSION)
  check.close()
})

test('a v3-shaped SQLite file with a lost user_version still gets the reminders table', async () => {
  const path = join(mkdtempSync(join(tmpdir(), 'splito-lost3-')), 'db.sqlite')
  const first = await openSqlStore(bunExecutor(path))
  const ctx = makeCtx()
  await ensureMe(first, ctx, 'Me')
  const a = await createPerson(first, ctx, {name: 'Asha'})
  const before = await first.dump()
  await first.close()
  downgradeSqlToV3(path)
  const raw = new Database(path)
  raw.run('PRAGMA user_version = 0')
  raw.close()
  const second = await openSqlStore(bunExecutor(path))
  expect((await second.dump()).entities).toEqual(before.entities)
  await scheduleReminder(second, {...makeCtx(), newId: () => 'rem-1'}, {personId: a.id, groupId: null, dueAt: 1_800_000_000_000, repeat: 'none'})
  expect(await second.getAll('reminder')).toHaveLength(1)
  await second.close()
  const check = new Database(path)
  expect((check.query('PRAGMA user_version').get() as {user_version: number}).user_version).toBe(SCHEMA_VERSION)
  check.close()
})

test('a v3 SQLite file with a lost user_version (reminders table gone too) still gets the v4 rebuild', async () => {
  const path = join(mkdtempSync(join(tmpdir(), 'splito-v3-lost-')), 'db.sqlite')
  const first = await openSqlStore(bunExecutor(path))
  const ctx = makeCtx()
  await ensureMe(first, ctx, 'Me')
  const a = await createPerson(first, ctx, {name: 'Asha'})
  const e = await createExpense(first, ctx, {
    title: 'Dinner', groupId: null, currency: 'INR', total: 600n, payers: {me: 600n},
    split: {mode: 'equal', participants: ['me', a.id]}, date: '2026-10-02', tz: 'UTC', category: 'food', notes: '',
  })
  await deleteExpense(first, ctx, e.id)
  await first.close()
  downgradeSqlToV3(path)
  const raw = new Database(path)
  raw.run('DELETE FROM expense_parties')
  raw.run('PRAGMA user_version = 0')
  raw.close()
  const second = await openSqlStore(bunExecutor(path))
  const parties = await second.parties({index: 'byPersonDate', eq: [a.id], includeDeleted: true})
  expect(parties.items.map(p => [p.expenseId, p.deleted])).toEqual([[e.id, true]])
  expect(await second.getAll('reminder')).toEqual([])
  await expectDerivedTablesMatch(second)
  await second.close()
})

test('a v3 SQLite file upgrades to v4: reminders table, deleted expenses get their party rows and search terms back, history.binDays goes', async () => {
  const path = join(mkdtempSync(join(tmpdir(), 'splito-v3-')), 'db.sqlite')
  const first = await openSqlStore(bunExecutor(path))
  const ctx = makeCtx()
  await ensureMe(first, ctx, 'Me')
  const a = await createPerson(first, ctx, {name: 'Asha'})
  const e = await createExpense(first, ctx, {
    title: 'Dinner', groupId: null, currency: 'INR', total: 600n, payers: {me: 600n},
    split: {mode: 'equal', participants: ['me', a.id]}, date: '2026-10-02', tz: 'UTC', category: 'food', notes: '',
  })
  await deleteExpense(first, ctx, e.id)
  await first.transaction(tx => tx.put({type: 'preference', id: 'history.binDays', data: {value: 7}, version: 1, deleted: false, updatedAt: 1}))
  await first.close()
  // What a v3 build left: no reminders table, no rows for the deleted expense, and the old preference.
  downgradeSqlToV3(path)
  const raw = new Database(path)
  raw.run('DELETE FROM expense_parties')
  raw.run("DELETE FROM search_terms WHERE entityType = 'expense'")
  raw.close()
  const second = await openSqlStore(bunExecutor(path))
  expect(await second.get('preference', 'history.binDays')).toBeUndefined()
  expect(await second.getAll('reminder')).toEqual([])
  const parties = await second.parties({index: 'byPersonDate', eq: [a.id], includeDeleted: true})
  expect(parties.items.map(p => [p.expenseId, p.deleted])).toEqual([[e.id, true]])
  expect((await second.parties({index: 'byPersonDate', eq: [a.id]})).items).toEqual([])
  expect((await storedTerms(second)).some(t => t.includes(e.id))).toBe(true)
  await expectDerivedTablesMatch(second)
  await second.close()
})

test('a v2 SQLite file upgrades straight to v4: one migration holds the reminders table and the B3x rebuild', async () => {
  const path = join(mkdtempSync(join(tmpdir(), 'splito-v2-v4-')), 'db.sqlite')
  const first = await openSqlStore(bunExecutor(path))
  const ctx = makeCtx()
  await ensureMe(first, ctx, 'Me')
  const a = await createPerson(first, ctx, {name: 'Asha'})
  const e = await createExpense(first, ctx, {
    title: 'Dinner', groupId: null, currency: 'INR', total: 600n, payers: {me: 600n},
    split: {mode: 'equal', participants: ['me', a.id]}, date: '2026-10-02', tz: 'UTC', category: 'food', notes: '',
  })
  await deleteExpense(first, ctx, e.id)
  await first.transaction(tx => tx.put({type: 'preference', id: 'history.binDays', data: {value: 7}, version: 1, deleted: false, updatedAt: 1}))
  await first.close()
  downgradeSql(path)
  const second = await openSqlStore(bunExecutor(path))
  expect(await second.get('preference', 'history.binDays')).toBeUndefined()
  const parties = await second.parties({index: 'byPersonDate', eq: [a.id], includeDeleted: true})
  expect(parties.items.map(p => [p.expenseId, p.deleted])).toEqual([[e.id, true]])
  await scheduleReminder(second, {...makeCtx(), newId: () => 'rem-2'}, {personId: a.id, groupId: null, dueAt: 1_800_000_000_000, repeat: 'none'})
  expect(await second.getAll('reminder')).toHaveLength(1)
  await expectDerivedTablesMatch(second)
  await second.close()
  const check = new Database(path)
  expect((check.query('PRAGMA user_version').get() as {user_version: number}).user_version).toBe(SCHEMA_VERSION)
  check.close()
})

describe.each([2, 3] as const)('IndexedDB v%i -> v4 in one upgrade', from => {
  test('history.binDays goes, a deleted expense keeps its party rows, the reminders store works', async () => {
    const factory = new IDBFactory()
    const first = await openIdbStore('combo', factory)
    const ctx = makeCtx()
    await ensureMe(first, ctx, 'Me')
    const a = await createPerson(first, ctx, {name: 'Asha'})
    const e = await createExpense(first, ctx, {
      title: 'Dinner', groupId: null, currency: 'INR', total: 600n, payers: {me: 600n},
      split: {mode: 'equal', participants: ['me', a.id]}, date: '2026-10-02', tz: 'UTC', category: 'food', notes: '',
    })
    await deleteExpense(first, ctx, e.id)
    await first.transaction(tx => tx.put({type: 'preference', id: 'history.binDays', data: {value: 7}, version: 1, deleted: false, updatedAt: 1}))
    await first.close()
    const old = await downgradeIdb(factory, 'combo', from)
    // What an old build left: no party rows for the deleted expense.
    const raw = (await wrap(old.open('combo'))) as IDBPDatabase
    await raw.clear('expense_parties')
    raw.close()
    const second = await openIdbStore('combo', old)
    expect(await second.get('preference', 'history.binDays')).toBeUndefined()
    const parties = await second.parties({index: 'byPersonDate', eq: [a.id], includeDeleted: true})
    expect(parties.items.map(p => [p.expenseId, p.deleted])).toEqual([[e.id, true]])
    await scheduleReminder(second, {...makeCtx(), newId: () => 'rem-3'}, {personId: a.id, groupId: null, dueAt: 1_800_000_000_000, repeat: 'none'})
    expect(await second.getAll('reminder')).toHaveLength(1)
    await expectDerivedTablesMatch(second)
    await second.close()
  })
})
