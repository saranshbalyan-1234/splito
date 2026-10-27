import {createContext, useContext, useEffect, useState} from 'react'
import {AppState} from 'react-native'
import {randomUUID} from 'expo-crypto'
import {ensureMe, type MutationCtx, prefFrom, type Store} from '@splito/sync'

import {perfMark} from '#/lib/perfMark'
import {flush, logger, setDiagnosticsEnabled, setTelemetryIdentity} from '#/logger'
import {device} from '#/storage'
import {seedDemoIfRequested} from '#/data/demo'
import {installDevTools} from '#/data/devTools'
import {entitiesQuery, projectionFor} from '#/data/projections'
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

/*
 * Telemetry follows the store: the opaque install id, the Send diagnostics
 * preference (from the shared preference read), and a flush on going to the
 * background (16.2). Returns the cleanup.
 */
function wireTelemetry(store: Store, ctx: MutationCtx) {
  setTelemetryIdentity({installId: ctx.deviceId})
  const prefs = projectionFor(store, entitiesQuery<{value: unknown}>('preference'))
  const offPrefs = prefs.subscribe(() => setDiagnosticsEnabled(prefFrom(prefs.get() ?? [], 'sendDiagnostics')))
  const appState = AppState.addEventListener('change', state => {
    if (state === 'background') flush()
  })
  return () => {
    offPrefs()
    appState.remove()
  }
}

/** Opens the local store and ensures the "me" person exists before rendering children. */
export function StoreProvider({children, fallback = null}: {children: React.ReactNode; fallback?: React.ReactNode}) {
  const [value, setValue] = useState<DataContext | null>(null)
  const [error, setError] = useState<unknown>(null)

  useEffect(() => {
    let store: Store | undefined
    let unwire: (() => void) | undefined
    let cancelled = false
    const ctx = getMutationCtx()
    perfMark('splito:store-open')
    openStore()
      .then(async s => {
        /* Dev StrictMode mounts twice: a store opened for the discarded mount is closed, never used. */
        if (cancelled) {
          void s.close()
          return
        }
        store = s
        await ensureMe(s, ctx, 'Me')
        installDevTools(s, ctx)
        unwire = wireTelemetry(s, ctx)
        await seedDemoIfRequested(s, ctx)
        perfMark('splito:store-ready')
        setValue({store: s, ctx})
      })
      .catch(e => {
        logger.error(e, {where: 'StoreProvider.open'})
        setError(e)
      })
    return () => {
      cancelled = true
      unwire?.()
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
