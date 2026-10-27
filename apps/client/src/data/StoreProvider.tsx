import {createContext, useCallback, useContext, useEffect, useMemo, useRef, useState} from 'react'
import {AppState} from 'react-native'
import {randomUUID} from 'expo-crypto'
import {ensureMe, type MutationCtx, prefFrom, type Store} from '@splito/sync'

import {StorageNotice} from '#/components/StorageNotice'
import {perfMark} from '#/lib/perfMark'
import {flush, logger, setDiagnosticsEnabled, setTelemetryIdentity} from '#/logger'
import {device, setStorageScope} from '#/storage'
import {installDevTools} from '#/data/devTools'
import {setDirectory} from '#/data/friends'
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

/**
 * Dev and e2e builds only: demo mode (ARCHITECTURE 26.1) is loaded on demand
 * under a condition Metro folds at build time (`__DEV__` and the inlined
 * `EXPO_PUBLIC_ENV`; an imported constant would not fold), so a production
 * bundle holds none of it.
 */
const loadDemo =
  __DEV__ || process.env.EXPO_PUBLIC_ENV === 'e2e'
    ? () => import('#/data/demoMode')
    : null

/** What the switch exposes. Production: always off, nothing to switch. */
export type DemoModeValue = {
  /** The app is on the separate demo database. */
  demo: boolean
  /** A switch or a reset is running. */
  busy: boolean
  /** Turns demo mode on (seeding it the first time) or off; resolves when the other store is showing. */
  setDemo: (on: boolean, onProgress?: (done: number) => void) => Promise<void>
  /** Wipes the demo database and seeds it again. */
  resetDemo: (onProgress?: (done: number) => void) => Promise<void>
}

const OFF: DemoModeValue = {demo: false, busy: false, setDemo: async () => {}, resetDemo: async () => {}}
const DemoContext = createContext<DemoModeValue>(OFF)
DemoContext.displayName = 'SplitoDemoModeContext'

/** A store that is open and showing, with what to undo when it goes. */
type Live = DataContext & {demo: boolean; unwire: () => void}

/**
 * Opens the local store and ensures the "me" person exists before rendering
 * children. In dev and e2e builds it can swap to the separate demo database and
 * back (`setDemo`): the new store is opened and ready first, then it replaces
 * the old one in the one context value and the old connection is closed. The
 * tree never remounts (§ 3 "Root contexts stay still").
 */
export function StoreProvider({children, fallback = null}: {children: React.ReactNode; fallback?: React.ReactNode}) {
  const [value, setValue] = useState<DataContext | null>(null)
  const [demo, setDemoFlag] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  /* Web only: another tab holds an older version open (`blocked`), or a newer build took the database over (`changed`). */
  const [notice, setNotice] = useState<'blocked' | 'changed' | null>(null)
  const live = useRef<Live | null>(null)
  const booted = useRef<Promise<void>>(Promise.resolve())
  const notices = useRef({onBlocked: () => setNotice('blocked'), onVersionChange: () => setNotice('changed')})

  /** Makes `next` the store everything reads, then closes the one it replaces (after in-flight reads have landed). */
  const adopt = useCallback((next: DataContext & {demo: boolean}) => {
    const prev = live.current
    prev?.unwire()
    // Telemetry follows the real store; demo mode records nothing (and `Send diagnostics` is the real one's setting).
    const unwire = next.demo ? (setDiagnosticsEnabled(false), () => {}) : wireTelemetry(next.store, next.ctx)
    live.current = {...next, unwire}
    installDevTools(next.store, next.ctx)
    perfMark('splito:store-adopt')
    setValue({store: next.store, ctx: next.ctx})
    setDemoFlag(next.demo)
    setNotice(current => (current === 'blocked' ? null : current))
    if (prev) setTimeout(() => void prev.store.close(), 300)
  }, [])

  /** The real store. `ensure: false` skips the "me" write for a start that is about to open the demo database instead. */
  const openReal = useCallback(async (ensure = true) => {
    const ctx = getMutationCtx()
    const store = await openStore(notices.current)
    try {
      if (ensure) await ensureMe(store, ctx, 'Me')
    } catch (e) {
      void store.close()
      throw e
    }
    return {store, ctx}
  }, [])

  useEffect(() => {
    let cancelled = false
    perfMark('splito:store-open')
    booted.current = (async () => {
      const real = await openReal(!loadDemo)
      /* Dev StrictMode mounts twice: a store opened for the discarded mount is closed, never used. */
      if (cancelled) return void real.store.close()
      /*
       * Only the one preference row is read here, inline under the folded dev/e2e condition (the key is
       * `demoMode.ts`'s MODE_ID), so a start in real mode never waits for the demo chunk.
       */
      const demoOn =
        (__DEV__ || process.env.EXPO_PUBLIC_ENV === 'e2e') &&
        (await real.store.get<{value: unknown}>('preference', 'demo.mode'))?.data.value === true
      if (demoOn && loadDemo) {
        // A reload keeps the mode: the real database said so; the demo one opens, the real one closes.
        const m = await loadDemo()
        const opened = await m.openDemo(real.ctx, notices.current)
        if (cancelled) return void Promise.all([opened.store.close(), real.store.close()])
        adopt({...opened, demo: true})
        setTimeout(() => void real.store.close(), 300)
      } else {
        if (loadDemo) await ensureMe(real.store, real.ctx, 'Me')
        adopt({...real, demo: false})
        // Fetch the demo chunk in the background so the first switch does not wait for it.
        void loadDemo?.()
      }
      perfMark('splito:store-ready')
    })().catch(e => {
      logger.error(e, {where: 'StoreProvider.open'})
      setError(e)
    })
    return () => {
      cancelled = true
      const cur = live.current
      live.current = null
      cur?.unwire()
      void cur?.store.close()
    }
  }, [adopt, openReal])

  /* A switch and a reset never overlap: each waits for the one before it (a double tap, the e2e hook, a banner press). */
  const queue = useRef<Promise<unknown>>(Promise.resolve())
  const pending = useRef(0)
  const serial = useCallback(<T,>(work: () => Promise<T>): Promise<T> => {
    pending.current++
    setBusy(true)
    const run = queue.current.then(work)
    queue.current = run.then(
      () => undefined,
      () => undefined,
    )
    return run.finally(() => {
      if (--pending.current === 0) setBusy(false)
    })
  }, [])

  const setDemo = useCallback(
    (on: boolean, onProgress?: (done: number) => void) =>
      serial(async () => {
        await booted.current
        const cur = live.current
        if (!loadDemo || !cur || cur.demo === on) return
        const m = await loadDemo()
        if (on) {
          // Seeded and ready before anything changes; the real database learns of the mode last, so a failure leaves it untouched.
          const opened = await m.openDemo(cur.ctx, notices.current, onProgress)
          try {
            await m.writeDemoMode(cur.store, cur.ctx, true)
          } catch (e) {
            await opened.store.close()
            throw e
          }
          adopt({...opened, demo: true})
        } else {
          const real = await openReal()
          try {
            await m.writeDemoMode(real.store, real.ctx, false)
          } catch (e) {
            await real.store.close()
            throw e
          }
          setDirectory(null)
          setStorageScope('')
          adopt({...real, demo: false})
        }
      }),
    [adopt, openReal, serial],
  )

  const resetDemo = useCallback(
    (onProgress?: (done: number) => void) =>
      serial(async () => {
        await booted.current
        const cur = live.current
        if (!loadDemo || !cur?.demo) return
        const m = await loadDemo()
        await m.openDemo(cur.ctx, notices.current, onProgress, cur.store, true)
      }),
    [serial],
  )

  useEffect(() => {
    if (loadDemo) void loadDemo().then(m => m.installTestHook(setDemo))
  }, [setDemo])

  const demoValue = useMemo<DemoModeValue>(() => (loadDemo ? {demo, busy, setDemo, resetDemo} : OFF), [demo, busy, setDemo, resetDemo])

  if (error) throw error
  /* The connection of a replaced tab is closed: nothing can be read or saved until it reloads. */
  if (notice === 'changed') return <StorageNotice kind="changed" onReload={() => globalThis.location?.reload()} />
  if (!value) return notice === 'blocked' ? <StorageNotice kind="blocked" onReload={() => globalThis.location?.reload()} /> : fallback
  return (
    <Context.Provider value={value}>
      <DemoContext.Provider value={demoValue}>{children}</DemoContext.Provider>
    </Context.Provider>
  )
}

/** Whether demo mode is showing, and the switch (always off and inert in production builds). */
export function useDemoMode(): DemoModeValue {
  return useContext(DemoContext)
}

export function useData(): DataContext {
  const v = useContext(Context)
  if (!v) throw new Error('useData outside StoreProvider')
  return v
}
