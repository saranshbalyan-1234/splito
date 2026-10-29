import type {
  EntityType,
  OpAck,
  PullResponse,
  ServerEntity,
  SnapshotResponse,
  SyncOp,
} from '@splito/contracts'
import type {SQL} from 'bun'

import {ApiError} from './errors'

type EntityRow = {
  type: EntityType
  id: string
  revision: string
  deleted: boolean
  data: unknown
  updated_at: Date
}

function toEntity(r: EntityRow): ServerEntity {
  return {
    type: r.type,
    id: r.id,
    revision: Number(r.revision),
    deleted: r.deleted,
    data: r.data,
    updatedAt: r.updated_at.getTime(),
  }
}

const conflict = (
  opId: string,
  message: string,
  server: ServerEntity | null,
): OpAck => ({
  opId,
  status: 'conflict',
  error: {code: 'CONFLICT', message, retryable: false},
  server,
})

/**
 * Applies ops in request order, each in its own transaction, and returns one
 * ack per op. Ops committed before a failure stay committed; the request then
 * fails with INTERNAL and a retry replays their stored acks.
 */
export async function push(
  sql: SQL,
  account: string,
  ops: SyncOp[],
): Promise<OpAck[]> {
  const acks: OpAck[] = []
  const conflicted = new Set<string>()
  for (const op of ops) {
    const key = `${op.entityType}:${op.entityId}`
    const ack = await applyOp(sql, account, op, conflicted.has(key))
    if (ack.status === 'conflict') conflicted.add(key)
    acks.push(ack)
  }
  return acks
}

async function applyOp(
  sql: SQL,
  account: string,
  op: SyncOp,
  isAfterConflict: boolean,
): Promise<OpAck> {
  return sql.begin(async tx => {
    /*
     * Serialises one account's writes. Commit order then equals change_log seq
     * order, so a pull can never skip a seq that commits late, and concurrent
     * retries of one op see each other's receipt.
     * ponytail: one writer per account at a time; fine for a person's own ledger.
     */
    await tx`SELECT pg_advisory_xact_lock(hashtextextended(${account}, 0))`
    const [receipt] =
      await tx`SELECT ack FROM op_receipts WHERE account_id = ${account} AND op_id = ${op.opId}`
    if (receipt) return receipt.ack as OpAck

    const [row] = await tx`
      SELECT type, id, revision, deleted, data, updated_at FROM entities
      WHERE account_id = ${account} AND type = ${op.entityType} AND id = ${op.entityId}`
    const current = row ? toEntity(row) : null
    const verb = op.opType.slice(op.opType.indexOf('.') + 1)

    let ack: OpAck
    // Preferences are last-write-wins in server order; everything else is financial and never silently overwritten.
    if (op.entityType !== 'preference' && isAfterConflict) {
      ack = conflict(
        op.opId,
        'An earlier op on this entity in the same batch conflicted',
        current,
      )
    } else if (
      op.entityType !== 'preference' &&
      op.baseVersion !== (current?.revision ?? 0)
    ) {
      ack = conflict(
        op.opId,
        `baseVersion ${op.baseVersion} does not match server revision ${current?.revision ?? 0}`,
        current,
      )
    } else if (
      op.entityType !== 'preference' &&
      current?.deleted &&
      verb !== 'restore'
    ) {
      ack = conflict(
        op.opId,
        'The entity is deleted; only a restore applies',
        current,
      )
    } else {
      const isDeleted = verb === 'delete' || op.opType === 'preference.reset'
      // A delete payload is only a marker; the tombstone keeps the last live data.
      const data = verb === 'delete' && current ? current.data : op.payload
      const [saved] = await tx`
        INSERT INTO entities (account_id, type, id, data, revision, deleted)
        VALUES (${account}, ${op.entityType}, ${op.entityId}, ${data}, 1, ${isDeleted})
        ON CONFLICT (account_id, type, id) DO UPDATE
          SET data = EXCLUDED.data, deleted = EXCLUDED.deleted, revision = entities.revision + 1, updated_at = now()
        RETURNING revision`
      await tx`
        INSERT INTO change_log (account_id, type, id, revision, op_id)
        VALUES (${account}, ${op.entityType}, ${op.entityId}, ${saved.revision}::bigint, ${op.opId})`
      ack = {opId: op.opId, status: 'applied', revision: Number(saved.revision)}
    }
    await tx`INSERT INTO op_receipts (account_id, op_id, ack) VALUES (${account}, ${op.opId}, ${ack})`
    return ack
  })
}

/* Cursor = "1:<account>:<seq>", base64url. Opaque to clients; the account binding stops cross-account reuse. */
function makeCursor(account: string, seq: string): string {
  return Buffer.from(`1:${account}:${seq}`).toString('base64url')
}

async function readCursor(
  sql: SQL,
  account: string,
  cursor: string | null,
): Promise<string> {
  if (cursor === null) return '0'
  const parts = Buffer.from(cursor, 'base64url').toString().split(':')
  const seq = parts[2] ?? ''
  const expired = new ApiError(
    'CURSOR_EXPIRED',
    'Cursor is not valid here; rehydrate from /v1/sync/snapshot',
  )
  if (
    parts.length !== 3 ||
    parts[0] !== '1' ||
    parts[1] !== account ||
    !/^\d{1,18}$/.test(seq)
  )
    throw expired
  /*
   * A seq past anything this database has issued comes from another database (a reset or restore).
   * ponytail: nothing prunes change_log yet, so no cursor expires by age; add a retention floor here when pruning lands.
   */
  const [{isKnown}] =
    await sql`SELECT ${seq}::bigint <= coalesce(max(seq), 0) AS "isKnown" FROM change_log`
  if (!isKnown) throw expired
  return seq
}

/**
 * Changes after `cursor` in commit order, each entity once at its latest
 * revision (an entity changed again later is delivered at that later position).
 */
export async function pull(
  sql: SQL,
  account: string,
  cursor: string | null,
  limit: number,
): Promise<PullResponse> {
  const after = await readCursor(sql, account, cursor)
  const rows = await sql`
    SELECT c.seq, e.type, e.id, e.revision, e.deleted, e.data, e.updated_at
    FROM change_log c
    JOIN entities e ON e.account_id = c.account_id AND e.type = c.type AND e.id = c.id
    WHERE c.account_id = ${account} AND c.seq > ${after}::bigint AND e.revision = c.revision
    ORDER BY c.seq
    LIMIT ${limit + 1}`
  const page = (rows as Array<EntityRow & {seq: string}>).slice(0, limit)
  return {
    changes: page.map(toEntity),
    nextCursor: makeCursor(account, page.at(-1)?.seq ?? after),
    hasMore: rows.length > limit,
  }
}

/**
 * Live entities and the cursor they are current as of, read in one snapshot.
 * ponytail: unpaged; page by (type, id) once an account outgrows one response.
 */
export async function snapshot(
  sql: SQL,
  account: string,
): Promise<SnapshotResponse> {
  return sql.begin('isolation level repeatable read read only', async tx => {
    const rows = await tx`
      SELECT type, id, revision, deleted, data, updated_at FROM entities
      WHERE account_id = ${account} AND NOT deleted ORDER BY type, id`
    const [{seq}] =
      await tx`SELECT coalesce(max(seq), 0)::text AS seq FROM change_log WHERE account_id = ${account}`
    return {
      entities: (rows as EntityRow[]).map(toEntity),
      cursor: makeCursor(account, seq),
    }
  })
}
