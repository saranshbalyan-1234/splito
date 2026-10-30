/**
 * Local database migrations (ARCHITECTURE 9.8). `meta.schemaVersion` names the
 * layout a database is in; each engine runs the ordered steps it is behind
 * (IndexedDB `onupgradeneeded`, SQLite `PRAGMA user_version`), each step
 * inside one transaction and skipped once done. The row logic is here and
 * shared; an engine only reads its own v1 layout into `LegacyV1` and hands
 * over a `RowAccess` on the new layout.
 *
 * Steps: v1 -> v2 (per-type stores, members, parties, balances),
 * v2 -> v3 (the `aggregates` and `search_terms` projections and the people
 * activity column), v3 -> v4 (the empty `reminders` store, a deleted
 * expense keeps its party rows and search terms, the `history.binDays`
 * preference goes) and v4 -> v5 (the empty `disputes` store and the disputed
 * projections): the projections are all derived, so `migrateToV4` rebuilds
 * them from the rows and serves a v2 and a v3 file alike (it also builds the
 * v5 ones), `migrateToV5` serves a v4 file, and both are idempotent. A v1
 * database goes straight to the current layout.
 */
import {decode} from './codec'
import {type RowAccess} from './engine'
import {rebuildDisputedProjections, rebuildProjections, SEARCH_INDEX_VERSION} from './ledgerProjection'
import {completeEntity, ENTITY_STORE, entityOfRow, historyRow, outboxRow, rowOfEntity, SCHEMA_VERSION} from './schema'
import {type Entity, type EntityType, type HistoryRow, type OutboxOp} from './types'

/** Version 1: one `entities` store for every type, keyed `[type, id]`, plus `history` and `outbox`. */
export interface LegacyV1 {
  entities: Array<{type: EntityType; id: string; data: string; version: number; deleted: boolean | number; updatedAt: number}>
  history: Array<{entityType: EntityType; entityId: string; version: number; data: string; deleted: boolean | number; at: number; actor: string}>
  outbox: Array<Omit<OutboxOp, 'payload' | 'status'> & {payload: string}>
}

/**
 * v1 -> current: copies every row into its per-type store and keeps history and
 * outbox ops (same `seq`), builds members, parties, balances and the other
 * projections, and stamps `meta.schemaVersion`. A row with an op waiting is `pending`; every other
 * v1 row was never queued, so it is `local`. Nothing is dropped or changed:
 * the migration test compares every row before and after.
 */
export async function migrateFromV1(legacy: LegacyV1, rows: RowAccess): Promise<void> {
  const queued = new Set(legacy.outbox.map(o => `${o.entityType}:${o.entityId}`))
  const born = new Map<string, number>()
  for (const h of legacy.history) {
    const key = `${h.entityType}:${h.entityId}`
    born.set(key, Math.min(born.get(key) ?? Infinity, h.at))
  }
  const byType = new Map<EntityType, Entity[]>()
  for (const l of legacy.entities) {
    // Dropping `entities` afterwards would lose the row for good: abort and leave v1 intact.
    if (!(l.type in ENTITY_STORE)) throw new Error(`cannot migrate: unknown entity type "${l.type}" (${l.id})`)
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

/**
 * v2 or v3 -> v4: the stores and columns exist (the engine made them, empty); everything derived is rebuilt from the
 * rows, so it is idempotent and loses nothing. v4 keeps a deleted expense's party rows and search terms (decision
 * 103) and drops the stored `history.binDays` preference (the Recently deleted bin is gone; the preference's history
 * and ops stay in the audit trail). The `reminders` store starts empty: nothing derives from it.
 */
export async function migrateToV4(rows: RowAccess): Promise<void> {
  await rows.delete(ENTITY_STORE.preference, ['history.binDays'])
  await rebuildProjections(rows, async type => (await rows.range(ENTITY_STORE[type], {})).map(r => entityOfRow(type, r)))
  await rows.put('meta', {key: 'schemaVersion', value: String(SCHEMA_VERSION)})
}

/**
 * v4 -> v5: the `disputes`, `disputed_balances` and `disputed_pairs` stores exist (the engine made them, empty). No
 * dispute can exist in a v4 file, so the projections are rebuilt from the rows anyway (idempotent, and a stray
 * dispute row from a newer build is counted); nothing else changes.
 */
export async function migrateToV5(rows: RowAccess): Promise<void> {
  await rebuildDisputedProjections(rows, async type => (await rows.range(ENTITY_STORE[type], {})).map(r => entityOfRow(type, r)))
  await rows.put('meta', {key: 'schemaVersion', value: String(SCHEMA_VERSION)})
}

/** A freshly created database starts at the current version. */
export const stampSchemaVersion = async (rows: RowAccess) => {
  await rows.put('meta', {key: 'schemaVersion', value: String(SCHEMA_VERSION)})
  await rows.put('meta', {key: 'searchIndex', value: SEARCH_INDEX_VERSION})
}
