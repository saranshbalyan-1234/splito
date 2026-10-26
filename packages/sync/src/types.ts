export type EntityType =
  | 'person'
  | 'group'
  | 'expense'
  | 'repayment'
  | 'writeoff'
  | 'preference'
  | 'friendRequest'
  | 'inviteLink'

export interface Entity<T = unknown> {
  type: EntityType
  id: string
  data: T
  version: number
  deleted: boolean
  updatedAt: number
}

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
}

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
