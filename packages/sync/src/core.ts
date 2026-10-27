/**
 * The store both engines share (ARCHITECTURE 9.8): entity/row mapping, the
 * transaction (entity + projections + history + outbox), typed index reads,
 * sync-state moves and maintenance, all built on `RowAccess`. An engine
 * (`idbStore.ts`, `sqlStore.ts`) only implements rows, indexes and
 * transactions, so one contract test covers both and they cannot differ.
 */
import {type Engine, type RowAccess} from './engine'
import {projectEntity, rebuildProjections} from './ledgerProjection'
import {
  completeEntity,
  ENTITY_STORE,
  ENTITY_TYPES,
  entityOfRow,
  historyOfRow,
  historyRow,
  indexKey,
  type Key,
  outboxOfRow,
  outboxRow,
  type Row,
  rowOfEntity,
  type StoreName,
  STORES,
} from './schema'
import {transactionRows} from './txRows'
import {changeRecorder, DEFAULT_PAGE, type ExpenseParty, type GroupMember, type NetBalance, type Page, type PageQuery, type PairBalance, type Store, type StoreChange, type Tx} from './store'
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

/** Writes an entity row; a group keeps the activity time its records have raised. */
async function writeEntity(rows: RowAccess, next: Entity, prevRow?: Row) {
  const row = rowOfEntity(next)
  if (next.type === 'group') row.activityAt = Math.max((prevRow?.activityAt as number | undefined) ?? 0, next.updatedAt)
  await rows.put(ENTITY_STORE[next.type], row)
}

/** Changes only an entity's sync fields (its relation rows follow). */
async function setSync(rows: RowAccess, e: Entity, sync: Partial<Pick<Entity, 'syncStatus' | 'syncError' | 'serverVersion' | 'syncedAt'>>) {
  const next: Entity = {...e, ...sync}
  await writeEntity(rows, next, await rows.get(ENTITY_STORE[e.type], [e.id]))
  await projectEntity(rows, e, next)
}

/** Every row of an entity type, by id. */
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
    async enqueue(op) {
      await rows.add('outbox', outboxRow(op))
      // The row waits for the server from the moment its op is queued.
      const e = await loadEntity(rows, op.entityType, op.entityId)
      if (e && e.syncStatus !== 'pending') await setSync(rows, e, {syncStatus: 'pending', syncError: null})
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

const toPair = (r: Row): PairBalance => ({personId: r.personId as string, otherId: r.otherId as string, currency: r.currency as string, amount: BigInt(r.amount as string)})

/** One page of `store` rows: reads `limit + 1` so the cursor is exact. */
async function pageOf<T>(rows: RowAccess, store: StoreName, q: PageQuery, map: (r: Row) => T): Promise<Page<T>> {
  const limit = q.limit ?? DEFAULT_PAGE
  const found = await rows.range(store, {index: q.index, eq: q.eq, min: q.min, max: q.max, after: q.after, dir: q.dir, limit: limit + 1})
  const more = found.length > limit
  const slice = more ? found.slice(0, limit) : found
  return {items: slice.map(map), next: more ? indexKey(store, q.index, slice[slice.length - 1]!) : null}
}

export function createStore(engine: Engine): Store {
  const listeners = new Set<(change: StoreChange) => void>()
  const notify = (change: StoreChange) => listeners.forEach(l => l(change))
  engine.remote?.listen(notify)
  const read = <T>(fn: (rows: RowAccess) => Promise<T>) => engine.run('ro', fn)
  const write = async <T>(fn: (rows: RowAccess, recorder: ReturnType<typeof changeRecorder>) => Promise<T>) => {
    const recorder = changeRecorder()
    const result = await engine.run('rw', async raw => {
      const tx = transactionRows(raw)
      const done = await fn(tx.rows, recorder)
      await tx.flush()
      return done
    })
    const change = recorder.change()
    notify(change)
    engine.remote?.post(change)
    return result
  }

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

    parties: q => read(rows => pageOf(rows, 'expense_parties', q, toParty)),

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

    pairBalances: personId => read(async rows => (await rows.range('pair_balances', {eq: [personId]})).map(toPair)),

    lastActivity: personIds =>
      read(async rows => {
        const latest = new Map<string, string>()
        const keep = (id: string, date: string) => {
          if (date && (latest.get(id) ?? '') < date) latest.set(id, date)
        }
        for (const id of personIds) {
          // Parties exist for live expenses only; payments and write-offs need a live check.
          const [p] = await rows.range('expense_parties', {index: 'byPersonDate', eq: [id], dir: 'prev', limit: 1})
          if (p) keep(id, p.date as string)
          for (const store of ['repayments', 'writeoffs'] as const) {
            for (const index of ['byFrom', 'byTo'] as const) {
              let after: Key | null = null
              for (;;) {
                const batch: Row[] = await rows.range(store, {index, eq: [id], dir: 'prev', limit: 20, after})
                const hit = batch.find(r => !r.deleted)
                if (hit) keep(id, hit.date as string)
                if (hit || batch.length < 20) break
                after = indexKey(store, index, batch[batch.length - 1]!)
              }
            }
          }
        }
        return latest
      }),

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
      write(async rows => {
        const [found] = await rows.range('outbox', {index: 'opId', eq: [opId]})
        if (!found) return
        const op = outboxOfRow(found)
        const attempts = status === 'sending' ? op.attempts + 1 : op.attempts
        await rows.put('outbox', outboxRow({...op, status, attempts, lastError: status === 'failed' ? (info.error ?? 'failed') : null}))
        const e = await loadEntity(rows, op.entityType, op.entityId)
        if (!e) return
        if (status === 'sending') await setSync(rows, e, {syncStatus: 'syncing'})
        else if (status === 'failed') await setSync(rows, e, {syncStatus: 'failed', syncError: info.error ?? 'failed'})
        else if (status === 'queued') await setSync(rows, e, {syncStatus: 'pending', syncError: null})
        else if (status === 'acked') {
          // Later ops for the row are still waiting: it stays pending.
          const later = (await rows.range('outbox', {index: 'byEntity', eq: [op.entityType, op.entityId], min: op.seq! + 1})).some(r => r.status !== 'acked')
          if (later) await setSync(rows, e, {syncStatus: 'pending'})
          else await setSync(rows, e, {syncStatus: 'synced', syncError: null, serverVersion: info.serverVersion ?? e.version, syncedAt: info.at ?? e.updatedAt})
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
        for (const {type, id} of refs) {
          recorder.record(type, id)
          const prev = await loadEntity(rows, type, id)
          await rows.delete(ENTITY_STORE[type], [id])
          if (prev) await projectEntity(rows, prev, undefined)
          for (const h of await rows.range('history', {eq: [type, id]})) await rows.delete('history', [type, id, h.version as number])
          for (const o of await rows.range('outbox', {index: 'byEntity', eq: [type, id]})) await rows.delete('outbox', [o.seq as number])
        }
      }),

    subscribe(fn) {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    close: () => engine.close(),
  }
}
