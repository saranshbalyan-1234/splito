import {createContext, useCallback, useContext, useEffect, useMemo, useRef, useState} from 'react'
import {AppState} from 'react-native'
import {randomUUID} from 'expo-crypto'
import {t} from '@lingui/core/macro'
import {type DirectoryClient, ensureMe, type MutationCtx, prefFrom, type Store} from '@splito/sync'

import {markLaunchReady} from '#/components/LaunchScreen'
import {StorageNotice} from '#/components/StorageNotice'
import * as Toast from '#/components/Toast'
import {perfMark} from '#/lib/perfMark'
import {resetToRoot} from '#/navigation/ref'
import {accountName} from '#/state/session'
import {DemoContext, type DemoModeValue, setDemoProgress} from '#/state/demo'
import {useDialogStateControlContext} from '#/state/dialogs'
import {flush, logger, setDiagnosticsEnabled, setTelemetryIdentity} from '#/logger'
import {accountScope, device, setStorageScope} from '#/storage'
import {installDevTools} from '#/data/devTools'
import {setDirectory} from '#/data/friends'
import {entitiesQuery, projectionFor} from '#/data/projections'
import {openStore} from '#/data/store'
import {accountStoreName, demoScope} from '#/data/storeNames'

type DataContext = {store: Store; ctx: MutationCtx}
/** A store ready to be shown: the demo one brings its directory (who is on Splito there). */
type Next = DataContext & {demo: boolean; directory?: DirectoryClient}

const Context = createContext<DataContext | null>(null)
Context.displayName = 'SplitoDataContext'

/** The account's own "me" id (minted once, kept per account; ARCHITECTURE 26.15). */
function meIdFor(accountId: string): string {
  const ids = JSON.parse(device.get(['meIds']) ?? '{}') as Record<string, string>
  if (!ids[accountId]) {
    ids[accountId] = randomUUID()
    device.set(['meIds'], JSON.stringify(ids))
  }
  return ids[accountId]
}

/** The device id (one per install) and the account's "me", read synchronously from device storage. */
function getMutationCtx(accountId: string): MutationCtx {
  let deviceId = device.get(['deviceId'])
  if (!deviceId) {
    deviceId = randomUUID()
    device.set(['deviceId'], deviceId)
  }
  const actor = meIdFor(accountId)
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
 * Every build, production included (owner 148): demo mode (ARCHITECTURE 26.1) is a lazy chunk loaded on demand,
 * so the start-up bundle holds none of it and a start in real mode never waits for it.
 */
const loadDemo = () => import('#/data/demoMode')

/* Accounts with a mounted provider, and the log outs waiting for one of them to finish closing its database. */
const mounted = new Set<string>()
const closeWaiters = new Map<string, Array<() => void>>()

/**
 * Log out calls this BEFORE it ends the session: the promise settles once every connection of that account's store
 * (the real one and a demo one, a switch's old store included) has been closed by `StoreProvider`'s cleanup, which is what
 * lets "Erase" delete the database afterwards. Settles at once when no provider is mounted for the account.
 */
export function expectStoreClosed(accountId: string): Promise<void> {
  if (!mounted.has(accountId)) return Promise.resolve()
  return new Promise(resolve => closeWaiters.set(accountId, [...(closeWaiters.get(accountId) ?? []), resolve]))
}

/** A store that is open and showing, with what to undo when it goes. */
type Live = DataContext & {demo: boolean; unwire: () => void}

/**
 * Opens the signed-in account's local store (one database per account, `accountStoreName`) and ensures the "me"
 * person exists before rendering children. It is mounted only while someone is signed in (`AuthGate`) and keyed
 * by the account, so signing out closes the database and another account opens its own. In dev and e2e builds it can swap to the separate demo database and
 * back (`setDemo`): the new store is opened and ready first, then it replaces
 * the old one in the one context value and the old connection is closed. The
 * tree never remounts (§ 3 "Root contexts stay still").
 */
export function StoreProvider({accountId, children, fallback = null}: {accountId: string; children: React.ReactNode; fallback?: React.ReactNode}) {
  const [value, setValue] = useState<DataContext | null>(null)
  const [demo, setDemoFlag] = useState(false)
  const [hasDirectory, setHasDirectory] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  /* Web only: another tab holds an older version open (`blocked`), or a newer build took the database over (`changed`). */
  const [notice, setNotice] = useState<'blocked' | 'changed' | null>(null)
  const live = useRef<Live | null>(null)
  /* Closes of replaced stores still on their timer: unmounting waits for them too. */
  const closingPrev = useRef(new Set<Promise<unknown>>())
  const booted = useRef<Promise<void>>(Promise.resolve())
  const notices = useRef({onBlocked: () => setNotice('blocked'), onVersionChange: () => setNotice('changed')})

  /*
   * Everything that belongs to a store changes in this one place, when the store is adopted and
   * never before (a switch that fails leaves the old store with its own directory and key scope):
   * telemetry, the directory that answers, the device-key scope, and, when a store is being
   * replaced, the UI that was built on the old one (open sheets and dialogs, pushed pages).
   */
  const closeAllDialogs = useDialogStateControlContext().closeAllDialogs
  const closeDialogs = useRef(closeAllDialogs)
  closeDialogs.current = closeAllDialogs

  /** What a person had open belongs to the store that is going away: shut it, back to the first tab. */
  const dropOpenUi = useCallback(() => {
    closeDialogs.current()
    resetToRoot()
  }, [])

  /** Makes `next` the store everything reads, then closes the one it replaces (after in-flight reads have landed); resolves when that is done. */
  const adopt = useCallback(
    (next: Next): Promise<void> => {
      const prev = live.current
      prev?.unwire()
      // Telemetry follows the real store; demo mode records nothing (and `Send diagnostics` is the real one's setting).
      const unwire = next.demo ? (setDiagnosticsEnabled(false), () => {}) : wireTelemetry(next.store, next.ctx)
      live.current = {...next, unwire}
      setDirectory(next.demo ? (next.directory ?? null) : null)
      // Search history, read marks, drafts and the first-frame copies of preferences typed in demo mode stay in demo mode.
      setStorageScope(next.demo ? demoScope(accountId) : accountScope(accountId))
      installDevTools(next.store, next.ctx)
      perfMark('splito:store-adopt')
      if (prev) dropOpenUi()
      setValue({store: next.store, ctx: next.ctx})
      setDemoFlag(next.demo)
      setHasDirectory(next.demo && !!next.directory)
      setNotice(current => (current === 'blocked' ? null : current))
      // Resolves once the replaced store's connection is closed (a database can only be deleted then).
      const closed = new Promise<void>(resolve => {
        if (prev) setTimeout(() => void prev.store.close().then(resolve, resolve), 300)
        else resolve()
      })
      closingPrev.current.add(closed)
      return closed
    },
    [accountId, dropOpenUi],
  )

  /** The real store. `ensure: false` skips the "me" write for a start that is about to open the demo database instead. */
  const openReal = useCallback(async (ensure = true) => {
    const ctx = getMutationCtx(accountId)
    const store = await openStore(notices.current, accountStoreName(accountId))
    try {
      if (ensure) await ensureMe(store, ctx, accountName(accountId))
    } catch (e) {
      void store.close()
      throw e
    }
    return {store, ctx}
  }, [accountId])

  useEffect(() => {
    let cancelled = false
    perfMark('splito:store-open')
    booted.current = (async () => {
      const real = await openReal(false)
      /* Dev StrictMode mounts twice: a store opened for the discarded mount is closed, never used. */
      if (cancelled) {
        await real.store.close()
        return
      }
      /*
       * Only the one preference row is read here (the key is `demoMode.ts`'s MODE_ID), so a start in real
       * mode never waits for the demo chunk.
       */
      const demoOn = (await real.store.get<{value: unknown}>('preference', 'demo.mode'))?.data.value === true
      const resumed = demoOn ? await (await loadDemo()).resumeDemo(accountId, real, notices.current) : null
      if (resumed) {
        // A reload keeps the mode: the real database said so; the demo one opens, the real one closes.
        if (cancelled) {
          await Promise.all([resumed.store.close(), real.store.close()])
          return
        }
        void adopt({...resumed, demo: true})
        closingPrev.current.add(new Promise<void>(resolve => setTimeout(() => void real.store.close().then(resolve, resolve), 300)))
      } else {
        await ensureMe(real.store, real.ctx, accountName(accountId))
        // Only ever on the real store, before anything can switch away from (and close) it: erase the rows older builds left in it, once.
        // The old ?demo rows only ever existed in dev and e2e builds; production skips the cleanup and its chunk.
        if ((__DEV__ || process.env.EXPO_PUBLIC_ENV === 'e2e') && !demoOn) await (await loadDemo()).purgeLegacy(real.store)
        void adopt({...real, demo: false})
        // The demo database would not open and the mode is now off: say so.
        if (demoOn) Toast.show(t`Couldn’t open the demo. Showing your own data.`, {type: 'error'})
      }
      perfMark('splito:store-ready')
    })().catch(e => {
      logger.error(e, {where: 'StoreProvider.open'})
      markLaunchReady() // a failed open never extends the launch screen (§ 8)
      setError(e)
    })
    const boot = booted.current
    const prevCloses = closingPrev.current
    mounted.add(accountId)
    return () => {
      cancelled = true
      const cur = live.current
      live.current = null
      cur?.unwire()
      mounted.delete(accountId)
      /* Everything that holds this account's database is closed before a waiting log out is told (a store still opening closes itself, `cancelled`). */
      void (async () => {
        await boot.catch(() => {})
        await Promise.allSettled([cur?.store.close(), ...prevCloses])
        for (const resolve of closeWaiters.get(accountId) ?? []) resolve()
        closeWaiters.delete(accountId)
      })()
    }
  }, [accountId, adopt, openReal])

  /* Switches never overlap: each waits for the one before it (a double tap, the e2e hook). */
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

  /** The progress of a seeding reaches the blocking dialog (and the caller's own callback, if any). */
  const withProgress = useCallback(<T,>(onProgress: ((done: number) => void) | undefined, run: (report: (done: number) => void) => Promise<T>) => {
    setDemoProgress(0)
    return run(done => {
      setDemoProgress(done)
      onProgress?.(done)
    }).finally(() => setDemoProgress(null))
  }, [])

  const setDemo = useCallback(
    (on: boolean, onProgress?: (done: number) => void) =>
      serial(() =>
        withProgress(onProgress, async report => {
          await booted.current
          const cur = live.current
          if (!cur || cur.demo === on) return
          const m = await loadDemo()
          if (on) {
            // Seeded and ready before anything changes; the real database learns of the mode last, so a failure leaves it untouched.
            const opened = await m.openDemo(accountId, cur.ctx, notices.current, report)
            try {
              await m.writeDemoMode(cur.store, cur.ctx, true)
            } catch (e) {
              await opened.store.close()
              throw e
            }
            void adopt({...opened, demo: true})
          } else {
            const real = await openReal()
            try {
              await m.writeDemoMode(real.store, real.ctx, false)
            } catch (e) {
              await real.store.close()
              throw e
            }
            // Back on the real data first; then the demo database and everything it kept are erased (owner 136).
            await adopt({...real, demo: false})
            await m.eraseDemo(accountId)
          }
        }),
      ),
    [accountId, adopt, openReal, serial, withProgress],
  )

  useEffect(() => {
    // The hook itself is e2e-only (installTestHook checks IS_E2E); production never loads the chunk for it.
    if (process.env.EXPO_PUBLIC_ENV === 'e2e') void loadDemo().then(m => m.installTestHook(setDemo))
  }, [setDemo])

  const demoValue = useMemo<DemoModeValue>(() => ({demo, hasDirectory, busy, setDemo}), [demo, hasDirectory, busy, setDemo])

  /* The launch screen ends when the app can show something: the store is open, or a notice explains why it is not. */
  const isLaunchOver = !!value || !!notice
  useEffect(() => {
    if (isLaunchOver) markLaunchReady()
  }, [isLaunchOver])

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

/** The open store, or null where none is (the signed-out screens): only shared primitives such as motion ask this way. */
export function useMaybeData(): DataContext | null {
  return useContext(Context)
}

export function useData(): DataContext {
  const v = useContext(Context)
  if (!v) throw new Error('useData outside StoreProvider')
  return v
}
