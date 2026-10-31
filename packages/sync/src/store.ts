import {type SpendCell} from '@splito/domain'

import {type Key, type Scalar, type StoreName} from './schema'
import {type SearchTerm, type TermKind} from './searchTerms'
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
  /** Rows of one type through a named index, by cursor (reads inside the transaction see its own writes). */
  page<T>(type: EntityType, q: PageQuery): Promise<Page<Entity<T>>>
  /** The stored versions of one entity, oldest first. */
  history(type: EntityType, id: string): Promise<HistoryRow[]>
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

/** Who paid and owes what on one expense (`expense_parties`); `deleted` once the expense is deleted (its row stays, for lists that show deleted items). */
export interface ExpenseParty extends Synced {
  expenseId: string
  personId: string
  paid: bigint
  share: bigint
  /** Null: not in a group. */
  groupId: string | null
  currency: string
  date: string
  deleted: boolean
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

/** The part of a net balance that sits on records with an open dispute or hold (F-1210). */
export interface DisputedBalance {
  personId: string
  groupId: string | null
  currency: string
  amount: bigint
  /** How many disputed records the sum is made of. */
  count: number
}

/** What `otherId` owes `personId` on disputed records, in one group (null: outside groups) and currency (> 0 they owe). */
export interface DisputedPair {
  personId: string
  otherId: string
  groupId: string | null
  currency: string
  amount: bigint
}

/** What `otherId` owes `personId` outside groups, in one currency (> 0 they owe; the mirror row is the negative). */
export interface PairBalance {
  personId: string
  otherId: string
  currency: string
  amount: bigint
}

/** A range of one kind of search term. */
export interface TermQuery {
  kind: TermKind
  min?: string
  max?: string
  limit?: number
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
  /**
   * Expenses' parties through `byPersonDate` or `byGroupPerson`, by cursor. Live expenses only, unless
   * `includeDeleted` (a person's history lists deleted ones in place, decision 103): the pages are still full ones.
   */
  parties(q: PageQuery & {includeDeleted?: boolean}): Promise<Page<ExpenseParty>>
  /** The members of a group, or the groups a person belongs to. */
  members(q: {groupId: string} | {personId: string}): Promise<GroupMember[]>
  /** Net balances: one person's, one group's, or all. */
  balances(q?: {personId?: string; groupId?: string | null}): Promise<NetBalance[]>
  /** What each other person owes `personId` outside groups, per currency. */
  pairBalances(personId: string): Promise<PairBalance[]>
  /** The disputed or held part of the net balances, same selection as `balances` (an index read, never a scan of records). */
  disputedBalances(q?: {personId?: string; groupId?: string | null}): Promise<DisputedBalance[]>
  /** The disputed or held part of what others owe `personId` (or of what `otherId` owes them), per group and currency. */
  disputedPairs(personId: string, otherId?: string): Promise<DisputedPair[]>
  /**
   * When each person last saw activity (epoch ms): any change to an expense,
   * payment or write-off they are on, a delete included, newest first. People
   * with none are left out. An index read of `people.lastActivityAt`.
   */
  lastActivity(): Promise<Map<string, number>>
  /**
   * Stored spending cells (`aggregates`, folded to months, each dated the
   * first of its month), for one person and/or one currency, or all. Reads
   * the projection, never the ledger.
   */
  aggregates(q?: {personId?: string; currency?: string}): Promise<SpendCell[]>
  /**
   * Checks the search index once (version and record count) and rebuilds it in chunks when stale. The app calls it
   * at idle after opening; term reads wait for it. Rejects on failure, and the next call tries again.
   */
  prepareSearch(): Promise<void>
  /** `search_terms` of one kind in key order, optionally bounded on the term (inclusive). */
  terms(q: TermQuery): Promise<SearchTerm[]>
  /** How many `search_terms` rows a range holds (a count, not a read). */
  termCount(q: Omit<TermQuery, 'limit'>): Promise<number>
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

/** A store whose transactions run inside `tx`: the real mutations then batch into one commit. */
export function insideTransaction(store: Store, tx: Tx): Store {
  return {...store, transaction: fn => fn(tx)}
}

/*
 * Stores that must never reach a server: the dev/e2e demo database queues ops like
 * any store (they are its history) but its outbox is never drained. The sync client
 * asks `sendableOps`, never `outboxByStatus` directly, so this is the one gate.
 */
const neverSync = new WeakSet<object>()

/** Marks a store whose outbox is never sent (demo mode). */
export function markNeverSync(store: Store): void {
  neverSync.add(store)
}

export function isNeverSync(store: Store): boolean {
  return neverSync.has(store)
}

/** The queued ops the sync client may send: none for a never-sync store. */
export async function sendableOps(store: Store): Promise<OutboxOp[]> {
  return isNeverSync(store) ? [] : store.outboxByStatus('queued')
}
