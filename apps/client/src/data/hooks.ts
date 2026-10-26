import {useSyncExternalStore} from 'react'
import {type LedgerRecord} from '@splito/domain'
import {
  acceptFriendRequest,
  type ActivityState,
  declineFriendRequest,
  type Entity,
  type EntityType,
  type Expense,
  type FriendRequest,
  type HistoryRow,
  incomingRequests,
  type InviteLink,
  inviteLinkState,
  type MutationCtx,
  outgoingRequests,
  type Person,
  type PrefKey,
  prefFrom,
  type PrefValue,
  type Repayment,
  setPref,
  type Store,
  toExpenseRecord,
  toRepaymentRecord,
  toWriteOffRecord,
  type WriteOff,
} from '@splito/sync'

import {
  activityQuery,
  entitiesQuery,
  historyQuery,
  projectionFor,
  type Query,
} from '#/data/projections'
import {useData} from '#/data/StoreProvider'
import {directory} from '#/data/friends'
import {useTickEveryMinute} from '#/state/shell/tick-every-minute'

export function useStore(): Store {
  return useData().store
}

export function useMutationCtx(): MutationCtx {
  return useData().ctx
}

/** A shared projection's current value; undefined until its first load. */
function useProjection<T>(query: Query<T>): T | undefined {
  const projection = projectionFor(useStore(), query)
  return useSyncExternalStore(projection.subscribe, projection.get)
}

/*
 * Derived values are cached on the projection's arrays, which keep their
 * identity until a commit changes them, so every hook instance gets the same
 * object back and compiled components can skip work.
 */
const liveCache = new WeakMap<Entity[], Entity[]>()
function liveRows<T>(all: Entity<T>[]): Entity<T>[] {
  let live = liveCache.get(all)
  if (!live) liveCache.set(all, (live = all.filter(e => !e.deleted)))
  return live as Entity<T>[]
}

const recordCache = new WeakMap<Entity, LedgerRecord>()
function recordOf(
  e: Entity<Expense> | Entity<Repayment> | Entity<WriteOff>,
  kind: 'expense' | 'repayment' | 'writeoff',
) {
  let r = recordCache.get(e)
  if (!r) {
    r =
      kind === 'expense'
        ? toExpenseRecord(e as Entity<Expense>)
        : kind === 'repayment'
          ? toRepaymentRecord(e as Entity<Repayment>)
          : toWriteOffRecord(e as Entity<WriteOff>)
    recordCache.set(e, r)
  }
  return r
}

const ledgerCache = new WeakMap<Entity[], WeakMap<Entity[], WeakMap<Entity[], LedgerRecord[]>>>()
function ledgerOf(expenses: Entity<Expense>[], repayments: Entity<Repayment>[], writeOffs: Entity<WriteOff>[]) {
  let byRepayments = ledgerCache.get(expenses)
  if (!byRepayments) ledgerCache.set(expenses, (byRepayments = new WeakMap()))
  let byWriteOffs = byRepayments.get(repayments)
  if (!byWriteOffs) byRepayments.set(repayments, (byWriteOffs = new WeakMap()))
  let ledger = byWriteOffs.get(writeOffs)
  if (!ledger) {
    ledger = [
      ...expenses.map(e => recordOf(e, 'expense')),
      ...repayments.map(r => recordOf(r, 'repayment')),
      ...writeOffs.map(w => recordOf(w, 'writeoff')),
    ]
    byWriteOffs.set(writeOffs, ledger)
  }
  return ledger
}

const prefCache = new WeakMap<Entity[], Map<PrefKey, unknown>>()
function prefOf<K extends PrefKey>(rows: Entity<{value: unknown}>[], key: K): PrefValue<K> {
  let byKey = prefCache.get(rows)
  if (!byKey) prefCache.set(rows, (byKey = new Map()))
  if (!byKey.has(key)) byKey.set(key, prefFrom(rows, key))
  return byKey.get(key) as PrefValue<K>
}

/** Every row of one type, tombstones included. Undefined while loading. */
export function useAllEntities<T>(type: EntityType): Entity<T>[] | undefined {
  return useProjection(entitiesQuery<T>(type))
}

/** Live list of non-deleted entities of one type. Undefined while loading. */
export function useEntities<T>(type: EntityType): Entity<T>[] | undefined {
  const all = useAllEntities<T>(type)
  return all && liveRows(all)
}

/** Live ledger records (tombstoned records included, flagged `deleted`). */
export function useLedger(): LedgerRecord[] | undefined {
  const expenses = useAllEntities<Expense>('expense')
  const repayments = useAllEntities<Repayment>('repayment')
  const writeOffs = useAllEntities<WriteOff>('writeoff')
  return expenses && repayments && writeOffs ? ledgerOf(expenses, repayments, writeOffs) : undefined
}

export function useMe(): Entity<Person> | undefined {
  const {actor} = useMutationCtx()
  return useEntities<Person>('person')?.find(p => p.id === actor)
}

/** One entity's stored versions, oldest first. Undefined while loading. */
export function useHistory(type: EntityType, id: string): HistoryRow[] | undefined {
  return useProjection(historyQuery(type, id))
}

/** The Activity feed's events and entities. Undefined while loading. */
export function useActivityState(): ActivityState | undefined {
  return useProjection(activityQuery)
}

/** Live preference value (default until loaded) plus a validated setter. */
export function usePref<K extends PrefKey>(
  key: K,
): [PrefValue<K> | undefined, (v: PrefValue<K>) => Promise<void>] {
  const {store, ctx} = useData()
  const rows = useAllEntities<{value: unknown}>('preference')
  return [rows && prefOf(rows, key), v => setPref(store, ctx, key, v)]
}

/* Friends by consent and invite links (26.18) */

/** Every friend request, both directions, any state. Undefined while loading. */
export function useFriendRequests() {
  return useEntities<FriendRequest>('friendRequest')
}

/** Every invite link you made. Undefined while loading. */
export function useInviteLinks() {
  return useEntities<InviteLink>('inviteLink')
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

/**
 * Accept or decline an incoming friend request: the mutation, then the
 * directory (declining is silent, so it tells nobody). Callers guard taps.
 */
export function useAnswerFriendRequest() {
  const {store, ctx} = useData()
  return async (requestId: string, accept: boolean) => {
    if (!accept) return void (await declineFriendRequest(store, ctx, requestId))
    await acceptFriendRequest(store, ctx, requestId)
    await directory.accept(requestId)
  }
}
