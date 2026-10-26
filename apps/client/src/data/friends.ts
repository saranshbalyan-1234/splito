import {useSyncExternalStore} from 'react'
import {getLocales} from 'expo-localization'
import {formatContact} from '@splito/domain'
import {
  createInviteLink,
  demoDirectory,
  type DirectoryClient,
  type Entity,
  type FriendRequest,
  incomingRequests,
  type InviteLink,
  inviteLinkState,
  mintInviteCode,
  type MutationCtx,
  offlineDirectory,
  outgoingRequests,
  type Store,
} from '@splito/sync'

import {useTickEveryMinute} from '#/state/shell/tick-every-minute'
import {IS_DEMO} from '#/data/demo'
import {DEMO_DIRECTORY} from '#/data/demoData'
import {useStore} from '#/data/hooks'

/**
 * The directory and invite API (26.18). Production has no backend yet, so
 * lookups are 'unavailable' and sends stay queued; only demo mode answers.
 */
export const directory: DirectoryClient & {
  accountFor?: ReturnType<typeof demoDirectory>['accountFor']
} = IS_DEMO ? demoDirectory(DEMO_DIRECTORY) : offlineDirectory

/**
 * Makes an invite link: the directory registers the code first, and only then
 * is the link recorded. Offline it answers 'unavailable' and nothing is
 * minted (section 10: invite links fail closed, never a fabricated URL).
 */
export async function makeInviteLink(
  store: Store,
  ctx: MutationCtx,
  input: Omit<Parameters<typeof createInviteLink>[2], 'code'>,
): Promise<Entity<InviteLink> | 'unavailable'> {
  const code = mintInviteCode(ctx)
  if ((await directory.createInviteLink(code)) !== 'created') return 'unavailable'
  return createInviteLink(store, ctx, {...input, code})
}

/** The name a request shows: the one you gave (or theirs), else their number or email. */
export function requestName(r: FriendRequest) {
  return r.name || (r.contact ? formatContact(r.contact) : '')
}

/** Where invite links point: the web path, which the app also claims (section 14). */
export const INVITE_HOST = 'https://splito.app'

export function inviteUrl(code: string) {
  return `${INVITE_HOST}/invite/${code}`
}

/** The region phone numbers default to: the device's, else India (Splito's first market). */
export function deviceRegion(): string {
  return getLocales()[0]?.regionCode ?? 'IN'
}

type Source<T> = {
  subscribe: (fn: () => void) => () => void
  get: () => Entity<T>[] | undefined
}

const sources = new WeakMap<Store, Map<string, Source<unknown>>>()

/*
 * One read per commit per entity type, shared by every screen, row and badge
 * that shows requests or links, and only while someone listens. An answer
 * equal to the last keeps its array, so subscribers don't re-render.
 */
function sourceFor<T>(store: Store, type: 'friendRequest' | 'inviteLink'): Source<T> {
  let byType = sources.get(store)
  if (!byType) sources.set(store, (byType = new Map()))
  const existing = byType.get(type)
  if (existing) return existing as Source<T>
  let snapshot: Entity<T>[] | undefined
  let signature = ''
  let generation = 0
  let off: (() => void) | undefined
  const listeners = new Set<() => void>()
  const load = () => {
    const current = ++generation
    void store.getAll<T>(type).then(all => {
      if (current !== generation) return
      const live = all.filter(e => !e.deleted)
      const next = live.map(e => `${e.id}:${e.version}`).join()
      if (snapshot && next === signature) return
      signature = next
      snapshot = live
      listeners.forEach(l => l())
    })
  }
  const source: Source<T> = {
    subscribe(fn) {
      listeners.add(fn)
      if (listeners.size === 1) {
        load()
        off = store.subscribe(load)
      }
      return () => {
        listeners.delete(fn)
        if (listeners.size === 0) off?.()
      }
    },
    get: () => snapshot,
  }
  byType.set(type, source as Source<unknown>)
  return source
}

/** Every friend request, both directions, any state. Undefined while loading. */
export function useFriendRequests() {
  const source = sourceFor<FriendRequest>(useStore(), 'friendRequest')
  return useSyncExternalStore(source.subscribe, source.get)
}

/** Every invite link you made. Undefined while loading. */
export function useInviteLinks() {
  const source = sourceFor<InviteLink>(useStore(), 'inviteLink')
  return useSyncExternalStore(source.subscribe, source.get)
}

/** People > Requests and Invites sent; expired ones drop out on the minute tick. */
export function usePendingRequests() {
  const requests = useFriendRequests()
  const now = useTickEveryMinute()
  return {
    isLoading: requests === undefined,
    incoming: incomingRequests(requests ?? [], now),
    outgoing: outgoingRequests(requests ?? [], now),
  }
}

/** Active links first (newest first), then the rest. */
export function useSortedInviteLinks() {
  const links = useInviteLinks()
  const now = useTickEveryMinute()
  const all = [...(links ?? [])].sort(
    (x, y) => y.data.createdAt - x.data.createdAt,
  )
  return {
    isLoading: links === undefined,
    active: all.filter(l => inviteLinkState(l.data, now) === 'active'),
    inactive: all.filter(l => inviteLinkState(l.data, now) !== 'active'),
    now,
  }
}
