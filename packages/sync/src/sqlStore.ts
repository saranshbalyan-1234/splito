import {createStore} from './core'
import {type Engine, type RangeQuery, type RowAccess} from './engine'
import {type LegacyV1, migrateFromV1, migrateToV4, migrateToV5, stampSchemaVersion} from './migrate'
import {type ColumnType, indexColumns, type Row, SCHEMA_VERSION, STORES, type StoreName, type StoreSpec} from './schema'
import {type Store} from './store'

/** Minimal async SQLite surface; expo-sqlite on device, bun:sqlite in tests. */
export interface SqlExecutor {
  exec(sql: string): Promise<void>
  run(sql: string, params: unknown[]): Promise<void>
  all<R>(sql: string, params: unknown[]): Promise<R[]>
  withTransaction<T>(fn: () => Promise<T>): Promise<T>
  close(): Promise<void>
}

const STORE_NAMES = Object.keys(STORES) as StoreName[]
const q = (name: string) => `"${name}"`
const SQL_TYPE: Record<ColumnType, string> = {text: 'TEXT NOT NULL', int: 'INTEGER NOT NULL', 'text?': 'TEXT', 'int?': 'INTEGER'}
const spec = (store: StoreName) => STORES[store] as StoreSpec

/** CREATE statements for every table and index (same names, columns, keys and indexes as IndexedDB). */
export function schemaSql(): string[] {
  const out: string[] = []
  for (const name of STORE_NAMES) {
    const s = spec(name)
    const columns = Object.entries(s.columns).map(([c, t]) => (s.auto && c === s.key[0] ? `${q(c)} INTEGER PRIMARY KEY AUTOINCREMENT` : `${q(c)} ${SQL_TYPE[t]}`))
    const key = s.auto ? '' : `, PRIMARY KEY (${s.key.map(q).join(', ')})`
    out.push(`CREATE TABLE IF NOT EXISTS ${q(name)} (${columns.join(', ')}${key})`)
    for (const [index, def] of Object.entries(s.indexes))
      out.push(`CREATE ${def.unique ? 'UNIQUE ' : ''}INDEX IF NOT EXISTS ${q(`ix_${name}_${index}`)} ON ${q(name)} (${def.columns.map(q).join(', ')})`)
  }
  return out
}

/** `WHERE` and `ORDER BY` for a range query: the same rows, in the same order, as the IndexedDB range. */
function rangeSql(store: StoreName, query: RangeQuery) {
  const cols = indexColumns(store, query.index)
  const eq = query.eq ?? []
  const where: string[] = []
  const params: unknown[] = []
  for (const [i, v] of eq.entries()) {
    where.push(`${q(cols[i]!)} = ?`)
    params.push(v)
  }
  if (query.min !== undefined) {
    where.push(`${q(cols[eq.length]!)} >= ?`)
    params.push(query.min)
  }
  if (query.max !== undefined) {
    where.push(`${q(cols[eq.length]!)} <= ?`)
    params.push(query.max)
  }
  const dir = query.dir ?? 'next'
  if (query.after) {
    where.push(`(${cols.map(q).join(', ')}) ${dir === 'next' ? '>' : '<'} (${cols.map(() => '?').join(', ')})`)
    params.push(...query.after)
  }
  const order = cols.map(c => `${q(c)} ${dir === 'next' ? 'ASC' : 'DESC'}`).join(', ')
  return {where: where.length ? ` WHERE ${where.join(' AND ')}` : '', order, params}
}

function sqlRows(db: SqlExecutor): RowAccess {
  const columnsOf = (store: StoreName) => Object.keys(spec(store).columns)
  const keyWhere = (store: StoreName) => spec(store).key.map(k => `${q(k)} = ?`).join(' AND ')
  const insert = (verb: string) => async (store: StoreName, row: Row) => {
    const cols = columnsOf(store).filter(c => row[c] !== undefined)
    await db.run(`${verb} INTO ${q(store)} (${cols.map(q).join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`, cols.map(c => row[c]))
  }
  return {
    async get(store, key) {
      const [r] = await db.all<Row>(`SELECT * FROM ${q(store)} WHERE ${keyWhere(store)}`, key)
      return r
    },
    put: insert('INSERT OR REPLACE'),
    add: insert('INSERT'),
    async delete(store, key) {
      await db.run(`DELETE FROM ${q(store)} WHERE ${keyWhere(store)}`, key)
    },
    async clear(store) {
      await db.run(`DELETE FROM ${q(store)}`, [])
    },
    async range(store, query) {
      const {where, order, params} = rangeSql(store, query)
      const limit = query.limit === undefined ? '' : ' LIMIT ?'
      return db.all<Row>(`SELECT * FROM ${q(store)}${where} ORDER BY ${order}${limit}`, query.limit === undefined ? params : [...params, query.limit])
    },
    async count(store, query) {
      const {where, params} = rangeSql(store, query)
      const [r] = await db.all<{n: number}>(`SELECT COUNT(*) AS n FROM ${q(store)}${where}`, params)
      return r?.n ?? 0
    },
  }
}

type V1Entity = {type: LegacyV1['entities'][number]['type']; id: string; data: string; version: number; deleted: number; updated_at: number}
type V1History = {entity_type: LegacyV1['history'][number]['entityType']; entity_id: string; version: number; data: string; deleted: number; at: number; actor: string}
type V1Outbox = {
  seq: number
  op_id: string
  device_id: string
  actor: string
  entity_type: LegacyV1['entities'][number]['type']
  entity_id: string
  op_type: string
  base_version: number
  payload: string
  schema_version: 1
  deps: string
  attempts: number
  next_attempt_at: number | null
  last_error: string | null
}

/** Version 1's tables, read into the shared legacy shape. */
async function readV1(db: SqlExecutor): Promise<LegacyV1> {
  const entities = await db.all<V1Entity>('SELECT * FROM entities ORDER BY type, id', [])
  const history = await db.all<V1History>('SELECT * FROM history ORDER BY entity_type, entity_id, version', [])
  const outbox = await db.all<V1Outbox>('SELECT * FROM outbox ORDER BY seq', [])
  return {
    entities: entities.map(r => ({type: r.type, id: r.id, data: r.data, version: r.version, deleted: r.deleted, updatedAt: r.updated_at})),
    history: history.map(r => ({entityType: r.entity_type, entityId: r.entity_id, version: r.version, data: r.data, deleted: r.deleted, at: r.at, actor: r.actor})),
    outbox: outbox.map(r => ({
      seq: r.seq,
      opId: r.op_id,
      deviceId: r.device_id,
      actor: r.actor,
      entityType: r.entity_type,
      entityId: r.entity_id,
      opType: r.op_type,
      baseVersion: r.base_version,
      payload: r.payload,
      schemaVersion: r.schema_version,
      deps: JSON.parse(r.deps),
      attempts: r.attempts,
      nextAttemptAt: r.next_attempt_at,
      lastError: r.last_error,
    })),
  }
}

/**
 * Brings the database to the current layout, once: a fresh file gets the
 * tables; a v2 or v3 file gets the missing tables and the v4 rebuild, a v4 file the dispute tables; a v1 file (`PRAGMA user_version` 0 with an `entities` table) is
 * read whole, its tables replaced and every row written back in the new
 * layout, all inside one transaction that also sets `user_version`, so a
 * crash leaves v1 untouched and a finished migration is never run again.
 */
async function migrate(db: SqlExecutor) {
  const [{user_version: stored = 0} = {}] = await db.all<{user_version: number}>('PRAGMA user_version', [])
  if (stored >= SCHEMA_VERSION) return
  let version = stored
  const [v1] = await db.all<{name: string}>("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'entities'", [])
  if (version === 0 && !v1) {
    // A lost `user_version` (0) on a file that is already per-type: read the layout, not the number. A `people`
    // table without the v3 column is v2, whatever it says; the fresh path would index the missing column as a literal.
    const people = await db.all<{name: string}>('PRAGMA table_info(people)', [])
    if (people.length > 0 && !people.some(c => c.name === 'lastActivityAt')) version = 2
    // A v3 file (the column exists) with a lost number: `meta.schemaVersion` still says 3, and v4 needs its rebuild.
    else if (people.length > 0) {
      const meta = await db.all<{value: string}>("SELECT value FROM meta WHERE key = 'schemaVersion'", []).catch(() => [])
      if (meta[0]?.value === '3') version = 3
      else if (meta[0]?.value === '4') version = 4
    }
  }
  await db.withTransaction(async () => {
    // v2 or v3 -> v4: the older tables are kept (their indexes already exist). A v2 file gets the v3 column before its
    // index; the new `aggregates`, `search_terms` and `reminders` tables are created (IF NOT EXISTS); one rebuild
    // (deleted expenses keep parties and search terms; history.binDays goes) serves both.
    if (version === 2 || version === 3) {
      if (version === 2) await db.exec('ALTER TABLE "people" ADD COLUMN "lastActivityAt" INTEGER NOT NULL DEFAULT 0')
      for (const sql of schemaSql()) await db.exec(sql)
      await migrateToV4(sqlRows(db))
      await db.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`)
      return
    }
    // v4 -> v5: the dispute tables (IF NOT EXISTS) and their empty projections.
    if (version === 4) {
      for (const sql of schemaSql()) await db.exec(sql)
      await migrateToV5(sqlRows(db))
      await db.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`)
      return
    }
    const legacy = v1 ? await readV1(db) : undefined
    if (v1) for (const old of ['entities', 'history', 'outbox']) await db.exec(`DROP TABLE IF EXISTS ${old}`)
    // v1 kept its version in a `meta` row of another name; the table is the same shape, so it stays.
    for (const sql of schemaSql()) await db.exec(sql)
    const rows = sqlRows(db)
    if (legacy) {
      await db.run("DELETE FROM meta WHERE key = 'schema_version'", [])
      await migrateFromV1(legacy, rows)
    } else await stampSchemaVersion(rows)
    await db.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`)
  })
}

export async function openSqlStore(db: SqlExecutor): Promise<Store> {
  await migrate(db)

  /*
   * One connection, one transaction at a time: expo-sqlite's
   * withTransactionAsync is a plain BEGIN/COMMIT, so a second BEGIN while
   * one is open fails and its ROLLBACK undoes the first. Transactions and
   * top-level reads queue here; reads then never see uncommitted writes.
   * Calls on `RowAccess` inside a transaction run directly (queueing them
   * would deadlock).
   */
  let queue: Promise<unknown> = Promise.resolve()
  const serial = <T>(fn: () => Promise<T>): Promise<T> => {
    const next = queue.then(fn)
    queue = next.catch(() => undefined)
    return next
  }
  const rows = sqlRows(db)

  const engine: Engine = {
    run: (mode, fn) => serial(() => (mode === 'rw' ? db.withTransaction(() => fn(rows)) : fn(rows))),
    close: () => serial(() => db.close()),
  }
  return createStore(engine)
}
