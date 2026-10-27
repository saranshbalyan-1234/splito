import {getPwa, isIosDevice, setPwa} from '#/lib/pwa/state'
import {IS_E2E} from '#/env'

export {usePwa} from '#/lib/pwa/state'
export {hasWorkAtStake, useWorkAtStake} from '#/lib/pwa/workAtStake'

/** Chrome's install event; not in lib.dom. */
type InstallPromptEvent = Event & {
  prompt(): Promise<void>
  userChoice: Promise<{outcome: 'accepted' | 'dismissed'}>
}

const UPDATE_CHECK_MS = 60 * 60 * 1000

let deferredPrompt: InstallPromptEvent | null = null
let registration: ServiceWorkerRegistration | undefined
let isStarted = false

/**
 * Called once from the web entry, before React, so the browser's one-shot
 * `beforeinstallprompt` is never missed. The service worker registers only in
 * production builds (not dev, not e2e); install state is tracked everywhere.
 */
export function startPwa() {
  if (isStarted) return
  isStarted = true
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as {standalone?: boolean}).standalone === true
  setPwa({
    isStandalone,
    installKind:
      !isStandalone &&
      isIosDevice(
        navigator.userAgent,
        navigator.platform,
        navigator.maxTouchPoints,
      )
        ? 'ios'
        : null,
  })
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault()
    deferredPrompt = e as InstallPromptEvent
    setPwa({installKind: 'prompt'})
  })
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    setPwa({installKind: null, isStandalone: true, isHelpOpen: false})
  })
  if ('serviceWorker' in navigator && !__DEV__ && !IS_E2E) {
    if (document.readyState === 'complete') void register()
    else window.addEventListener('load', () => void register(), {once: true})
  }
}

async function register() {
  try {
    const reg = await navigator.serviceWorker.register('/sw.js', {scope: '/'})
    registration = reg
    /* A worker that finishes installing while another controls the page is an update. */
    const watch = (worker: ServiceWorker) =>
      worker.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller)
          setPwa({updateReady: true})
      })
    if (reg.waiting && navigator.serviceWorker.controller)
      setPwa({updateReady: true})
    if (reg.installing) watch(reg.installing)
    reg.addEventListener(
      'updatefound',
      () => reg.installing && watch(reg.installing),
    )
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible')
        void reg.update().catch(() => {})
    })
    setInterval(() => void reg.update().catch(() => {}), UPDATE_CHECK_MS)
  } catch {
    /* No worker means no offline shell, nothing else: the app still runs. */
  }
}

/**
 * Switch to the waiting version and reload once it takes over. Only ever
 * called from a tap on the toast (after the work-at-stake check), never on
 * its own: other tabs keep running until their person reloads them.
 */
export function applyUpdate() {
  const waiting = registration?.waiting
  if (!waiting) {
    window.location.reload()
    return
  }
  navigator.serviceWorker.addEventListener(
    'controllerchange',
    () => window.location.reload(),
    {once: true},
  )
  waiting.postMessage({type: 'SKIP_WAITING'})
}

/** Install: the browser prompt where there is one, else the "Add to Home Screen" steps. */
export async function install(): Promise<
  'accepted' | 'dismissed' | 'help' | 'unavailable'
> {
  if (deferredPrompt) {
    const event = deferredPrompt
    /* The browser allows one prompt per event; it fires a fresh event later if the person said no. */
    deferredPrompt = null
    setPwa({installKind: null})
    await event.prompt()
    return (await event.userChoice).outcome
  }
  if (getPwa().installKind === 'ios') {
    setPwa({isHelpOpen: true})
    return 'help'
  }
  return 'unavailable'
}
