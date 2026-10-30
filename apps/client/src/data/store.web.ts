import {openIdbStore, type StorageNotices, type Store} from '@splito/sync'

/** Web durable store: IndexedDB. Asks the browser not to evict it under storage pressure. */
/** `name` picks the IndexedDB database (`splito` is the real data; the dev and e2e demo mode opens its own). */
export async function openStore(notices?: StorageNotices, name = 'splito'): Promise<Store> {
  void navigator.storage?.persist?.()
  return openIdbStore(name, undefined, notices)
}

/** Deletes a database for good (the demo one, when demo mode goes off). Its connection must be closed first; a blocked delete finishes when the last connection closes. */
export function deleteStore(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(name)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

/** Whether a database of that name exists (a check that creates nothing: opening would). Browsers without `databases()` say no. */
export async function storeExists(name: string): Promise<boolean> {
  try {
    return (await indexedDB.databases()).some(d => d.name === name)
  } catch {
    return false
  }
}
