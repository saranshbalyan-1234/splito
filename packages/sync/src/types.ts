export type EntityType =
  | 'person'
  | 'group'
  | 'expense'
  | 'repayment'
  | 'writeoff'
  | 'preference'
  | 'friendRequest'
  | 'inviteLink'
  | 'comment'
  | 'feedback'
  | 'reminder'
  | 'dispute'

/**
 * Where a row stands with the server (ARCHITECTURE 9.8). `local`: on this
 * device only, never queued. `pending`: queued in the outbox. `syncing`:
 * sent, waiting for the answer. `synced`: acknowledged. `failed`: refused or
 * conflicted (`syncError` says why). Moves forward only on real acknowledgements.
 */
export type RowSyncStatus = 'local' | 'pending' | 'syncing' | 'synced' | 'failed'

export const ROW_SYNC_STATUSES: readonly RowSyncStatus[] = ['local', 'pending', 'syncing', 'synced', 'failed']

/** The per-row sync fields every stored entity carries. */
export interface RowSync {
  syncStatus: RowSyncStatus
  /** The version the server last acknowledged (or sent); null before any. */
  serverVersion: number | null
  /** Epoch ms of that acknowledgement. */
  syncedAt: number | null
  /** Why the row is `failed`; null otherwise. */
  syncError: string | null
}

export interface Entity<T = unknown> extends RowSync {
  type: EntityType
  id: string
  data: T
  version: number
  deleted: boolean
  /** Epoch ms of version 1. */
  createdAt: number
  updatedAt: number
}

/**
 * What a writer hands `Tx.put`: the sync fields and `createdAt` are optional.
 * An omitted `createdAt` keeps the stored one; omitted sync fields keep the
 * stored ones (`local` for a new row). `Tx.enqueue` then marks the row `pending`.
 */
export type EntityInput<T = unknown> = Pick<Entity<T>, 'type' | 'id' | 'data' | 'version' | 'deleted' | 'updatedAt'> &
  Partial<Pick<Entity<T>, 'createdAt' | keyof RowSync>>

/** An outbox op's own state, linked to its row by `entityType` + `entityId` (ARCHITECTURE 9.8). */
export type OpStatus = 'queued' | 'sending' | 'acked' | 'failed'

export interface OutboxOp {
  seq?: number
  opId: string
  deviceId: string
  actor: string
  entityType: EntityType
  entityId: string
  opType: string
  baseVersion: number
  payload: unknown
  schemaVersion: 1
  deps: string[]
  attempts: number
  nextAttemptAt: number | null
  lastError: string | null
  status: OpStatus
}

/** What a writer enqueues: the op starts `queued`. */
export type OutboxInput = Omit<OutboxOp, 'seq' | 'status'> & {seq?: number; status?: OpStatus}

export interface HistoryRow {
  entityType: EntityType
  entityId: string
  version: number
  data: unknown
  deleted: boolean
  at: number
  actor: string
}

export interface MutationCtx {
  deviceId: string
  /** The local "me" person id. */
  actor: string
  now(): number
  newId(): string
}
