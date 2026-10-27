import {useSyncExternalStore} from 'react'

/**
 * Remind and Remind me open from menus that unmount as they close, so the sheets live in one host
 * (`RemindHost`, mounted once) and menus ask it through this tiny store.
 */
export type RemindTarget = {
  personId: string
  /** The group the reminder is about; null: the friend across everything. */
  groupId: string | null
}

export type RemindRequest =
  | ({kind: 'remind'; /** What they owe me, per currency, when the menu was opened. */ owed: Record<string, bigint>} & RemindTarget)
  | ({kind: 'remindMe'; /** Edit this scheduled reminder instead of making a new one. */ editId?: string} & RemindTarget)

let current: RemindRequest | null = null
const listeners = new Set<() => void>()

/** Asks the host to open a sheet. The host clears the request once it has opened it. */
export function requestRemind(request: RemindRequest) {
  current = request
  listeners.forEach(l => l())
}

export function clearRemindRequest() {
  current = null
}

export function useRemindRequest(): RemindRequest | null {
  return useSyncExternalStore(
    onChange => {
      listeners.add(onChange)
      return () => listeners.delete(onChange)
    },
    () => current,
  )
}
