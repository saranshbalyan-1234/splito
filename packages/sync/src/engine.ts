import type {Key, Row, Scalar, StoreName} from './schema'
import type {StoreChange} from './store'

/**
 * One index (or primary key) range read. The same query means the same rows
 * in the same order on IndexedDB and SQLite (ARCHITECTURE 9.8).
 */
export interface RangeQuery {
  /** Index name; omitted: the primary key. */
  index?: string
  /** The leading index columns that must equal these values. */
  eq?: Key
  /** Inclusive bounds on the column right after `eq`. */
  min?: Scalar
  max?: Scalar
  /** The full index key of the last row already seen: continue after it, in `dir`. */
  after?: Key | null
  dir?: 'next' | 'prev'
  limit?: number
}

/** Row-level access inside one engine transaction. Everything a store does is built from this. */
export interface RowAccess {
  get(store: StoreName, key: Key): Promise<Row | undefined>
  /** Insert or replace by primary key. */
  put(store: StoreName, row: Row): Promise<void>
  /** Insert; rejects on an existing key (or, for the outbox, a repeated `opId`). */
  add(store: StoreName, row: Row): Promise<void>
  delete(store: StoreName, key: Key): Promise<void>
  /** Removes every row (projections are rebuilt after). */
  clear(store: StoreName): Promise<void>
  range(store: StoreName, q: RangeQuery): Promise<Row[]>
  count(store: StoreName, q: Pick<RangeQuery, 'index' | 'eq' | 'min' | 'max'>): Promise<number>
}

/** A storage engine: transactions over `RowAccess`, plus cross-tab notices where the platform has them. */
export interface Engine {
  /**
   * Runs `fn` in one transaction: every write commits or none. `fn` may only
   * await `RowAccess` calls (IndexedDB commits a transaction on any other wait).
   * Read-only runs may overlap; write runs never do.
   */
  run<T>(mode: 'rw' | 'ro', fn: (rows: RowAccess) => Promise<T>): Promise<T>
  close(): Promise<void>
  /** Notices to and from other tabs on the same database. */
  remote?: {post(change: StoreChange): void; listen(fn: (change: StoreChange) => void): void}
}
