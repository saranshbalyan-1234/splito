import type {Entity, EntityType, HistoryRow, OutboxOp} from './types'

export interface Tx {
  get<T>(type: EntityType, id: string): Promise<Entity<T> | undefined>
  put(e: Entity): Promise<void>
  appendHistory(h: HistoryRow): Promise<void>
  enqueue(op: OutboxOp): Promise<void>
}

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
  getAll<T>(type: EntityType): Promise<Entity<T>[]>
  history(type: EntityType, id: string): Promise<HistoryRow[]>
  outbox(): Promise<OutboxOp[]>
  /** Fires after each committed transaction (and on changes from other tabs) with what it touched. */
  subscribe(fn: (change: StoreChange) => void): () => void
  close(): Promise<void>
}
