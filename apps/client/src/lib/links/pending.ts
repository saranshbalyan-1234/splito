import {type LinkTarget} from './resolve'
import {isGlobalSheet, nativeSheets, pathParamNames} from './table'

/**
 * The phone's hold for a link's sheet (F-241, F-254). A phone has no `Sheet` route, so a link opens its page and
 * the sheet waits here until a dialog with that address and that page mounts and opens (`useDialogControl`). Pure
 * and clocked from outside so the rules are tested: one slot, a new link replaces it; only the first sheet of the
 * chain is held (never a picker, never anything over a composer, `nativeSheets`); it is consumed when the dialog
 * has opened, not when it was looked at; it expires, and it is dropped when the person leaves the page it was for,
 * so it never turns up on a later visit.
 */
export type PendingOwner = {name: string; params: Record<string, string>} | null

type Pending = {owner: PendingOwner; chain: string[]; query: Record<string, string>; queuedAt: number; isArmed: boolean}

/** A link whose sheet nobody opened within this long is forgotten. */
export const PENDING_TTL_MS = 10_000

let pending: Pending | null = null

export function pickPathParams(name: string, params: Record<string, string | undefined>): Record<string, string> {
  return Object.fromEntries(pathParamNames(name).flatMap(n => (params[n] ? [[n, params[n]!]] : [])))
}

/** Holds `target`'s sheet for its page (a phone). A link with no sheet to hold clears the slot. */
export function queue(target: LinkTarget, now: number) {
  const chain = nativeSheets(target.name, target.sheets)
  pending =
    chain.length === 0
      ? null
      : {
          owner: isGlobalSheet(chain) ? null : {name: target.name, params: pickPathParams(target.name, target.params)},
          chain,
          query: target.query,
          queuedAt: now,
          isArmed: false,
        }
}

function matchesOwner(p: Pending, owner: PendingOwner) {
  if (p.owner === null) return owner === null
  return owner !== null && owner.name === p.owner.name && Object.entries(p.owner.params).every(([k, v]) => owner.params[k] === v)
}

/** The held sheet's query when `chain` over `owner` is the sheet waiting, else undefined. Does not consume it. */
export function peek(owner: PendingOwner, chain: readonly string[], now: number): Record<string, string> | undefined {
  if (pending && now - pending.queuedAt > PENDING_TTL_MS) pending = null
  const p = pending
  if (!p || p.chain.length !== chain.length || !p.chain.every((s, i) => s === chain[i]) || !matchesOwner(p, owner)) return undefined
  return p.query
}

/** The dialog opened (or was refused for good): the slot is free. */
export function done() {
  pending = null
}

/** The page now showing. Armed once it is the held sheet's page; leaving it afterwards drops the hold. */
export function focusChanged(page: {name: string; params: Record<string, string>} | null): boolean {
  const p = pending
  if (!p || p.owner === null) return false
  const isOwnerPage = !!page && matchesOwner(p, {name: page.name, params: pickPathParams(page.name, page.params)})
  if (isOwnerPage) {
    p.isArmed = true
    return false
  }
  if (!p.isArmed) return false
  pending = null
  return true
}

export const hasPending = () => pending !== null

/** Tests only. */
export function resetPendingForTests() {
  pending = null
}
