import {openIdbStore, type StorageNotices, type Store} from '@splito/sync'

/** Web durable store: IndexedDB. Asks the browser not to evict it under storage pressure. */
/** `name` picks the IndexedDB database (`splito` is the real data; the dev and e2e demo mode opens its own). */
export async function openStore(notices?: StorageNotices, name = 'splito'): Promise<Store> {
  void navigator.storage?.persist?.()
  return openIdbStore(name, undefined, notices)
}
