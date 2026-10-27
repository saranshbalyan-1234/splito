/**
 * Local database migrations (ARCHITECTURE 9.8). `meta.schemaVersion` names the
 * layout a database is in; each engine runs the ordered steps it is behind
 * (IndexedDB `onupgradeneeded`, SQLite `PRAGMA user_version`), each step
 * inside one transaction and skipped once done. The row logic is here and
 * shared; an engine only reads its own v1 layout into `LegacyV1` and hands
 * over a `RowAccess` on the new layout.
 */
import {decode} from './codec'
import {type RowAccess} from './engine'
import {rebuildProjections} from './ledgerProjection'
import {completeEntity, ENTITY_STORE, historyRow, outboxRow, rowOfEntity, SCHEMA_VERSION} from './schema'
import {type Entity, type EntityType, type HistoryRow, type OutboxOp} from './types'

/** Version 1: one `entities` store for every type, keyed `[type, id]`, plus `history` and `outbox`. */
export interface LegacyV1 {
  entities: Array<{type: EntityType; id: string; data: string; version: number; deleted: boolean | number; updatedAt: number}>
  history: Array<{entityType: EntityType; entityId: string; version: number; data: string; deleted: boolean | number; at: number; actor: string}>
  outbox: Array<Omit<OutboxOp, 'payload' | 'status'> & {payload: string}>
}

/**
 * v1 -> v2: copies every row into its per-type store and keeps history and
 * outbox ops (same `seq`), builds members, parties and balances, and stamps
 * `meta.schemaVersion`. A row with an op waiting is `pending`; every other
 * v1 row was never queued, so it is `local`. Nothing is dropped or changed:
 * the migration test compares every row before and after.
 */
export async function migrateV1ToV2(legacy: LegacyV1, rows: RowAccess): Promise<void> {
  const queued = new Set(legacy.outbox.map(o => `${o.entityType}:${o.entityId}`))
  const born = new Map<string, number>()
  for (const h of legacy.history) {
    const key = `${h.entityType}:${h.entityId}`
    born.set(key, Math.min(born.get(key) ?? Infinity, h.at))
  }
  const byType = new Map<EntityType, Entity[]>()
  for (const l of legacy.entities) {
    if (!(l.type in ENTITY_STORE)) continue
    const key = `${l.type}:${l.id}`
    const entity = completeEntity(
      {
        type: l.type,
        id: l.id,
        data: decode(l.data),
        version: l.version,
        deleted: !!l.deleted,
        updatedAt: l.updatedAt,
        createdAt: Math.min(born.get(key) ?? l.updatedAt, l.updatedAt),
        syncStatus: queued.has(key) ? 'pending' : 'local',
      },
      undefined,
    )
    await rows.put(ENTITY_STORE[l.type], rowOfEntity(entity))
    const list = byType.get(l.type) ?? []
    list.push(entity)
    byType.set(l.type, list)
  }
  for (const h of legacy.history) await rows.put('history', historyRow({...h, data: decode(h.data), deleted: !!h.deleted} as HistoryRow))
  for (const o of legacy.outbox) await rows.put('outbox', outboxRow({...o, payload: decode(o.payload), status: 'queued'} as OutboxOp))
  await rebuildProjections(rows, async type => byType.get(type) ?? [])
  await rows.put('meta', {key: 'schemaVersion', value: String(SCHEMA_VERSION)})
}

/** A freshly created database starts at the current version. */
export const stampSchemaVersion = (rows: RowAccess) => rows.put('meta', {key: 'schemaVersion', value: String(SCHEMA_VERSION)})
