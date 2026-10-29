import {deleteDatabaseAsync, openDatabaseAsync} from 'expo-sqlite'
import {openSqlStore, type SqlExecutor, type StorageNotices, type Store} from '@splito/sync'

/** Native durable store: expo-sqlite behind the shared SqlStore. SQLite is one process, so there is never another tab to wait for or to be replaced by. */
/** `name` picks the file (`splito` is the real data; the dev and e2e demo mode opens its own, `{name}.db`). */
export async function openStore(_notices?: StorageNotices, name = 'splito'): Promise<Store> {
  const db = await openDatabaseAsync(`${name}.db`)
  await db.execAsync('PRAGMA journal_mode = WAL')
  const exec: SqlExecutor = {
    exec: sql => db.execAsync(sql),
    run: async (sql, params) => {
      await db.runAsync(sql, params as never[])
    },
    all: (sql, params) => db.getAllAsync(sql, params as never[]),
    // Plain BEGIN/COMMIT on the shared connection; openSqlStore queues transactions and reads so they never overlap.
    withTransaction: async fn => {
      let result!: Awaited<ReturnType<typeof fn>>
      await db.withTransactionAsync(async () => {
        result = await fn()
      })
      return result
    },
    close: () => db.closeAsync(),
  }
  return openSqlStore(exec)
}

/** Deletes a database file for good (the demo one, when demo mode goes off). Its connection must be closed first. */
export async function deleteStore(name: string): Promise<void> {
  await deleteDatabaseAsync(`${name}.db`)
}
