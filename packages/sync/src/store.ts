import {type Key, type Scalar, type StoreName} from './schema'
import {type Entity, type EntityInput, type EntityType, type HistoryRow, type OpStatus, type OutboxInput, type OutboxOp, type RowSyncStatus} from './types'

export interface Tx {
  get<T>(type: EntityType, id: string): Promise<Entity<T> | undefined>
  /**
   * Writes the entity row and, in the same transaction, the relation rows and
   * balance sums it implies (members, parties, balances; ARCHITECTURE 9.8).
   */
  put(e: EntityInput): Promise<void>
  appendHistory(h: HistoryRow): Promise<void>
  /** Queues an op and marks its row `pending` in the same transaction. */
  enqueue(op: OutboxInput): Promise<void>
}

/* -------------------------------------------------------------------------- */
/* Typed index reads (ARCHITECTURE 9.8)                                        */
/* -------------------------------------------------------------------------- */

/** A page of rows plus the cursor for the next one (null: that was the last). */
export interface Page<T> {
  items: T[]
  next: Key | null
}

/** Index read: rows whose first index columns equal `eq`, optionally bounded on the next column, paged by cursor. */
export interface PageQuery<I extends string = string> {
  /** Index name; omitted: the primary key (an id range). */
  index?: I
  eq?: Key
  min?: Scalar
  max?: Scalar
  /** The `next` of the previous page. */
  after?: Key | null
  dir?: 'next' | 'prev'
  limit?: number
}

export const DEFAULT_PAGE = 50

/** The sync fields every relation row carries too. */
interface Synced {
  syncStatus: RowSyncStatus
  version: number
  updatedAt: number
}

/** Who paid and owes what on one live expense (`expense_parties`). */
export interface ExpenseParty extends Synced {
  expenseId: string
  personId: string
  paid: bigint
  share: bigint
  /** Null: not in a group. */
  groupId: string | null
  currency: string
  date: string
}

/** One person's place in one group (`group_members`). */
export interface GroupMember extends Synced {
  groupId: string
  personId: string
  joinedAt: number
  leftAt: number | null
  role: string
}

/** A person's net in one group (`groupId` null: outside groups) and currency (> 0 they lent). */
export interface NetBalance {
  personId: string
  groupId: string | null
  currency: string
  amount: bigint
  /** How many live record entries the sum is made of; the row is gone at 0. */
  count: number
}

/** What `otherId` owes `personId` outside groups, in one currency (> 0 they owe; the mirror row is the negative). */
export interface PairBalance {
  personId: string
  otherId: string
  currency: string
  amount: bigint
}

/** Every stored row, for backup, export and tests (never a hot path). */
export interface StoreDump {
  entities: Entity[]
  history: HistoryRow[]
  outbox: OutboxOp[]
}

/** Counts per sync status for every store that has one: index reads, no scans. */
export type SyncCounts = Partial<Record<StoreName, Record<RowSyncStatus, number>>>

/**
 * What one committed transaction touched: entity ids by type (entity rows and
 * their history). `'unknown'` when the writer could not say (a change from a
 * tab running an older build): readers then re-read everything.
 */
export type StoreChange = Readonly<Partial<Record<EntityType, ReadonlySet<string>>>> | 'unknown'

/** True when `change` may have altered entities of `type` (or that one entity). */
export function touches(change: StoreChange, type: EntityType, id?: string): boolean {
  if (change === 'unknown') return true
  const ids = change[type]
  return !!ids && (id === undefined || ids.has(id))
}

/** Everything two notices touched, for a reader that handles a burst of commits with one read. */
export function mergeChanges(a: StoreChange, b: StoreChange): StoreChange {
  if (a === 'unknown' || b === 'unknown') return 'unknown'
  const out: Partial<Record<EntityType, ReadonlySet<string>>> = {...a}
  for (const [type, ids] of Object.entries(b) as [EntityType, ReadonlySet<string>][])
    out[type] = out[type] ? new Set([...out[type]!, ...ids]) : ids
  return out
}

/** Collects what a transaction writes, for its change notice. */
export function changeRecorder() {
  const ids: Partial<Record<EntityType, Set<string>>> = {}
  return {
    record(type: EntityType, id: string) {
      ;(ids[type] ??= new Set()).add(id)
    },
    change: (): StoreChange => ids,
  }
}

/** A change notice as plain JSON (for BroadcastChannel), and back. Anything unreadable is `'unknown'`. */
export function changeToJson(change: StoreChange): unknown {
  return change === 'unknown' ? 'unknown' : Object.fromEntries(Object.entries(change).map(([t, ids]) => [t, [...ids]]))
}

export function changeFromJson(json: unknown): StoreChange {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return 'unknown'
  const out: Partial<Record<EntityType, ReadonlySet<string>>> = {}
  for (const [type, ids] of Object.entries(json)) {
    if (!Array.isArray(ids) || !ids.every(i => typeof i === 'string')) return 'unknown'
    out[type as EntityType] = new Set(ids as string[])
  }
  return out
}

/** Durable local store. A transaction commits every write or none. */
export interface Store {
  transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T>
  /** One row by id. */
  get<T>(type: EntityType, id: string): Promise<Entity<T> | undefined>
  /** Several rows by id in one read; missing ids are skipped. */
  getMany<T>(type: EntityType, ids: readonly string[]): Promise<Entity<T>[]>
  /**
   * Every row of one type. For small stores, maintenance, export and tests:
   * never a money store (`expense`, `repayment`, `writeoff`) on a hot path;
   * page them with `page` (an architecture rule test enforces it).
   */
  getAll<T>(type: EntityType): Promise<Entity<T>[]>
  /** Rows of one type through a named index, by cursor. */
  page<T>(type: EntityType, q: PageQuery): Promise<Page<Entity<T>>>
  /** Live expenses' parties through `byPersonDate` or `byGroupPerson`, by cursor. */
  parties(q: PageQuery): Promise<Page<ExpenseParty>>
  /** The members of a group, or the groups a person belongs to. */
  members(q: {groupId: string} | {personId: string}): Promise<GroupMember[]>
  /** Net balances: one person's, one group's, or all. */
  balances(q?: {personId?: string; groupId?: string | null}): Promise<NetBalance[]>
  /** What each other person owes `personId` outside groups, per currency. */
  pairBalances(personId: string): Promise<PairBalance[]>
  /** Latest `YYYY-MM-DD` of a live expense, payment or write-off each person is on. */
  lastActivity(personIds: readonly string[]): Promise<Map<string, string>>
  /** How many rows of one type an index range holds (a count, not a read). */
  count(type: EntityType, q?: {index?: string; eq?: Key; min?: Scalar; max?: Scalar}): Promise<number>
  /** When each group last saw activity: its own change or any record's in it, newest first (26.17). */
  groupActivity(): Promise<Map<string, number>>
  /** The stored versions of several entities in one read. */
  historyMany(refs: ReadonlyArray<{type: EntityType; id: string}>): Promise<HistoryRow[]>
  /** History rows newest change first (`byChangedAt`), by cursor. */
  historyPage(q?: {after?: Key | null; limit?: number}): Promise<Page<HistoryRow>>
  history(type: EntityType, id: string): Promise<HistoryRow[]>
  outbox(): Promise<OutboxOp[]>
  /** Ops in one state, oldest first. */
  outboxByStatus(status: OpStatus): Promise<OutboxOp[]>
  /** Row counts per sync status for every store, read from `bySyncStatus`. */
  syncCounts(): Promise<SyncCounts>
  /**
   * Moves an op through `queued -> sending -> acked | failed` and its row
   * with it, in one transaction: `syncing`, then `synced` (only on `acked`,
   * and only when no later op for the row is waiting) or `failed`.
   */
  setOpStatus(opId: string, status: OpStatus, info?: {error?: string; serverVersion?: number; at?: number}): Promise<void>
  /** Recomputes members, parties and balances from the entity rows (maintenance; a no-op when nothing drifted). */
  rebuildProjections(): Promise<void>
  /** Everything, for backup and tests. */
  dump(): Promise<StoreDump>
  /**
   * Erases entities outright, with their history and outbox ops, in one
   * transaction. Only for data the app itself seeded (the dev/e2e demo set):
   * user deletes are tombstones, never this.
   */
  erase(refs: ReadonlyArray<{type: EntityType; id: string}>): Promise<void>
  /** Fires after each committed transaction (and on changes from other tabs) with what it touched. */
  subscribe(fn: (change: StoreChange) => void): () => void
  close(): Promise<void>
}
