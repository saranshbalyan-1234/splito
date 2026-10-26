import {type IDBPDatabase, type IDBPTransaction, wrap} from 'idb'

import {decode, encode} from './codec'
import type {Store, Tx} from './store'
import type {Entity, EntityType, HistoryRow, OutboxOp} from './types'

const STORES = ['entities', 'history', 'outbox'] as const
type Stores = typeof STORES
const CHANNEL = 'splito-store'

type EntityRec = Omit<Entity, 'data'> & {data: string}
type HistoryRec = Omit<HistoryRow, 'data'> & {data: string}
type OutboxRec = Omit<OutboxOp, 'payload'> & {payload: string}

const toEntity = ({data, ...r}: EntityRec): Entity => ({...r, data: decode(data)})

export async function openIdbStore(name: string, factory: IDBFactory = indexedDB): Promise<Store> {
  const req = factory.open(name, 1)
  req.onupgradeneeded = e => {
    const raw = req.result
    if (e.oldVersion < 1) {
      raw.createObjectStore('entities', {keyPath: ['type', 'id']})
      raw.createObjectStore('history', {keyPath: ['entityType', 'entityId', 'version']})
      raw.createObjectStore('outbox', {keyPath: 'seq', autoIncrement: true}).createIndex('opId', 'opId', {unique: true})
    }
  }
  const db = (await wrap(req)) as IDBPDatabase

  const listeners = new Set<() => void>()
  const notify = () => listeners.forEach(l => l())
  const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(CHANNEL + ':' + name)
  if (channel) channel.onmessage = notify

  const makeTx = (t: IDBPTransaction<unknown, Stores, 'readwrite'>): Tx => ({
    async get<T>(type: EntityType, id: string) {
      const r = (await t.objectStore('entities').get([type, id])) as EntityRec | undefined
      return r ? (toEntity(r) as Entity<T>) : undefined
    },
    async put(e) {
      await t.objectStore('entities').put({...e, data: encode(e.data)} satisfies EntityRec)
    },
    async appendHistory(h) {
      await t.objectStore('history').add({...h, data: encode(h.data)} satisfies HistoryRec)
    },
    async enqueue({seq: _seq, ...o}) {
      await t.objectStore('outbox').add({...o, payload: encode(o.payload)})
    },
  })

  return {
    // fn may only await Tx calls: awaiting anything else lets IndexedDB auto-commit mid-transaction.
    async transaction(fn) {
      const t = db.transaction(STORES, 'readwrite')
      // Observe `done` now so an abort never surfaces as an unhandled rejection.
      const done = t.done.then(() => true, () => false)
      let result
      try {
        result = await fn(makeTx(t))
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
      notify()
      channel?.postMessage('changed')
      return result
    },
    async getAll<T>(type: EntityType) {
      const rows = (await db.getAll('entities', IDBKeyRange.bound([type], [type, []]))) as EntityRec[]
      return rows.map(toEntity) as Entity<T>[]
    },
    async history(type, id) {
      const rows = (await db.getAll('history', IDBKeyRange.bound([type, id], [type, id, []]))) as HistoryRec[]
      return rows.map(({data, ...r}) => ({...r, data: decode(data)}))
    },
    async outbox() {
      const rows = (await db.getAll('outbox')) as OutboxRec[]
      return rows.map(({payload, ...r}) => ({...r, payload: decode(payload)}))
    },
    subscribe(fn) {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    async close() {
      channel?.close()
      db.close()
    },
  }
}
