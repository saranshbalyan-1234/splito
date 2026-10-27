import {openDatabaseAsync} from 'expo-sqlite'
import {openSqlStore, type SqlExecutor, type StorageNotices, type Store} from '@splito/sync'

/** Native durable store: expo-sqlite behind the shared SqlStore. SQLite is one process, so there is never another tab to wait for or to be replaced by. */
export async function openStore(_notices?: StorageNotices): Promise<Store> {
  const db = await openDatabaseAsync('splito.db')
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
