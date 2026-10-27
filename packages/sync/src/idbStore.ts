import {type IDBPDatabase, type IDBPTransaction, wrap} from 'idb'

import {createStore} from './core'
import {type Engine, type RangeQuery, type RowAccess} from './engine'
import {type LegacyV1, migrateFromV1, migrateV2ToV3, migrateV3ToV4, stampSchemaVersion} from './migrate'
import {indexColumns, type Key, type Row, SCHEMA_VERSION, STORES, type StoreName} from './schema'
import {transactionRows} from './txRows'
import {changeFromJson, changeToJson, type Store, type StoreChange} from './store'

const CHANNEL = 'splito-store'
const STORE_NAMES = Object.keys(STORES) as StoreName[]

// Typed as read-write: a read-only transaction simply has no writes issued on it.
type Tx = IDBPTransaction<unknown, string[], 'readwrite'>

/** The primary key as IndexedDB holds it: an array, except the outbox's auto-increment `seq`. */
const pk = (store: StoreName, key: Key): IDBValidKey => ((STORES[store] as {auto?: boolean}).auto ? (key[0] as IDBValidKey) : (key as IDBValidKey))

/** Creates object stores and their indexes: every one (a fresh database, or v1's stores already removed), or just `only`. */
function createStores(raw: IDBDatabase, only: readonly StoreName[] = STORE_NAMES) {
  for (const name of only) {
    const spec = STORES[name] as {key: readonly string[]; auto?: boolean; indexes: Record<string, {columns: readonly string[]; unique?: boolean}>}
    const store = spec.auto
      ? raw.createObjectStore(name, {keyPath: spec.key[0]!, autoIncrement: true})
      : raw.createObjectStore(name, {keyPath: [...spec.key]})
    for (const [index, def] of Object.entries(spec.indexes)) store.createIndex(index, [...def.columns], {unique: !!def.unique})
  }
}

/**
 * The IndexedDB range of a query. Index keys are arrays, so "all keys that
 * start with `eq`" is `[eq]..[eq, []]` (an array sorts after every string
 * and number). Null: the bounds cross, so nothing matches.
 */
function keyRange(q: Pick<RangeQuery, 'eq' | 'min' | 'max' | 'after' | 'dir'>, cmp: (a: unknown, b: unknown) => number): IDBKeyRange | undefined | null {
  const eq = q.eq ?? []
  let lo: unknown[] | undefined = q.min !== undefined ? [...eq, q.min] : eq.length ? [...eq] : undefined
  let hi: unknown[] | undefined = q.max !== undefined ? [...eq, q.max, []] : eq.length ? [...eq, []] : undefined
  let loOpen = false
  let hiOpen = false
  if (q.after) {
    if ((q.dir ?? 'next') === 'next') [lo, loOpen] = [q.after, true]
    else [hi, hiOpen] = [q.after, true]
  }
  if (lo && hi) {
    const c = cmp(lo, hi)
    if (c > 0 || (c === 0 && (loOpen || hiOpen))) return null
    return IDBKeyRange.bound(lo, hi, loOpen, hiOpen)
  }
  if (lo) return IDBKeyRange.lowerBound(lo, loOpen)
  if (hi) return IDBKeyRange.upperBound(hi, hiOpen)
  return undefined
}

function idbRows(t: Tx, cmp: (a: unknown, b: unknown) => number): RowAccess {
  const open = (store: StoreName, index?: string) => (index ? t.objectStore(store).index(index) : t.objectStore(store))
  return {
    async get(store, key) {
      return (await t.objectStore(store).get(pk(store, key))) as Row | undefined
    },
    async put(store, row) {
      await t.objectStore(store).put(row)
    },
    async add(store, row) {
      await t.objectStore(store).add(row)
    },
    async delete(store, key) {
      await t.objectStore(store).delete(pk(store, key))
    },
    async clear(store) {
      await t.objectStore(store).clear()
    },
    async range(store, q) {
      // Validates the index name the same way SQLite does.
      if (q.index) indexColumns(store, q.index)
      const range = keyRange(q, cmp)
      if (range === null) return []
      const source = open(store, q.index)
      if ((q.dir ?? 'next') === 'next') return (await source.getAll(range, q.limit)) as Row[]
      const out: Row[] = []
      for (let c = await source.openCursor(range, 'prev'); c && out.length < (q.limit ?? Infinity); c = await c.continue()) out.push(c.value as Row)
      return out
    },
    async count(store, q) {
      const range = keyRange(q, cmp)
      return range === null ? 0 : await open(store, q.index).count(range)
    },
  }
}

/** Reads v1's three object stores. */
async function readV1(t: Tx): Promise<LegacyV1> {
  // Issued together: a transaction with no request pending when a read returns may already be finished.
  const [entities, history, outbox] = await Promise.all(['entities', 'history', 'outbox'].map(name => t.objectStore(name).getAll()))
  return {entities, history, outbox} as LegacyV1
}

/** Runs a migration step with its writes issued without waiting for each (the upgrade transaction orders them). */
async function pipelined(t: Tx, cmp: (a: unknown, b: unknown) => number, step: (rows: RowAccess) => Promise<void>) {
  const tx = transactionRows(idbRows(t, cmp), {isPipelined: true})
  try {
    await step(tx.rows)
  } catch (e) {
    // The first failed write is the root cause; what the step threw is usually the abort that followed it.
    throw (await tx.failure())?.error ?? e
  }
  await tx.flush()
}

/** What the browser tells about the database that the person may need to act on. */
export interface StorageNotices {
  /** Another tab still holds an older version open, so this tab's upgrade waits ("Close other Splito tabs"). The open goes on by itself once they close. */
  onBlocked?: () => void
  /** A newer build in another tab is upgrading the database: this tab's connection is closed and it must reload. */
  onVersionChange?: () => void
}

export async function openIdbStore(name: string, factory: IDBFactory = indexedDB, notices: StorageNotices = {}): Promise<Store> {
  const cmp = (a: unknown, b: unknown) => factory.cmp(a, b)
  const req = factory.open(name, SCHEMA_VERSION)
  req.onblocked = () => notices.onBlocked?.()
  let upgrade: Promise<void> | undefined
  /** Why the upgrade aborted: the open request itself only reports "aborted". */
  let upgradeError: unknown
  req.onupgradeneeded = e => {
    const raw = req.result
    const t = wrap(req.transaction!) as unknown as Tx
    // An aborted upgrade rejects `done`; the failed open request reports it, so this one is observed only.
    t.done.catch(() => undefined)
    upgrade = (async () => {
      if (e.oldVersion === 0) {
        createStores(raw)
        await stampSchemaVersion(idbRows(t, cmp))
      } else if (e.oldVersion === 1) {
        // v1 -> current: read the old layout whole, replace it, write every row back in the new one.
        const legacy = await readV1(t)
        for (const old of ['entities', 'history', 'outbox']) raw.deleteObjectStore(old)
        createStores(raw)
        await pipelined(t, cmp, rows => migrateFromV1(legacy, rows))
      } else if (e.oldVersion === 2) {
        // v2 -> v3: two new stores and one new index; every older row is rewritten by the rebuild.
        createStores(raw, ['aggregates', 'search_terms'])
        req.transaction!.objectStore('people').createIndex('byActivity', [...STORES.people.indexes.byActivity.columns])
        await pipelined(t, cmp, rows => migrateV2ToV3(rows))
      } else if (e.oldVersion === 3) {
        // v3 -> v4: same stores; the derived rows are rebuilt (deleted expenses keep parties and search terms).
        await pipelined(t, cmp, rows => migrateV3ToV4(rows))
      }
    })().catch(error => {
      // Aborting the upgrade leaves the v1 database exactly as it was.
      upgradeError = error
      try {
        req.transaction!.abort()
      } catch {
        // already aborted
      }
      throw error
    })
    // A failure surfaces through the aborted open request below.
    upgrade.catch(() => undefined)
  }
  let db: IDBPDatabase
  try {
    db = (await wrap(req)) as IDBPDatabase
  } catch (e) {
    throw upgradeError ?? e
  }
  await upgrade
  if (upgradeError) {
    db.close()
    throw upgradeError
  }
  // A newer build in another tab can upgrade later: let go so it is never blocked, and say this tab must reload.
  db.onversionchange = () => {
    db.close()
    notices.onVersionChange?.()
  }

  const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(CHANNEL + ':' + name)

  const engine: Engine = {
    pipelined: true,
    async run(mode, fn) {
      const t = db.transaction(STORE_NAMES, mode === 'rw' ? 'readwrite' : 'readonly') as unknown as Tx
      // Observe `done` now so an abort never surfaces as an unhandled rejection.
      const done = t.done.then(
        () => true,
        () => false,
      )
      let result
      try {
        result = await fn(idbRows(t, cmp))
      } catch (e) {
        try {
          t.abort()
        } catch {
          // already aborted by a failed request
        }
        await done
        throw e
      }
      if (!(await done)) throw new Error('IndexedDB transaction aborted')
      return result
    },
    async close() {
      channel?.close()
      db.close()
    },
    remote: channel
      ? {
          post: (change: StoreChange) => channel.postMessage(changeToJson(change)),
          // Another tab's notice; an older build posts a bare string, which reads as 'unknown'.
          listen: fn => void (channel.onmessage = (e: MessageEvent) => fn(changeFromJson(e.data))),
        }
      : undefined,
  }
  return createStore(engine)
}
