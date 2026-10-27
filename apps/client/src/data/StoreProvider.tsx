import {createContext, useContext, useEffect, useState} from 'react'
import {AppState} from 'react-native'
import {randomUUID} from 'expo-crypto'
import {ensureMe, type MutationCtx, prefFrom, type Store} from '@splito/sync'

import {StorageNotice} from '#/components/StorageNotice'
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
  /* Web only: another tab holds an older version open (`blocked`), or a newer build took the database over (`changed`). */
  const [notice, setNotice] = useState<'blocked' | 'changed' | null>(null)

  useEffect(() => {
    let store: Store | undefined
    let unwire: (() => void) | undefined
    let cancelled = false
    const ctx = getMutationCtx()
    perfMark('splito:store-open')
    openStore({
      onBlocked: () => setNotice('blocked'),
      onVersionChange: () => setNotice('changed'),
    })
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
        setNotice(current => (current === 'blocked' ? null : current))
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
  /* The connection of a replaced tab is closed: nothing can be read or saved until it reloads. */
  if (notice === 'changed') return <StorageNotice kind="changed" onReload={() => globalThis.location?.reload()} />
  if (!value) return notice === 'blocked' ? <StorageNotice kind="blocked" onReload={() => globalThis.location?.reload()} /> : fallback
  return <Context.Provider value={value}>{children}</Context.Provider>
}

export function useData(): DataContext {
  const v = useContext(Context)
  if (!v) throw new Error('useData outside StoreProvider')
  return v
}
