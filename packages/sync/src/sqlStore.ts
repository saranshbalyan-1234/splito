import {decode, encode} from './codec'
import type {Store, Tx} from './store'
import type {Entity, EntityType, HistoryRow, OutboxOp} from './types'

/** Minimal async SQLite surface; expo-sqlite on device, bun:sqlite in tests. */
export interface SqlExecutor {
  exec(sql: string): Promise<void>
  run(sql: string, params: unknown[]): Promise<void>
  all<R>(sql: string, params: unknown[]): Promise<R[]>
  withTransaction<T>(fn: () => Promise<T>): Promise<T>
  close(): Promise<void>
}

export const MIGRATIONS: string[] = [
  `CREATE TABLE entities (type TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, version INTEGER NOT NULL,
     deleted INTEGER NOT NULL, updated_at INTEGER NOT NULL, PRIMARY KEY (type, id));
   CREATE TABLE history (entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, version INTEGER NOT NULL, data TEXT NOT NULL,
     deleted INTEGER NOT NULL, at INTEGER NOT NULL, actor TEXT NOT NULL, PRIMARY KEY (entity_type, entity_id, version));
   CREATE TABLE outbox (seq INTEGER PRIMARY KEY AUTOINCREMENT, op_id TEXT NOT NULL UNIQUE, device_id TEXT NOT NULL,
     actor TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, op_type TEXT NOT NULL,
     base_version INTEGER NOT NULL, payload TEXT NOT NULL, schema_version INTEGER NOT NULL, deps TEXT NOT NULL,
     attempts INTEGER NOT NULL, next_attempt_at INTEGER, last_error TEXT);`,
]

type EntityRow = {type: EntityType; id: string; data: string; version: number; deleted: number; updated_at: number}
type HistoryDbRow = {entity_type: EntityType; entity_id: string; version: number; data: string; deleted: number; at: number; actor: string}
type OutboxRow = {
  seq: number
  op_id: string
  device_id: string
  actor: string
  entity_type: EntityType
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

const toEntity = (r: EntityRow): Entity => ({
  type: r.type,
  id: r.id,
  data: decode(r.data),
  version: r.version,
  deleted: !!r.deleted,
  updatedAt: r.updated_at,
})

export async function openSqlStore(db: SqlExecutor): Promise<Store> {
  await db.exec('CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)')
  const [row] = await db.all<{value: string}>("SELECT value FROM meta WHERE key = 'schema_version'", [])
  for (let v = Number(row?.value ?? 0); v < MIGRATIONS.length; v++) {
    await db.withTransaction(async () => {
      await db.exec(MIGRATIONS[v]!)
      await db.run("INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', ?)", [String(v + 1)])
    })
  }

  const listeners = new Set<() => void>()
  const tx: Tx = {
    async get<T>(type: EntityType, id: string) {
      const [r] = await db.all<EntityRow>('SELECT * FROM entities WHERE type = ? AND id = ?', [type, id])
      return r ? (toEntity(r) as Entity<T>) : undefined
    },
    async put(e) {
      await db.run('INSERT OR REPLACE INTO entities (type, id, data, version, deleted, updated_at) VALUES (?, ?, ?, ?, ?, ?)', [
        e.type,
        e.id,
        encode(e.data),
        e.version,
        e.deleted ? 1 : 0,
        e.updatedAt,
      ])
    },
    async appendHistory(h) {
      await db.run('INSERT INTO history (entity_type, entity_id, version, data, deleted, at, actor) VALUES (?, ?, ?, ?, ?, ?, ?)', [
        h.entityType,
        h.entityId,
        h.version,
        encode(h.data),
        h.deleted ? 1 : 0,
        h.at,
        h.actor,
      ])
    },
    async enqueue(o) {
      await db.run(
        `INSERT INTO outbox (op_id, device_id, actor, entity_type, entity_id, op_type, base_version, payload, schema_version,
           deps, attempts, next_attempt_at, last_error) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [o.opId, o.deviceId, o.actor, o.entityType, o.entityId, o.opType, o.baseVersion, encode(o.payload), o.schemaVersion,
          JSON.stringify(o.deps), o.attempts, o.nextAttemptAt, o.lastError],
      )
    },
  }

  return {
    async transaction(fn) {
      const result = await db.withTransaction(() => fn(tx))
      listeners.forEach(l => l())
      return result
    },
    async getAll<T>(type: EntityType) {
      const rows = await db.all<EntityRow>('SELECT * FROM entities WHERE type = ? ORDER BY id', [type])
      return rows.map(toEntity) as Entity<T>[]
    },
    async history(type, id) {
      const rows = await db.all<HistoryDbRow>('SELECT * FROM history WHERE entity_type = ? AND entity_id = ? ORDER BY version', [type, id])
      return rows.map(
        (r): HistoryRow => ({entityType: r.entity_type, entityId: r.entity_id, version: r.version, data: decode(r.data), deleted: !!r.deleted, at: r.at, actor: r.actor}),
      )
    },
    async outbox() {
      const rows = await db.all<OutboxRow>('SELECT * FROM outbox ORDER BY seq', [])
      return rows.map(
        (r): OutboxOp => ({
          seq: r.seq,
          opId: r.op_id,
          deviceId: r.device_id,
          actor: r.actor,
          entityType: r.entity_type,
          entityId: r.entity_id,
          opType: r.op_type,
          baseVersion: r.base_version,
          payload: decode(r.payload),
          schemaVersion: r.schema_version,
          deps: JSON.parse(r.deps),
          attempts: r.attempts,
          nextAttemptAt: r.next_attempt_at,
          lastError: r.last_error,
        }),
      )
    },
    subscribe(fn) {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    close: () => db.close(),
  }
}
