/**
 * The store both engines share (ARCHITECTURE 9.8): entity/row mapping, the
 * transaction (entity + projections + history + outbox), typed index reads,
 * sync-state moves and maintenance, all built on `RowAccess`. An engine
 * (`idbStore.ts`, `sqlStore.ts`) only implements rows, indexes and
 * transactions, so one contract test covers both and they cannot differ.
 */
import {type SpendCell} from '@splito/domain'

import {type Engine, type RowAccess} from './engine'
import {ensureSearchIndex, projectEntity, rebuildActivity, rebuildProjections} from './ledgerProjection'
import {
  completeEntity,
  ENTITY_STORE,
  ENTITY_TYPES,
  entityOfRow,
  historyOfRow,
  historyRow,
  indexKey,
  MONEY_TYPES,
  outboxOfRow,
  outboxRow,
  type Row,
  rowOfEntity,
  type StoreName,
  STORES,
} from './schema'
import {transactionRows} from './txRows'
import {changeRecorder, DEFAULT_PAGE, type TermQuery, type ExpenseParty, type GroupMember, type NetBalance, type Page, type PageQuery, type PairBalance, type Store, type StoreChange, type Tx} from './store'
import {type SearchTerm, type TermEntity, type TermKind} from './searchTerms'
import {type Entity, type EntityType, type HistoryRow, type RowSyncStatus} from './types'
import {ROW_SYNC_STATUSES} from './types'

const SYNC_STORES = (Object.keys(STORES) as StoreName[]).filter(s => 'bySyncStatus' in STORES[s].indexes)

/* A row is decoded once however often a transaction reads it (rows are never changed in place). */
const decoded = new WeakMap<Row, Entity>()
function decode(type: EntityType, row: Row): Entity {
  let e = decoded.get(row)
  if (!e) decoded.set(row, (e = entityOfRow(type, row)))
  return e
}

/** Reads an entity row. */
async function loadEntity(rows: RowAccess, type: EntityType, id: string): Promise<Entity | undefined> {
  const r = await rows.get(ENTITY_STORE[type], [id])
  return r ? decode(type, r) : undefined
}

/** Writes an entity row; a group or person keeps the activity time its records have raised. */
async function writeEntity(rows: RowAccess, next: Entity, prevRow?: Row) {
  const row = rowOfEntity(next)
  if (next.type === 'group') row.activityAt = Math.max((prevRow?.activityAt as number | undefined) ?? 0, next.updatedAt)
  if (next.type === 'person') row.lastActivityAt = (prevRow?.lastActivityAt as number | undefined) ?? 0
  await rows.put(ENTITY_STORE[next.type], row)
}

/** Changes only an entity's sync fields (its relation rows follow). */
async function setSync(
  rows: RowAccess,
  recorder: ReturnType<typeof changeRecorder>,
  e: Entity,
  sync: Partial<Pick<Entity, 'syncStatus' | 'syncError' | 'serverVersion' | 'syncedAt'>>,
) {
  // Readers of the row (and its lists) are told, as for any write to it.
  recorder.record(e.type, e.id)
  const next: Entity = {...e, ...sync}
  await writeEntity(rows, next, await rows.get(ENTITY_STORE[e.type], [e.id]))
  await projectEntity(rows, e, next)
}

/** Every row of an entity type, by id. */
// full-read-ok: only `rebuildProjections` calls this (maintenance and migration), never a mutation or a read path
const allOf = async (rows: RowAccess, type: EntityType) => (await rows.range(ENTITY_STORE[type], {})).map(r => entityOfRow(type, r))

function makeTx(rows: RowAccess, recorder: ReturnType<typeof changeRecorder>): Tx {
  return {
    async get<T>(type: EntityType, id: string) {
      return (await loadEntity(rows, type, id)) as Entity<T> | undefined
    },
    async put(input) {
      const prevRow = await rows.get(ENTITY_STORE[input.type], [input.id])
      const prev = prevRow ? decode(input.type, prevRow) : undefined
      const next = completeEntity(input, prev)
      recorder.record(next.type, next.id)
      await writeEntity(rows, next, prevRow)
      await projectEntity(rows, prev, next)
    },
    async appendHistory(h) {
      recorder.record(h.entityType, h.entityId)
      await rows.add('history', historyRow(h))
    },
    async page<T>(type: EntityType, q: PageQuery) {
      return (await pageOf(rows, ENTITY_STORE[type], q, r => entityOfRow(type, r))) as Page<Entity<T>>
    },
    async history(type, id) {
      return (await rows.range('history', {eq: [type, id]})).map(historyOfRow)
    },
    async enqueue(op) {
      await rows.add('outbox', outboxRow(op))
      // The row waits for the server from the moment its op is queued.
      const e = await loadEntity(rows, op.entityType, op.entityId)
      if (e && e.syncStatus !== 'pending') await setSync(rows, recorder, e, {syncStatus: 'pending', syncError: null})
    },
  }
}

const toParty = (r: Row): ExpenseParty => ({
  expenseId: r.expenseId as string,
  personId: r.personId as string,
  paid: BigInt(r.paid as string),
  share: BigInt(r.share as string),
  groupId: (r.groupId as string) || null,
  currency: r.currency as string,
  date: r.date as string,
  deleted: r.deleted === 1,
  version: r.version as number,
  updatedAt: r.updatedAt as number,
  syncStatus: r.syncStatus as RowSyncStatus,
})

const toMember = (r: Row): GroupMember => ({
  groupId: r.groupId as string,
  personId: r.personId as string,
  joinedAt: r.joinedAt as number,
  leftAt: r.leftAt as number | null,
  role: r.role as string,
  version: r.version as number,
  updatedAt: r.updatedAt as number,
  syncStatus: r.syncStatus as RowSyncStatus,
})

const toNet = (r: Row): NetBalance => ({
  personId: r.personId as string,
  groupId: (r.groupId as string) || null,
  currency: r.currency as string,
  amount: BigInt(r.amount as string),
  count: r.count as number,
})

const toCell = (r: Row): SpendCell => ({
  date: `${r.month as string}-01`,
  currency: r.currency as string,
  groupId: r.groupId as string,
  category: r.categoryId as string,
  person: r.personId as string,
  kind: r.kind as SpendCell['kind'],
  total: BigInt(r.total as string),
  paid: BigInt(r.paid as string),
  share: BigInt(r.share as string),
  net: BigInt(r.net as string),
  count: r.count as number,
})

const toTerm = (r: Row): SearchTerm => ({kind: r.kind as TermKind, term: r.term as string, entityType: r.entityType as TermEntity, entityId: r.entityId as string})

const termQuery = (q: TermQuery) => ({eq: [q.kind], min: q.min, max: q.max, limit: q.limit})

const toDisputed = (r: Row) => ({
  personId: r.personId as string,
  groupId: (r.groupId as string) || null,
  currency: r.currency as string,
  amount: BigInt(r.amount as string),
  count: r.count as number,
})

const toPair = (r: Row): PairBalance => ({personId: r.personId as string, otherId: r.otherId as string, currency: r.currency as string, amount: BigInt(r.amount as string)})

/** One page of `store` rows: reads `limit + 1` so the cursor is exact. */
async function pageOf<T>(rows: RowAccess, store: StoreName, q: PageQuery, map: (r: Row) => T): Promise<Page<T>> {
  const limit = q.limit ?? DEFAULT_PAGE
  const found = await rows.range(store, {index: q.index, eq: q.eq, min: q.min, max: q.max, after: q.after, dir: q.dir, limit: limit + 1})
  const more = found.length > limit
  const slice = more ? found.slice(0, limit) : found
  return {items: slice.map(map), next: more ? indexKey(store, q.index, slice[slice.length - 1]!) : null}
}

/**
 * A page of `store` rows that `keep` accepts: the index is read in chunks until `limit` rows are kept, so a page is
 * full whatever is skipped, and the cursor is exact (it is `null` only when the index has no further kept row).
 */
async function keptPageOf<T>(rows: RowAccess, store: StoreName, q: PageQuery, map: (r: Row) => T, keep: (r: Row) => boolean): Promise<Page<T>> {
  const limit = q.limit ?? DEFAULT_PAGE
  const items: T[] = []
  let after = q.after ?? null
  // Chunks, not `limit + 1`: a page of 1 would otherwise cost a range read per row skipped.
  const chunk = Math.max(limit + 1, 50)
  for (;;) {
    const found = await rows.range(store, {index: q.index, eq: q.eq, min: q.min, max: q.max, after, dir: q.dir, limit: chunk + 1})
    const more = found.length > chunk
    for (const r of more ? found.slice(0, chunk) : found) {
      // The cursor sits just before this row, so the next page starts with it.
      if (keep(r) && items.length === limit) return {items, next: after}
      if (keep(r)) items.push(map(r))
      after = indexKey(store, q.index, r)
    }
    if (!more) return {items, next: null}
  }
}

export function createStore(engine: Engine): Store {
  const listeners = new Set<(change: StoreChange) => void>()
  const notify = (change: StoreChange) => listeners.forEach(l => l(change))
  engine.remote?.listen(notify)
  const read = <T>(fn: (rows: RowAccess) => Promise<T>) => engine.run('ro', fn)
  const write = async <T>(fn: (rows: RowAccess, recorder: ReturnType<typeof changeRecorder>) => Promise<T>) => {
    const recorder = changeRecorder()
    const result = await engine.run('rw', async raw => {
      const tx = transactionRows(raw, {isPipelined: engine.pipelined})
      let done: T
      try {
        done = await fn(tx.rows, recorder)
      } catch (e) {
        // A pipelined write that already failed aborted the transaction under `fn`: report that cause.
        throw (await tx.failure())?.error ?? e
      }
      await tx.flush()
      return done
    })
    const change = recorder.change()
    notify(change)
    engine.remote?.post(change)
    return result
  }

  /* The first search of a database whose terms predate the current index version rebuilds them once (derived data only). */
  let searchIndex: Promise<void> | undefined
  // full-read-ok: once per database, only when its terms predate the index version (maintenance, like `rebuildProjections`)
  const searchIndexReady = () => (searchIndex ??= write(rows => ensureSearchIndex(rows, async type => allOf(rows, type))))

  return {
    transaction: fn => write((rows, recorder) => fn(makeTx(rows, recorder))),

    get: <T>(type: EntityType, id: string) => read(rows => loadEntity(rows, type, id)) as Promise<Entity<T> | undefined>,

    getMany: <T>(type: EntityType, ids: readonly string[]) =>
      read(async rows => {
        const out: Entity<T>[] = []
        for (const id of ids) {
          const e = await loadEntity(rows, type, id)
          if (e) out.push(e as Entity<T>)
        }
        return out
      }),

    getAll: <T>(type: EntityType) => read(rows => allOf(rows, type)) as Promise<Entity<T>[]>,

    page: <T>(type: EntityType, q: PageQuery) =>
      read(rows => pageOf(rows, ENTITY_STORE[type], q, r => entityOfRow(type, r))) as Promise<Page<Entity<T>>>,

    parties: ({includeDeleted, ...q}) =>
      read(rows => (includeDeleted ? pageOf(rows, 'expense_parties', q, toParty) : keptPageOf(rows, 'expense_parties', q, toParty, r => r.deleted === 0))),

    members: q =>
      read(async rows =>
        (await rows.range('group_members', 'groupId' in q ? {eq: [q.groupId]} : {index: 'byPerson', eq: [q.personId]})).map(toMember),
      ),

    balances: (q = {}) =>
      read(async rows => {
        const eq = q.personId !== undefined ? [q.personId, ...(q.groupId !== undefined ? [q.groupId ?? ''] : [])] : undefined
        const found =
          eq !== undefined
            ? await rows.range('balances', {eq})
            : q.groupId !== undefined
              ? await rows.range('balances', {index: 'byGroup', eq: [q.groupId ?? '']})
              : await rows.range('balances', {})
        return found.map(toNet)
      }),

    disputedBalances: (q = {}) =>
      read(async rows => {
        const eq = q.personId !== undefined ? [q.personId, ...(q.groupId !== undefined ? [q.groupId ?? ''] : [])] : undefined
        const found =
          eq !== undefined
            ? await rows.range('disputed_balances', {eq})
            : q.groupId !== undefined
              ? await rows.range('disputed_balances', {index: 'byGroup', eq: [q.groupId ?? '']})
              : await rows.range('disputed_balances', {})
        return found.map(toDisputed)
      }),

    disputedPairs: (personId, otherId) =>
      read(async rows =>
        (await rows.range('disputed_pairs', {eq: otherId === undefined ? [personId] : [personId, otherId]})).map(r => ({
          personId: r.personId as string,
          otherId: r.otherId as string,
          groupId: (r.groupId as string) || null,
          currency: r.currency as string,
          amount: BigInt(r.amount as string),
        })),
      ),

    pairBalances: personId => read(async rows => (await rows.range('pair_balances', {eq: [personId]})).map(toPair)),

    lastActivity: () =>
      read(async rows => new Map((await rows.range('people', {index: 'byActivity', min: 1, dir: 'prev'})).map(r => [r.id as string, r.lastActivityAt as number]))),

    aggregates: (q = {}) =>
      read(async rows => {
        const found =
          q.personId !== undefined
            ? await rows.range('aggregates', {index: 'byPerson', eq: q.currency !== undefined ? [q.personId, q.currency] : [q.personId]})
            : await rows.range('aggregates', {eq: q.currency !== undefined ? [q.currency] : undefined})
        return found.map(toCell)
      }),

    terms: async q => {
      await searchIndexReady()
      return read(async rows => (await rows.range('search_terms', termQuery(q))).map(toTerm))
    },

    termCount: async q => {
      await searchIndexReady()
      return read(rows => rows.count('search_terms', termQuery(q)))
    },

    historyPage: ({after, limit = DEFAULT_PAGE} = {}) =>
      read(rows => pageOf(rows, 'history', {index: 'byChangedAt', dir: 'prev', after, limit}, historyOfRow)),

    history: (type, id) => read(async rows => (await rows.range('history', {eq: [type, id]})).map(historyOfRow)),

    outbox: () => read(async rows => (await rows.range('outbox', {})).map(outboxOfRow)),

    outboxByStatus: status => read(async rows => (await rows.range('outbox', {index: 'byStatus', eq: [status]})).map(outboxOfRow)),

    count: (type, q = {}) => read(rows => rows.count(ENTITY_STORE[type], q)),

    groupActivity: () =>
      read(async rows => new Map((await rows.range('groups', {index: 'byActivity', dir: 'prev'})).map(r => [r.id as string, r.activityAt as number]))),

    historyMany: refs =>
      read(async rows => {
        const out: HistoryRow[] = []
        for (const {type, id} of refs) out.push(...(await rows.range('history', {eq: [type, id]})).map(historyOfRow))
        return out
      }),

    syncCounts: () =>
      read(async rows => {
        const out: Partial<Record<StoreName, Record<RowSyncStatus, number>>> = {}
        for (const store of SYNC_STORES) {
          const counts = {} as Record<RowSyncStatus, number>
          for (const status of ROW_SYNC_STATUSES) counts[status] = await rows.count(store, {index: 'bySyncStatus', eq: [status]})
          out[store] = counts
        }
        return out
      }),

    setOpStatus: (opId, status, info = {}) =>
      write(async (rows, recorder) => {
        const [found] = await rows.range('outbox', {index: 'opId', eq: [opId]})
        if (!found) return
        const op = outboxOfRow(found)
        const attempts = status === 'sending' ? op.attempts + 1 : op.attempts
        await rows.put('outbox', outboxRow({...op, status, attempts, lastError: status === 'failed' ? (info.error ?? 'failed') : null}))
        const e = await loadEntity(rows, op.entityType, op.entityId)
        if (!e) return
        if (status === 'sending') await setSync(rows, recorder, e, {syncStatus: 'syncing'})
        else if (status === 'failed') await setSync(rows, recorder, e, {syncStatus: 'failed', syncError: info.error ?? 'failed'})
        else if (status === 'queued') await setSync(rows, recorder, e, {syncStatus: 'pending', syncError: null})
        else if (status === 'acked') {
          // Later ops for the row are still waiting: it stays pending.
          const later = (await rows.range('outbox', {index: 'byEntity', eq: [op.entityType, op.entityId], min: op.seq! + 1})).some(r => r.status !== 'acked')
          if (later) await setSync(rows, recorder, e, {syncStatus: 'pending'})
          else await setSync(rows, recorder, e, {syncStatus: 'synced', syncError: null, serverVersion: info.serverVersion ?? e.version, syncedAt: info.at ?? e.updatedAt})
        }
      }),

    rebuildProjections: () => write(rows => rebuildProjections(rows, type => allOf(rows, type))),

    dump: () =>
      read(async rows => ({
        entities: (await Promise.all(ENTITY_TYPES.map(type => allOf(rows, type)))).flat(),
        history: (await rows.range('history', {})).map(historyOfRow),
        outbox: (await rows.range('outbox', {})).map(outboxOfRow),
      })),

    erase: refs =>
      write(async (rows, recorder) => {
        let isMoney = false
        /* A disputed record takes its disputes with it (they name something that is gone): same call, same transaction. */
        const named = new Set(refs.map(r => `${r.type}:${r.id}`))
        const extra: Array<{type: EntityType; id: string}> = []
        for (const {type, id} of refs)
          if ((MONEY_TYPES as readonly string[]).includes(type))
            for (const d of await rows.range('disputes', {index: 'byTarget', eq: [type, id]})) if (!named.has(`dispute:${d.id as string}`)) extra.push({type: 'dispute', id: d.id as string})
        for (const {type, id} of [...extra, ...refs]) {
          recorder.record(type, id)
          const prev = await loadEntity(rows, type, id)
          await rows.delete(ENTITY_STORE[type], [id])
          if (prev) await projectEntity(rows, prev, undefined)
          for (const h of await rows.range('history', {eq: [type, id]})) await rows.delete('history', [type, id, h.version as number])
          for (const o of await rows.range('outbox', {index: 'byEntity', eq: [type, id]})) await rows.delete('outbox', [o.seq as number])
          // A person who goes ("me" included) changes whose records count as activity (audit m20) as well as a record.
          isMoney ||= type === 'person' || (MONEY_TYPES as readonly string[]).includes(type)
        }
        // What was erased no longer counts as anyone's activity: recompute it from what remains.
        if (isMoney) await rebuildActivity(rows, (await Promise.all(MONEY_TYPES.map(type => allOf(rows, type)))).flat())
      }),

    subscribe(fn) {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    close: () => engine.close(),
  }
}
