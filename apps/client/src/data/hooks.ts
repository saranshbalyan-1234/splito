import {useEffect, useState, useSyncExternalStore} from 'react'
import {type BalanceRow, pairBalance, type PersonSummary, personSummary, type WeekStart, ZERO} from '@splito/domain'
import {
  acceptFriendRequest,
  declineFriendRequest,
  type Entity,
  type EntityType,
  type Expense,
  type FriendRequest,
  type Group,
  type GroupRequest,
  type HistoryRow,
  incomingGroupRequests,
  incomingRequests,
  invitedPeople,
  joinRequestsForAdmin,
  type InviteLink,
  inviteLinkState,
  type MutationCtx,
  outgoingGroupRequests,
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
  myExpenseCountQuery,
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

import {directory, answerGroupInvites, revokeGroupLinks} from '#/data/friends'
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

/* One summary per balance snapshot (snapshots keep their identity while unchanged), shared by every reader. */
const summaryByRows = new WeakMap<BalanceRow[], Map<string, PersonSummary>>()

/**
 * One friend's balances, groups included. Rows of a list each asked `personSummary` over every balance row, which is
 * rows x friends work on every render and every keystroke (45 friends: the largest part of opening Friends and
 * invites); the summary is now built once per snapshot.
 */
export function usePersonSummary(personId: string | undefined): PersonSummary | undefined {
  const rows = useBalanceRows()
  if (!rows || !personId) return undefined
  let byPerson = summaryByRows.get(rows)
  if (!byPerson) summaryByRows.set(rows, (byPerson = new Map(personSummary(rows, {includeGroups: true}).map(s => [s.person, s]))))
  return byPerson.get(personId)
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
  /** The matching payments and write-offs shown: `SEARCH_PAGE` per page loaded so far, newest first. */
  payments: Entity<Repayment | WriteOff>[]
  /** How many payments and write-offs match in all (until `isCounted`, the ones read so far). */
  paymentCount: number
  /** More payments than the pages shown: "Show more payments" loads the next page. */
  hasMorePayments: boolean
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
  /** The search could not be answered (the index could not be built or read): say so, with Try again. */
  isFailed: boolean
  /**
   * How many expenses match and their totals per currency. A broad query's first page comes before them (F-266): until
   * `isCounted` the count is the rows read so far and the totals are empty.
   */
  summary: SearchSummary
  /** The counts and totals are the whole answer's. */
  isCounted: boolean
  /** The text of the comment a record was found through. */
  commentText(id: string): string | undefined
  loadMore(): void
  loadMorePayments(): void
  retry(): void
}

/** The kinds of record a search reads: a change to one runs the open query again. */
const SEARCH_TYPES = ['expense', 'repayment', 'writeoff', 'comment', 'dispute', 'person', 'group'] as const satisfies readonly EntityType[]

const FAILED_VIEW: Omit<SearchView, 'loadMore' | 'loadMorePayments' | 'retry'> = {
  people: [],
  groups: [],
  payments: [],
  paymentCount: 0,
  hasMorePayments: false,
  terms: [],
  chips: [],
  tokens: [],
  expenses: [],
  hasMore: false,
  isDone: true,
  isFailed: true,
  summary: {count: 0, totals: {}},
  isCounted: true,
  commentText: () => undefined,
}

/**
 * Search for `query` (ARCHITECTURE 9.8, 26.19, F-246, F-266), paged: the people, groups and the first page of payments
 * and of expenses arrive together whatever the match count, then the counts and per-currency totals (at once for a
 * narrow query; for a broad one, after its first page), and "Show more" reads the next page of either. `categories` are the category names as the
 * person reads them (the localised stock names and the stored ones). The previous answer stays up while a new one
 * loads, and a commit that touches a record, a person, a group, a comment or a dispute runs the query again. A
 * failure is a view with `isFailed` (never an endless wait). Undefined until the first answer.
 */
export function useSearch(rawQuery: string, today: string, mark: '.' | ',', categories: ReadonlyArray<{id: string; name: string}>): SearchView | undefined {
  const {store} = useData()
  const query = rawQuery
  const {actor: me} = useMutationCtx()
  /* By value: the caller builds the list on each render. */
  const categoriesKey = JSON.stringify(categories)
  const [hiddenGroups] = usePref('groups.hidden')
  const [hiddenItems] = usePref('lists.hiddenItems')
  const [weekStart = 1] = usePref('weekStart')
  const [commits, setCommits] = useState(0)
  const [session, setSession] = useState<SearchSession | 'failed'>()
  const [paging, setPaging] = useState({key: query, pages: 1, paymentPages: 1})
  const [view, setView] = useState<Omit<SearchView, 'loadMore' | 'loadMorePayments' | 'retry'>>()
  const pages = paging.key === rawQuery ? paging.pages : 1
  const paymentPages = paging.key === rawQuery ? paging.paymentPages : 1
  const wanted = pages * SEARCH_PAGE
  const wantedPayments = paymentPages * SEARCH_PAGE
  useEffect(
    () =>
      store.subscribe(change => {
        if (SEARCH_TYPES.some(type => touches(change, type))) setCommits(n => n + 1)
      }),
    [store],
  )
  useEffect(() => {
    let isCurrent = true
    const options = {today, mark, categories: JSON.parse(categoriesKey) as Array<{id: string; name: string}>, me, hiddenGroups, hiddenItems, weekStart: weekStart as WeekStart}
    openSearch(store, query, options).then(
      opened => {
        if (isCurrent) setSession(opened)
      },
      () => {
        if (isCurrent) setSession('failed')
      },
    )
    return () => {
      isCurrent = false
    }
  }, [store, query, today, mark, categoriesKey, me, hiddenGroups, hiddenItems, weekStart, commits])
  useEffect(() => {
    if (!session) return
    if (session === 'failed') {
      setView(FAILED_VIEW)
      return
    }
    let isCurrent = true
    const show = () => {
      const found = session.found()
      const isDone = session.isDone()
      const pays = session.foundPayments()
      const isPaysDone = session.isPaymentsDone()
      setView({
        people: session.people,
        groups: session.groups,
        payments: pays.slice(0, wantedPayments),
        paymentCount: session.paymentCount,
        hasMorePayments: pays.length > wantedPayments || !isPaysDone,
        terms: session.terms,
        chips: session.chips,
        tokens: session.tokens,
        expenses: found.slice(0, wanted),
        hasMore: found.length > wanted || !isDone,
        isDone,
        isFailed: false,
        summary: session.summary,
        isCounted: session.isCounted(),
        commentText: session.commentText,
      })
      return {isExpensesFull: found.length >= wanted || isDone, isPaymentsFull: pays.length >= wantedPayments || isPaysDone}
    }
    void (async () => {
      // The pages: read until they are full (the first is read already), showing what is found as it comes; then the counts and totals.
      for (;;) {
        const {isExpensesFull, isPaymentsFull} = show()
        if (isExpensesFull && isPaymentsFull) {
          if (session.isCounted()) return
          try {
            // After the first page is painted: the count reads the full key sets, and their callbacks would hold the paint.
            await new Promise<void>(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)))
            if (!isCurrent) return
            await session.whenCounted()
          } catch {
            if (isCurrent) setView(FAILED_VIEW)
            return
          }
          if (isCurrent) show()
          return
        }
        try {
          await Promise.all([isExpensesFull ? undefined : session.step(), isPaymentsFull ? undefined : session.stepPayments()])
        } catch {
          if (isCurrent) setView(FAILED_VIEW)
          return
        }
        if (!isCurrent) return
      }
    })()
    return () => {
      isCurrent = false
    }
  }, [session, wanted, wantedPayments])
  return (
    view && {
      ...view,
      loadMore: () => setPaging({key: rawQuery, pages: pages + 1, paymentPages}),
      loadMorePayments: () => setPaging({key: rawQuery, pages, paymentPages: paymentPages + 1}),
      retry: () => setCommits(n => n + 1),
    }
  )
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

/** How many live expenses I have a share in (stored sums, no ledger read). Undefined while loading. */
export function useMyExpenseCount(me: string): number | undefined {
  return useProjection(myExpenseCountQuery(me))
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

/** Every group request, all four kinds and any state. Undefined while loading. */
export function useGroupRequests() {
  return useEntities<GroupRequest>('groupRequest')
}

/**
 * The Groups tab's top section (26.3, owner 197): group requests to me (Join), join requests for groups I run (Approve),
 * and the invites and join requests I sent that wait. Expired ones drop out on the minute tick.
 */
export function usePendingGroupRequests() {
  const requests = useGroupRequests()
  const groups = useEntities<Group>('group')
  const {actor} = useMutationCtx()
  const now = useTickEveryMinute()
  const all = requests ?? []
  return {
    isLoading: requests === undefined || groups === undefined,
    toMe: incomingGroupRequests(all, now).filter(r => r.data.kind === 'invite'),
    toApprove: joinRequestsForAdmin(all, groups ?? [], actor, now),
    sent: outgoingGroupRequests(all, now),
  }
}

/** The people one group has asked to join and who have not answered: the group page's "Invited" rows. */
export function useInvitedPeople(groupId: string) {
  const requests = useGroupRequests()
  const now = useTickEveryMinute()
  return invitedPeople(requests ?? [], groupId, now)
}

/** The join requests waiting on one group (only its admins act on them). */
export function useGroupJoinRequests(groupId: string) {
  const requests = useGroupRequests()
  const now = useTickEveryMinute()
  return incomingGroupRequests(requests ?? [], now).filter(r => r.data.kind === 'join' && r.data.groupId === groupId)
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

/** After friends were asked to join a group: lets the directory answer for them (demo mode; see `answerGroupInvites`). */
export function useAnswerGroupInvites() {
  const {store, ctx} = useData()
  return (groupId: string) => answerGroupInvites(store, ctx, groupId)
}

/** The directory is told these group links stopped working (the group went invite only). */
export {revokeGroupLinks}
