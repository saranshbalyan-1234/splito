import {useEffect, useState} from 'react'
import {type LedgerRecord} from '@splito/domain'
import {
  type Entity,
  type EntityType,
  getPref,
  loadLedger,
  type MutationCtx,
  type Person,
  type PrefKey,
  type PrefValue,
  setPref,
  type Store,
} from '@splito/sync'

import {useData} from '#/data/StoreProvider'

export function useStore(): Store {
  return useData().store
}

export function useMutationCtx(): MutationCtx {
  return useData().ctx
}

/**
 * Re-runs `load` after every committed store transaction (and on changes from
 * other tabs). Returns undefined until the first load resolves.
 */
function useLive<T>(load: (store: Store) => Promise<T>): T | undefined {
  const store = useStore()
  const [value, setValue] = useState<T>()
  useEffect(() => {
    let cancelled = false
    const run = () =>
      void load(store).then(v => {
        if (!cancelled) setValue(v)
      })
    run()
    const off = store.subscribe(run)
    return () => {
      cancelled = true
      off()
    }
    // `load` is a stable module-level function or recreated per type key only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store])
  return value
}

/** Live list of non-deleted entities of one type. Undefined while loading. */
export function useEntities<T>(type: EntityType): Entity<T>[] | undefined {
  const all = useLive(store => store.getAll<T>(type))
  return all?.filter(e => !e.deleted)
}

/** Live ledger records (tombstoned records included, flagged `deleted`). */
export function useLedger(): LedgerRecord[] | undefined {
  return useLive(loadLedger)
}

export function useMe(): Entity<Person> | undefined {
  const {actor} = useMutationCtx()
  return useEntities<Person>('person')?.find(p => p.id === actor)
}

/** Live preference value (default until loaded) plus a validated setter. */
export function usePref<K extends PrefKey>(key: K): [PrefValue<K> | undefined, (v: PrefValue<K>) => Promise<void>] {
  const {store, ctx} = useData()
  const value = useLive(s => getPref(s, key))
  return [value, v => setPref(store, ctx, key, v)]
}
