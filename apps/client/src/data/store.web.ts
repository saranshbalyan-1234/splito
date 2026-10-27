import {openIdbStore, type StorageNotices, type Store} from '@splito/sync'

/** Web durable store: IndexedDB. Asks the browser not to evict it under storage pressure. */
export async function openStore(notices?: StorageNotices): Promise<Store> {
  void navigator.storage?.persist?.()
  return openIdbStore('splito', undefined, notices)
}
