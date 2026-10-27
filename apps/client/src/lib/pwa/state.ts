import {useSyncExternalStore} from 'react'

/** How this device can install Splito: the browser's own prompt, or by hand (iPhone and iPad have no prompt). */
export type InstallKind = 'prompt' | 'ios' | null

export type PwaState = {
  /** A new version is installed and waiting; the toast offers Reload. */
  updateReady: boolean
  installKind: InstallKind
  /** Already running as the installed app. */
  isStandalone: boolean
  /** The "Add to Home Screen" instructions sheet is wanted. */
  isHelpOpen: boolean
}

let state: PwaState = {
  updateReady: false,
  installKind: null,
  isStandalone: false,
  isHelpOpen: false,
}
const listeners = new Set<() => void>()

export function getPwa(): PwaState {
  return state
}

export function setPwa(patch: Partial<PwaState>) {
  state = {...state, ...patch}
  listeners.forEach(l => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Install and update state of the web app; always idle on native. */
export function usePwa(): PwaState {
  return useSyncExternalStore(subscribe, getPwa, getPwa)
}

/** iPhone and iPad (iPadOS 13+ reports itself as a Mac with a touch screen). */
export function isIosDevice(
  ua: string,
  platform: string,
  maxTouchPoints: number,
) {
  return (
    /iPhone|iPad|iPod/.test(ua) ||
    (platform === 'MacIntel' && maxTouchPoints > 1)
  )
}
