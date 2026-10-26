import type {Entity, EntityType, HistoryRow, OutboxOp} from './types'

export interface Tx {
  get<T>(type: EntityType, id: string): Promise<Entity<T> | undefined>
  put(e: Entity): Promise<void>
  appendHistory(h: HistoryRow): Promise<void>
  enqueue(op: OutboxOp): Promise<void>
}

/** Durable local store. A transaction commits every write or none. */
export interface Store {
  transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T>
  getAll<T>(type: EntityType): Promise<Entity<T>[]>
  history(type: EntityType, id: string): Promise<HistoryRow[]>
  outbox(): Promise<OutboxOp[]>
  /** Fires after each committed transaction (and on changes from other tabs). */
  subscribe(fn: () => void): () => void
  close(): Promise<void>
}
