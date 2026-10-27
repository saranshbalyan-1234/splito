// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/storage/index.ts
import {useCallback, useEffect, useState} from 'react'
import {MMKV} from 'react-native-mmkv'

import {type Device} from '#/storage/schema'

export * from '#/storage/schema'

/*
 * Dev and e2e demo mode keeps its own search history, read marks and drafts:
 * while a prefix is set, the keys a storage lists as `scoped` live under it,
 * so nothing typed in demo mode shows up in the real data (ARCHITECTURE 26.1).
 * Production never sets one.
 */
let scope = ''
const scopeListeners = new Set<() => void>()
export function setStorageScope(prefix: string) {
  if (prefix === scope) return
  scope = prefix
  scopeListeners.forEach(l => l())
}

/**
 * Generic storage class. DO NOT use this directly. Instead, use the exported
 * storage instances below.
 */
export class Storage<Scopes extends unknown[], Schema> {
  protected sep = ':'
  protected store: MMKV
  /** The keys (or all of them) that follow the demo-mode scope. */
  protected scoped: 'all' | readonly string[]

  constructor({id, scoped = []}: {id: string; scoped?: 'all' | readonly string[]}) {
    this.store = new MMKV({id})
    this.scoped = scoped
  }

  protected keyOf(scopes: unknown[]): string {
    const key = scopes.join(this.sep)
    return scope && (this.scoped === 'all' || this.scoped.includes(String(scopes.at(-1)))) ? scope + key : key
  }

  /**
   * Store a value in storage based on scopes and/or keys
   *
   *   `set([key], value)`
   *   `set([scope, key], value)`
   */
  set<Key extends keyof Schema>(
    scopes: [...Scopes, Key],
    data: Schema[Key],
  ): void {
    // stored as `{ data: <value> }` structure to ease stringification
    this.store.set(this.keyOf(scopes), JSON.stringify({data}))
  }

  /**
   * Read the serialized `{data: value}` envelope without parsing it. Callers can
   * compare raw values before repeating expensive parsing or validation.
   */
  getRaw<Key extends keyof Schema>(
    scopes: [...Scopes, Key],
  ): string | undefined {
    return this.store.getString(this.keyOf(scopes))
  }

  /**
   * Get a value from storage based on scopes and/or keys
   *
   *   `get([key])`
   *   `get([scope, key])`
   */
  get<Key extends keyof Schema>(
    scopes: [...Scopes, Key],
  ): Schema[Key] | undefined {
    const res = this.getRaw(scopes)
    if (!res) return undefined
    // parsed from storage structure `{ data: <value> }`
    return JSON.parse(res).data
  }

  /**
   * Remove a value from storage based on scopes and/or keys
   *
   *   `remove([key])`
   *   `remove([scope, key])`
   */
  remove<Key extends keyof Schema>(scopes: [...Scopes, Key]) {
    this.store.delete(this.keyOf(scopes))
  }

  /**
   * Remove many values from the same storage scope by keys
   *
   *   `removeMany([], [key])`
   *   `removeMany([scope], [key])`
   */
  removeMany<Key extends keyof Schema>(scopes: [...Scopes], keys: Key[]) {
    keys.forEach(key => this.remove([...scopes, key]))
  }

  /**
   * For debugging purposes
   */
  removeAll() {
    this.store.clearAll()
  }

  /**
   * Fires a callback when the storage associated with a given key changes
   *
   * @returns Listener - call `remove()` to stop listening
   */
  addOnValueChangedListener<Key extends keyof Schema>(
    scopes: [...Scopes, Key],
    callback: () => void,
  ) {
    return this.store.addOnValueChangedListener(key => {
      if (key === this.keyOf(scopes)) {
        callback()
      }
    })
  }
}

type StorageSchema<T extends Storage<any, any>> =
  T extends Storage<any, infer U> ? U : never
type StorageScopes<T extends Storage<any, any>> =
  T extends Storage<infer S, any> ? S : never

/**
 * Hook to use a storage instance. Acts like a useState hook, but persists the
 * value in storage.
 */
export function useStorage<
  Store extends Storage<any, any>,
  Key extends keyof StorageSchema<Store>,
>(
  storage: Store,
  scopes: [...StorageScopes<Store>, Key],
): [
  StorageSchema<Store>[Key] | undefined,
  (data: StorageSchema<Store>[Key]) => void,
] {
  type Schema = StorageSchema<Store>
  const [value, setValue] = useState<Schema[Key] | undefined>(() =>
    storage.get(scopes),
  )

  useEffect(() => {
    const sub = storage.addOnValueChangedListener(scopes, () => {
      setValue(storage.get(scopes))
    })
    // Demo mode moves the scoped keys to another prefix: read again.
    const reread = () => setValue(storage.get(scopes))
    scopeListeners.add(reread)
    return () => {
      sub.remove()
      scopeListeners.delete(reread)
    }
  }, [storage, scopes])

  const setter = useCallback(
    (data: Schema[Key]) => {
      setValue(data)
      storage.set(scopes, data)
    },
    [storage, scopes],
  )

  return [value, setter] as const
}

/**
 * Device data that's specific to the device and does not vary based on account
 *
 *   `device.set([key], true)`
 */
export const device = new Storage<[], Device>({
  id: 'splito_device',
  scoped: ['searchHistory', 'activityFeed'],
})

/**
 * Account data that's specific to the account on this device
 */

if (__DEV__ && typeof window !== 'undefined') {
  // @ts-expect-error - dev global
  window.splito_storage = {device}
}
