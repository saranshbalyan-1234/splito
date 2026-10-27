import {useSyncExternalStore} from 'react'
import {type BalanceRow, pairBalance, ZERO} from '@splito/domain'
import {
  acceptFriendRequest,
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
  touches,
  type WriteOff,
} from '@splito/sync'

import {type DemoCounts, demoCounts} from '#/data/demoLarge'
import {
  type GroupBalances,
  groupActivityQuery,
  groupNetsQuery,
  type HistoryPager,
  historyPagerQuery,
  indexStream,
  type LedgerMirror,
  ledgerMirrorQuery,
  lastActivityQuery,
  myGroupBalancesQuery,
  balanceRowsQuery,
  countQuery,
  partyStream,
} from '#/data/ledgerQueries'
import {
  type ActivityFeed,
  activityQuery,
  entitiesQuery,
  entityQuery,
  historyQuery,
  projectionFor,
  type Projection,
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

const IDLE: Projection<never> = {subscribe: () => () => {}, get: () => undefined}

/** A shared projection's current value; undefined until its first load (or always, for a null query: nothing is read). */
function useProjection<T>(query: Query<T> | null): T | undefined {
  const store = useStore()
  const projection = query ? projectionFor(store, query) : IDLE
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

const prefCache = new WeakMap<Entity[], Map<PrefKey, unknown>>()
function prefOf<K extends PrefKey>(rows: Entity<{value: unknown}>[], key: K): PrefValue<K> {
  let byKey = prefCache.get(rows)
  if (!byKey) prefCache.set(rows, (byKey = new Map()))
  if (!byKey.has(key)) byKey.set(key, prefFrom(rows, key))
  return byKey.get(key) as PrefValue<K>
}

/**
 * Every row of one small type (people, groups, preferences, requests,
 * links), tombstones included. Undefined while loading. A money type throws:
 * those are read by index (see the hooks below).
 */
export function useAllEntities<T>(type: EntityType): Entity<T>[] | undefined {
  return useProjection(entitiesQuery<T>(type))
}

/** Live list of non-deleted entities of one small type. Undefined while loading. */
export function useEntities<T>(type: EntityType): Entity<T>[] | undefined {
  const all = useAllEntities<T>(type)
  return all && liveRows(all)
}

/** One row by id, tombstone included: undefined while loading, null when there is none. */
export function useEntity<T>(type: EntityType, id: string): Entity<T> | null | undefined {
  return useProjection(entityQuery<T>(type, id))
}

/* Balances and history, from the stored sums and indexes (ARCHITECTURE 9.8) */

/** My balance with each person, per group and currency: what People, Person and the right column show. Undefined while loading. */
export function useBalanceRows(): BalanceRow[] | undefined {
  const {actor} = useMutationCtx()
  return useProjection(balanceRowsQuery(actor))
}

/** My net in each group I am not settled in, per currency. */
export function useMyGroupBalances(): GroupBalances | undefined {
  const {actor} = useMutationCtx()
  return useProjection(myGroupBalancesQuery(actor))
}

/** One group's net per currency and person (no zero-fill; people with no records are absent). */
export function useGroupNets(groupId: string) {
  return useProjection(groupNetsQuery(groupId))
}

/** When each group last saw activity (epoch ms), for "recent" ordering. */
export function useGroupActivity() {
  return useProjection(groupActivityQuery)
}

/** The latest shared date per person, read only while `enabled` (the "recent" friends sort). */
export function useLastActivity(enabled: boolean) {
  return useProjection(enabled ? lastActivityQuery : null)
}

/** One group's expenses, payments and write-offs, newest first, a page at a time. */
export function useGroupHistory(groupId: string): HistoryPager | undefined {
  return useProjection(
    historyPagerQuery(`history:group:${groupId}`, store => [
      indexStream<Expense>(store, 'expense', {index: 'byGroupDate', eq: [groupId]}),
      indexStream<Repayment>(store, 'repayment', {index: 'byGroup', eq: [groupId]}),
      indexStream<WriteOff>(store, 'writeoff', {index: 'byGroup', eq: [groupId]}),
    ]),
  )
}

/**
 * The expenses and payments between me and one friend that move their
 * balance, newest first, a page at a time; `includeGroups` off keeps only
 * those outside groups.
 */
export function usePairHistory(personId: string, includeGroups: boolean): HistoryPager | undefined {
  const {actor: me} = useMutationCtx()
  return useProjection(
    historyPagerQuery(`history:pair:${me}:${personId}:${includeGroups}`, store => {
      const inScope = (groupId: string | null) => includeGroups || groupId === null
      const movesBalance = (e: Entity<Expense>) =>
        e.data.payers[me] !== undefined || e.data.shares[me] !== undefined
          ? pairBalance([toExpenseRecord(e)], me, personId) !== ZERO
          : false
      const both = (e: Entity<Expense>) =>
        (personId in e.data.payers || personId in e.data.shares) && inScope(e.data.groupId) && movesBalance(e)
      const between = (from: string, to: string) => (r: Entity<Repayment>) =>
        r.data.from === from && r.data.to === to && inScope(r.data.groupId)
      return [
        partyStream(store, {index: 'byPersonDate', eq: [personId]}, both, !includeGroups),
        indexStream<Repayment>(store, 'repayment', {index: 'byFrom', eq: [personId]}, between(personId, me)),
        indexStream<Repayment>(store, 'repayment', {index: 'byTo', eq: [personId]}, between(me, personId)),
        indexStream<WriteOff>(store, 'writeoff', {index: 'byFrom', eq: [personId]}, between(personId, me)),
        indexStream<WriteOff>(store, 'writeoff', {index: 'byTo', eq: [personId]}, between(me, personId)),
      ]
    }),
  )
}

/** The few newest expenses and payments I am on (the sidebar's "Recent transactions"). */
export function useRecentTransactions(size: number): HistoryPager | undefined {
  const {actor: me} = useMutationCtx()
  return useProjection(
    historyPagerQuery(
      `history:recent:${me}:${size}`,
      store => [
        partyStream(store, {index: 'byPersonDate', eq: [me]}, () => true),
        indexStream<Repayment>(store, 'repayment', {index: 'byFrom', eq: [me]}),
        indexStream<Repayment>(store, 'repayment', {index: 'byTo', eq: [me]}),
      ],
      undefined,
      size,
    ),
  )
}

/** The whole ledger in memory, for Analytics and search only (read by index in pages, then kept current). */
export function useLedgerMirror(): LedgerMirror | undefined {
  return useProjection(ledgerMirrorQuery)
}

const demoCountsQuery: Query<DemoCounts> = {
  key: 'demoCounts',
  isTouchedBy: c => touches(c, 'person') || touches(c, 'group') || touches(c, 'expense'),
  loader: store => async (_c, prev) => {
    const next = await demoCounts(store)
    return prev && prev.friends === next.friends && prev.groups === next.groups && prev.expenses === next.expenses ? prev : next
  },
}

/** What the large demo set holds right now (Settings > Data; dev and e2e builds only). */
export function useDemoCounts(): DemoCounts | undefined {
  return useProjection(demoCountsQuery)
}

/** How many rows an index range holds (`count`), live. */
export function useCount(type: EntityType, q: Parameters<Store['count']>[1] = {}): number | undefined {
  const key = `count:${type}:${JSON.stringify(q)}`
  return useProjection(countQuery(key, type, q))
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
export function useActivityState(): ActivityFeed | undefined {
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
