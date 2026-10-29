import {deleteDatabaseAsync, openDatabaseAsync, type SQLiteStatement} from 'expo-sqlite'
import {openSqlStore, type SqlExecutor, type StorageNotices, type Store} from '@splito/sync'

/** Native durable store: expo-sqlite behind the shared SqlStore. SQLite is one process, so there is never another tab to wait for or to be replaced by. */
/** `name` picks the file (`splito` is the real data; the dev and e2e demo mode opens its own, `{name}.db`). */
export async function openStore(_notices?: StorageNotices, name = 'splito'): Promise<Store> {
  const db = await openDatabaseAsync(`${name}.db`)
  await db.execAsync('PRAGMA journal_mode = WAL')
  /*
   * Inside a transaction the statements run through expo-sqlite's synchronous API: every async call is a hop to
   * the native queue and back (~0.14 ms), and seeding the demo set is ~38,000 statements, 5.5 s of hops against
   * ~1.4 s on web. The connection is the transaction's own (openSqlStore queues every transaction and read, so
   * nothing else touches it meanwhile) and each statement is a small row write, so the JS thread is held only
   * for the transaction's length. Outside one, reads and writes stay async (a long page read must not block).
   */
  let isInTransaction = false
  /* The statements are a small fixed set (one per store and operation): prepared once, then only rebound. */
  const prepared = new Map<string, SQLiteStatement>()
  const statement = (sql: string) => {
    let st = prepared.get(sql)
    if (!st) prepared.set(sql, (st = db.prepareSync(sql)))
    return st
  }
  const runSync = (sql: string, params: unknown[]) => statement(sql).executeSync(params as never[]).resetSync()
  const allSync = (sql: string, params: unknown[]) => {
    const result = statement(sql).executeSync(params as never[])
    try {
      return result.getAllSync()
    } finally {
      result.resetSync()
    }
  }
  const exec: SqlExecutor = {
    exec: sql => db.execAsync(sql),
    run: async (sql, params) => {
      if (isInTransaction) runSync(sql, params)
      else await db.runAsync(sql, params as never[])
    },
    all: async <R,>(sql: string, params: unknown[]) =>
      (isInTransaction ? allSync(sql, params) : await db.getAllAsync(sql, params as never[])) as R[],
    // Plain BEGIN/COMMIT on the shared connection; openSqlStore queues transactions and reads so they never overlap.
    withTransaction: async fn => {
      let result!: Awaited<ReturnType<typeof fn>>
      await db.withTransactionAsync(async () => {
        isInTransaction = true
        try {
          result = await fn()
        } finally {
          isInTransaction = false
        }
      })
      return result
    },
    close: async () => {
      for (const st of prepared.values()) st.finalizeSync()
      prepared.clear()
      await db.closeAsync()
    },
  }
  return openSqlStore(exec)
}

/** Deletes a database file for good (the demo one, when demo mode goes off). Its connection must be closed first. */
export async function deleteStore(name: string): Promise<void> {
  await deleteDatabaseAsync(`${name}.db`)
}
