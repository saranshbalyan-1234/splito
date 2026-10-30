import {useEffect, useState, useSyncExternalStore} from 'react'
import {type BalanceRow, pairBalance, ZERO} from '@splito/domain'
import {
  acceptFriendRequest,
  DEFAULT_CATEGORIES,
  declineFriendRequest,
  type Entity,
  type EntityType,
  type Expense,
  type FriendRequest,
  type Group,
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
  type SearchChip,
  type SearchSession,
  type SearchSummary,
  type SearchToken,
  openSearch,
  SEARCH_PAGE,
  setPref,
  type Store,
  toExpenseRecord,
  touches,
  type WriteOff,
} from '@splito/sync'

import {
  boundsQuery,
  type CellData,
  cellsQuery,
  type Overview,
  overviewQuery,
  rowsQuery,
  type RowsPager,
  type RowsSpec,
} from '#/data/analyticsQueries'
import {
  type GroupBalances,
  groupActivityQuery,
  groupNetsQuery,
  type HistoryPager,
  historyPagerQuery,
  indexStream,
  lastActivityQuery,
  myGroupBalancesQuery,
  openGroupsQuery,
  balanceRowsQuery,
  type SeenCurrencies,
  seenCurrenciesQuery,
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
import {useData, useMaybeData} from '#/data/StoreProvider'

import {directory} from '#/data/friends'
import {useTickEveryMinute} from '#/state/shell/tick-every-minute'

export function useStore(): Store {
  return useData().store
}

/** The store, or null signed out (no store is open then). */
export function useMaybeStore(): Store | null {
  return useMaybeData()?.store ?? null
}

export function useMutationCtx(): MutationCtx {
  return useData().ctx
}

const IDLE: Projection<never> = {subscribe: () => () => {}, get: () => undefined}

/** A shared projection's current value; undefined until its first load (or always, for a null query: nothing is read). */
export function useProjection<T>(query: Query<T> | null): T | undefined {
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

/** The ids of groups with any open net between any members, from one query for the whole list (never per row). */
export function useOpenGroups(): ReadonlySet<string> | undefined {
  return useProjection(openGroupsQuery())
}

/** The currencies each friend and group has had with me, settled ones too: what the currency filters offer (audit m3). */
export function useSeenCurrencies(): SeenCurrencies | undefined {
  const {actor} = useMutationCtx()
  return useProjection(seenCurrenciesQuery(actor))
}

/** One group's net per currency and person (no zero-fill; people with no records are absent). */
export function useGroupNets(groupId: string) {
  return useProjection(groupNetsQuery(groupId))
}

/** When each group last saw activity (epoch ms), for "recent" ordering. */
export function useGroupActivity() {
  return useProjection(groupActivityQuery)
}

/** When each person last saw activity (epoch ms), read only while `enabled` (the "recent" friends sort). */
export function useLastActivity(enabled: boolean) {
  return useProjection(enabled ? lastActivityQuery : null)
}

/**
 * One group's expenses, payments and write-offs, newest first, a page at a time. Deleted ones stay in their date
 * place (read through the same indexes) and are drawn struck by the row; balances never count them.
 */
export function useGroupHistory(groupId: string): HistoryPager | undefined {
  return useProjection(
    historyPagerQuery(`history:group:${groupId}`, store => [
      indexStream<Expense>(store, 'expense', {index: 'byGroupDate', eq: [groupId]}, undefined, true),
      indexStream<Repayment>(store, 'repayment', {index: 'byGroup', eq: [groupId]}, undefined, true),
      indexStream<WriteOff>(store, 'writeoff', {index: 'byGroup', eq: [groupId]}, undefined, true),
    ]),
  )
}

/**
 * The expenses and payments between me and one friend that move their
 * balance, newest first, a page at a time (deleted ones in their place, struck); `includeGroups` off keeps only
 * those outside groups.
 */
export function usePairHistory(personId: string, includeGroups: boolean): HistoryPager | undefined {
  const {actor: me} = useMutationCtx()
  return useProjection(
    historyPagerQuery(`history:pair:${me}:${personId}:${includeGroups}`, store => {
      const inScope = (groupId: string | null) => includeGroups || groupId === null
      const movesBalance = (e: Entity<Expense>) =>
        // A deleted expense is judged as it was live: it stays in the history, struck, where it once moved the balance.
        e.data.payers[me] !== undefined || e.data.shares[me] !== undefined
          ? pairBalance([toExpenseRecord({...e, deleted: false})], me, personId) !== ZERO
          : false
      const both = (e: Entity<Expense>) =>
        (personId in e.data.payers || personId in e.data.shares) && inScope(e.data.groupId) && movesBalance(e)
      const between = (from: string, to: string) => (r: Entity<Repayment>) =>
        r.data.from === from && r.data.to === to && inScope(r.data.groupId)
      return [
        partyStream(store, {index: 'byPersonDate', eq: [personId]}, both, !includeGroups, true),
        indexStream<Repayment>(store, 'repayment', {index: 'byFrom', eq: [personId]}, between(personId, me), true),
        indexStream<Repayment>(store, 'repayment', {index: 'byTo', eq: [personId]}, between(me, personId), true),
        indexStream<WriteOff>(store, 'writeoff', {index: 'byFrom', eq: [personId]}, between(personId, me), true),
        indexStream<WriteOff>(store, 'writeoff', {index: 'byTo', eq: [personId]}, between(me, personId), true),
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

/** What the Search & Ask drawer draws for one query. */
export interface SearchView {
  people: Entity<Person>[]
  groups: Entity<Group>[]
  /** The newest matching payments and write-offs (one page) and how many match in all. */
  payments: Entity<Repayment | WriteOff>[]
  paymentCount: number
  /** Folded query words to highlight. */
  terms: string[]
  /** The recognised facets, as removable chips. */
  chips: SearchChip[]
  /** The tokens the query was read as: each result row says which field matched with them. */
  tokens: SearchToken[]
  /** The expenses shown: `SEARCH_PAGE` per page loaded so far, newest first. */
  expenses: Entity<Expense>[]
  /** More matches than the pages shown: "Show more" loads the next page. */
  hasMore: boolean
  /** Every matching expense has been read, so "no results" is true. */
  isDone: boolean
  /** How many expenses match and their totals per currency (known with the first answer). */
  summary: SearchSummary
  /** The text of the comment a record was found through. */
  commentText(id: string): string | undefined
  loadMore(): void
}

/** The kinds of record a search reads: a change to one runs the open query again. */
const SEARCH_TYPES = ['expense', 'repayment', 'writeoff', 'comment', 'dispute', 'person', 'group'] as const satisfies readonly EntityType[]

/**
 * Search for `query` (ARCHITECTURE 9.8, 26.19, F-246), paged: the query is resolved from the term keys, so the people,
 * groups, payments, the count and per-currency totals and the first page of expenses arrive together whatever the
 * match count, and "Show more" reads the next page by id. The previous answer stays up while a new one loads, and a
 * commit that touches a record, a person, a group, a comment or a dispute runs the query again. Undefined until the
 * first answer.
 */
export function useSearch(rawQuery: string, today: string, mark: '.' | ','): SearchView | undefined {
  const {store} = useData()
  const query = rawQuery
  const {actor: me} = useMutationCtx()
  const [categories = DEFAULT_CATEGORIES] = usePref('categories')
  const [hiddenGroups] = usePref('groups.hidden')
  const [hiddenItems] = usePref('lists.hiddenItems')
  const [commits, setCommits] = useState(0)
  const [session, setSession] = useState<SearchSession>()
  const [paging, setPaging] = useState({key: query, pages: 1})
  const [view, setView] = useState<Omit<SearchView, 'loadMore'>>()
  const pages = paging.key === rawQuery ? paging.pages : 1
  const wanted = pages * SEARCH_PAGE
  useEffect(
    () =>
      store.subscribe(change => {
        if (SEARCH_TYPES.some(type => touches(change, type))) setCommits(n => n + 1)
      }),
    [store],
  )
  useEffect(() => {
    let isCurrent = true
    void openSearch(store, query, {today, mark, categories, me, hiddenGroups, hiddenItems}).then(opened => {
      if (isCurrent) setSession(opened)
    })
    return () => {
      isCurrent = false
    }
  }, [store, query, today, mark, categories, me, hiddenGroups, hiddenItems, commits])
  useEffect(() => {
    if (!session) return
    let isCurrent = true
    const show = () => {
      const found = session.found()
      const isDone = session.isDone()
      setView({
        people: session.people,
        groups: session.groups,
        payments: session.payments,
        paymentCount: session.paymentCount,
        terms: session.terms,
        chips: session.chips,
        tokens: session.tokens,
        expenses: found.slice(0, wanted),
        hasMore: found.length > wanted || !isDone,
        isDone,
        summary: session.summary,
        commentText: session.commentText,
      })
      return found.length >= wanted || isDone
    }
    void (async () => {
      // The page: read until it is full (the first is usually read already), showing what is found as it comes.
      while (!show()) {
        await session.step()
        if (!isCurrent) return
      }
    })()
    return () => {
      isCurrent = false
    }
  }, [session, wanted])
  return view && {...view, loadMore: () => setPaging({key: rawQuery, pages: pages + 1})}
}

/* Analytics (ARCHITECTURE 9.8): stored month sums, date-index reads at the edges, a paged list. */

/** Which currencies have expenses, most used first. */
export function useAnalyticsOverview(): Overview | undefined {
  return useProjection(overviewQuery)
}

/** First and last dated record in one currency and scope (null: none). `isIn` must follow `scopeKey`. */
export function useAnalyticsBounds(
  request: {currency: string; scopeKey: string; isIn: (groupId: string | null) => boolean} | null,
) {
  return useProjection(request ? boundsQuery(request.currency, request.scopeKey, request.isIn) : null)
}

/** The spending cells of a period (and every earlier cell, for the balance line). */
export function useAnalyticsCells(request: {currency: string; from: string; to: string; exact: boolean} | null): CellData | undefined {
  return useProjection(request ? cellsQuery(request.currency, {from: request.from, to: request.to}, request.exact) : null)
}

/** The expense list behind the charts, newest first, a page at a time. */
export function useAnalyticsRows(spec: RowsSpec | null): RowsPager | undefined {
  return useProjection(spec ? rowsQuery(spec) : null)
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
