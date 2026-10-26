import {createContext, useContext, useEffect, useState} from 'react'
import {randomUUID} from 'expo-crypto'
import {ensureMe, type MutationCtx, type Store} from '@splito/sync'

import {logger} from '#/logger'
import {device} from '#/storage'
import {seedDemoIfRequested} from '#/data/demo'
import {installDevTools} from '#/data/devTools'
import {openStore} from '#/data/store'

type DataContext = {store: Store; ctx: MutationCtx}

const Context = createContext<DataContext | null>(null)
Context.displayName = 'SplitoDataContext'

/** Stable per-install ids, read synchronously from device storage. */
function getMutationCtx(): MutationCtx {
  let deviceId = device.get(['deviceId'])
  if (!deviceId) {
    deviceId = randomUUID()
    device.set(['deviceId'], deviceId)
  }
  let actor = device.get(['meId'])
  if (!actor) {
    actor = randomUUID()
    device.set(['meId'], actor)
  }
  return {deviceId, actor, now: () => Date.now(), newId: () => randomUUID()}
}

/** Opens the local store and ensures the "me" person exists before rendering children. */
export function StoreProvider({children, fallback = null}: {children: React.ReactNode; fallback?: React.ReactNode}) {
  const [value, setValue] = useState<DataContext | null>(null)
  const [error, setError] = useState<unknown>(null)

  useEffect(() => {
    let store: Store | undefined
    const ctx = getMutationCtx()
    openStore()
      .then(async s => {
        store = s
        await ensureMe(s, ctx, 'Me')
        installDevTools(s, ctx)
        await seedDemoIfRequested(s, ctx)
        setValue({store: s, ctx})
      })
      .catch(e => {
        logger.error(e, {where: 'StoreProvider.open'})
        setError(e)
      })
    return () => {
      void store?.close()
    }
  }, [])

  if (error) throw error
  if (!value) return fallback
  return <Context.Provider value={value}>{children}</Context.Provider>
}

export function useData(): DataContext {
  const v = useContext(Context)
  if (!v) throw new Error('useData outside StoreProvider')
  return v
}
