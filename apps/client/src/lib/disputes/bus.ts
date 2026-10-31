import {useSyncExternalStore} from 'react'
import {type DisputeTarget} from '@splito/sync'

/**
 * Raising a dispute or hold, and answering one with a note, open from menus that unmount as they close, so the sheets
 * live in one host (`DisputeHost`, mounted once) and menus ask it through this tiny store (like Remind).
 */
export type DisputeRequest =
  /* 'report' is the one entry for a problem on a record: the sheet's first choice is Dispute or Put on hold (F-275). 'raise' is a dispute that is already chosen (one item of a bill). */
  | {kind: 'raise' | 'report'; targetType: DisputeTarget; targetId: string; /** The disputed item of a bill (its id); absent: the whole record. */ itemId?: string}
  | {kind: 'reject' | 'reopen'; disputeId: string}

let current: DisputeRequest | null = null
const listeners = new Set<() => void>()

/** Asks the host to open a sheet. The host clears the request once it has opened it. */
export function requestDispute(request: DisputeRequest) {
  current = request
  listeners.forEach(l => l())
}

export function clearDisputeRequest() {
  current = null
}

export function useDisputeRequest(): DisputeRequest | null {
  return useSyncExternalStore(
    onChange => {
      listeners.add(onChange)
      return () => listeners.delete(onChange)
    },
    () => current,
  )
}
