import {type RowAccess} from './engine'
import {type Key, type Row, STORES, type StoreName} from './schema'

/** Projection sums: written once per transaction, however many records moved them. */
const DEFERRED = new Set<StoreName>(['balances', 'pair_balances'])

const idOf = (store: StoreName, key: Key) => store + '\u0000' + JSON.stringify(key)
const keyOf = (store: StoreName, row: Row): Key => STORES[store].key.map(c => row[c] as string | number)

/**
 * `RowAccess` for one write transaction. Reads are remembered (the
 * transaction is the only writer, so a row read or written once is known),
 * and writes to the projection sums are held and flushed once before the
 * commit: a batch of 150 expenses changes "me" 150 times but writes the row
 * once. Everything else writes through at once, so range reads (history,
 * outbox) always see it. Atomicity is the engine's: `flush` runs inside the
 * same transaction.
 */
export function transactionRows(rows: RowAccess) {
  const known = new Map<string, Row | undefined>()
  const held = new Map<string, {store: StoreName; key: Key; row?: Row}>()
  const access: RowAccess = {
    async get(store, key) {
      const id = idOf(store, key)
      if (known.has(id)) return known.get(id)
      const row = await rows.get(store, key)
      known.set(id, row)
      return row
    },
    async put(store, row) {
      const key = keyOf(store, row)
      const id = idOf(store, key)
      known.set(id, row)
      if (DEFERRED.has(store)) held.set(id, {store, key, row})
      else await rows.put(store, row)
    },
    async add(store, row) {
      await rows.add(store, row)
      // The outbox numbers its own rows: only keyed stores are remembered.
      if (!(STORES[store] as {auto?: boolean}).auto) known.set(idOf(store, keyOf(store, row)), row)
    },
    async delete(store, key) {
      const id = idOf(store, key)
      known.set(id, undefined)
      if (DEFERRED.has(store)) held.set(id, {store, key})
      else await rows.delete(store, key)
    },
    async clear(store) {
      for (const id of [...known.keys()]) if (id.startsWith(store + '\u0000')) known.delete(id)
      for (const [id, h] of [...held]) if (h.store === store) held.delete(id)
      await rows.clear(store)
    },
    // Reads of ranges never see held sums: nothing inside a transaction asks for them.
    range: (store, q) => rows.range(store, q),
    count: (store, q) => rows.count(store, q),
  }
  return {
    rows: access,
    /** Writes the held sums; call before the transaction ends. */
    async flush() {
      for (const {store, key, row} of held.values()) {
        if (row) await rows.put(store, row)
        else await rows.delete(store, key)
      }
      held.clear()
    },
  }
}
