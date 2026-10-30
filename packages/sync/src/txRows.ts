import {type RowAccess} from './engine'
import {type Key, type Row, STORES, type StoreName} from './schema'

/**
 * Rows a batch rewrites over and over, held and written once per transaction: the projection sums, and a person's or
 * group's activity time (every record raises it; the demo seed wrote it 8,500 times, a fifth of its requests).
 * Everything else writes through at once, so IndexedDB works on it while the JavaScript goes on: holding every
 * store left the database idle until the commit and made the seed slower, not faster.
 */
const HELD = new Set<StoreName>(['balances', 'pair_balances', 'aggregates', 'people', 'groups'])
const isAuto = (store: StoreName) => !!(STORES[store] as {auto?: boolean}).auto

const idOf = (store: StoreName, key: Key) => store + '\u0000' + JSON.stringify(key)
const keyOf = (store: StoreName, row: Row): Key => STORES[store].key.map(c => row[c] as string | number)

/**
 * `RowAccess` for one write transaction. Reads are remembered (the
 * transaction is the only writer, so a row read or written once is known),
 * and writes to the `HELD` stores are written once, the last one winning: a
 * batch of 150 expenses changes "me"'s balance and activity 150 times but writes
 * each row once. A range read or count, or an `add`, writes its store's held
 * rows first, so it always sees them; `flush` writes the rest before the commit.
 * Atomicity is the engine's: `flush` runs inside the same transaction.
 */
export function transactionRows(rows: RowAccess, {isPipelined = false}: {isPipelined?: boolean} = {}) {
  const known = new Map<string, Row | undefined>()
  /* Writes issued without waiting (IndexedDB runs them in order); the first failure is kept for `flush`. */
  const issued: Promise<void>[] = []
  let failure: { error: unknown } | undefined
  const write = (request: Promise<void>): Promise<void> => {
    if (!isPipelined) return request
    issued.push(request.catch(error => void (failure ??= {error})))
    return Promise.resolve()
  }
  /* Per store, by row: the last write of each row (a row, or undefined for a delete). */
  const held = new Map<StoreName, Map<string, {key: Key; row?: Row}>>()
  const hold = (store: StoreName, id: string, key: Key, row?: Row) => {
    let rowsOf = held.get(store)
    if (!rowsOf) held.set(store, (rowsOf = new Map()))
    rowsOf.set(id, {key, row})
  }
  const writeHeld = async (store: StoreName) => {
    const rowsOf = held.get(store)
    if (!rowsOf) return
    held.delete(store)
    for (const {key, row} of rowsOf.values()) await write(row ? rows.put(store, row) : rows.delete(store, key))
  }
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
      if (HELD.has(store)) hold(store, id, key, row)
      else await write(rows.put(store, row))
    },
    async add(store, row) {
      if (!isAuto(store)) await writeHeld(store)
      await write(rows.add(store, row))
      // The outbox numbers its own rows: only keyed stores are remembered.
      if (!isAuto(store)) known.set(idOf(store, keyOf(store, row)), row)
    },
    async delete(store, key) {
      const id = idOf(store, key)
      known.set(id, undefined)
      if (HELD.has(store)) hold(store, id, key)
      else await write(rows.delete(store, key))
    },
    async clear(store) {
      for (const id of [...known.keys()]) if (id.startsWith(store + '\u0000')) known.delete(id)
      held.delete(store)
      await write(rows.clear(store))
    },
    async range(store, q) {
      await writeHeld(store)
      return rows.range(store, q)
    },
    async count(store, q) {
      await writeHeld(store)
      return rows.count(store, q)
    },
  }
  return {
    rows: access,
    /**
     * The first pipelined write that failed, if any. When the transaction body
     * then throws something else (the abort surfacing under a later read), the
     * kept failure is the root cause and the one to report.
     */
    async failure() {
      await Promise.all(issued)
      return failure
    },
    /** Writes the held rows; call before the transaction ends. */
    async flush() {
      for (const store of [...held.keys()]) await writeHeld(store)
      await Promise.all(issued)
      if (failure) throw failure.error
    },
  }
}
