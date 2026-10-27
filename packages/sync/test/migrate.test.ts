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
import {applyDemoOp, generateLargeDemo, insideTransaction} from '../src/demoLarge'
import {openIdbStore} from '../src/idbStore'
import {
  createExpense,
  createGroup,
  createPerson,
  createRepayment,
  createWriteOffs,
  deleteExpense,
  ensureMe,
  purgeDeleted,
} from '../src/mutations'
import {setPref} from '../src/preferences'
import {createInviteLink, sendFriendRequest} from '../src/friends'
import {SCHEMA_VERSION} from '../src/schema'
import {openSqlStore, type SqlExecutor} from '../src/sqlStore'
import {type Store, type StoreDump} from '../src/store'
import {bunExecutor} from './bunExecutor'
import {expectProjectionsMatchLedger} from './projectionCheck'
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
  await purgeDeleted(s, ctx, 'expense', gone.id)
  await createRepayment(s, ctx, {groupId: null, currency: 'EUR', from: 'me', to: a.id, amount: 10n, date: '2026-10-04', tz: 'UTC', note: ''})
  await createWriteOffs(s, ctx, [{groupId: g.id, currency: 'INR', from: b.id, to: 'me', amount: 100n, date: '2026-10-05', tz: 'UTC', note: ''}])
  await setPref(s, ctx, 'defaultCurrency', 'EUR') // account scope: queued
  await setPref(s, ctx, 'analyticsScope', {nonGroup: true, groups: []}) // device scope: never queued
  await sendFriendRequest(s, ctx, {contact: {kind: 'email', value: 'zed@example.com'}, name: 'Zed', reach: 'unchecked'})
  await createInviteLink(s, ctx, {kind: 'group', groupId: g.id, maxUses: 5, expiresInMs: 86_400_000, approveJoins: false})
  expect(e.version).toBe(1)
  const dump = await s.dump()
  await s.close()
  return dump
}

let large: StoreDump
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
      for (const op of ops.slice(i, i + 150)) await applyDemoOp(batched, ctx, op)
    })
  large = await s.dump()
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

const open: Record<string, (name: string, dump: StoreDump) => Promise<{store: () => Promise<Store>; version: () => Promise<number>}>> = {
  async IndexedDB(name, dump) {
    const factory = new IDBFactory()
    await writeV1Idb(factory, name, dump)
    return {
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

describe.each(Object.keys(open))('%s v1 -> v2', engine => {
  test('a small set with every kind of row survives exactly', async () => {
    const dump = await smallSet()
    const v1 = await open[engine]!('small', dump)
    const store = await v1.store()
    await expectSameAsV1(store, dump)
    expect(await v1.version()).toBe(SCHEMA_VERSION)
    // The tombstone that was purged is still in the audit trail.
    const purged = (await store.dump()).entities.find(e => e.type === 'expense' && e.deleted)
    expect((purged?.data as {purgedAt?: number}).purgedAt).toBeGreaterThan(0)
    await store.close()
  })

  test('the large demo set: every row, history entry, op and balance identical', async () => {
    const v1 = await open[engine]!('large', large)
    const t0 = performance.now()
    const store = await v1.store()
    const ms = performance.now() - t0
    console.log(`${engine} v1 -> v2 migration of ${large.entities.length} rows, ${large.history.length} history rows, ${large.outbox.length} ops: ${ms.toFixed(0)} ms`)
    await expectSameAsV1(store, large)
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
