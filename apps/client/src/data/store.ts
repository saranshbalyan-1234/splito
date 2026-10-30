import {File} from 'expo-file-system'
import {defaultDatabaseDirectory, deleteDatabaseAsync, openDatabaseAsync} from 'expo-sqlite'
import {openSqlStore, type StorageNotices, type Store} from '@splito/sync'

import {createSqlExecutor} from '#/data/sqliteExecutor'

/** Native durable store: expo-sqlite behind the shared SqlStore. SQLite is one process, so there is never another tab to wait for or to be replaced by. */
/** `name` picks the file (`splito` is the real data; the dev and e2e demo mode opens its own, `{name}.db`). */
export async function openStore(_notices?: StorageNotices, name = 'splito'): Promise<Store> {
  const db = await openDatabaseAsync(`${name}.db`)
  await db.execAsync('PRAGMA journal_mode = WAL')
  const exec = createSqlExecutor(db)
  return openSqlStore(exec)
}

/** Deletes a database file for good (the demo one, when demo mode goes off). Its connection must be closed first. */
export async function deleteStore(name: string): Promise<void> {
  await deleteDatabaseAsync(`${name}.db`)
}

/** Whether a database of that name exists (a check that creates nothing: opening would). */
export async function storeExists(name: string): Promise<boolean> {
  try {
    const dir = defaultDatabaseDirectory
    return new File(dir.startsWith('file:') ? dir : `file://${dir}`, `${name}.db`).exists
  } catch {
    return false
  }
}
