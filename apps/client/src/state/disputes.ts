import {useMemo} from 'react'
import {
  acceptDispute,
  type Dispute,
  type DisputeEvent,
  loadDisputeEvents,
  listDisputedBalances,
  listDisputedPairs,
  type DisputeTarget,
  type DisputedBalance,
  type DisputedPair,
  type Entity,
  type Expense,
  type Group,
  groupAdmins,
  holdRecord,
  type HistoryEntry,
  loadDisputedRecords,
  type Key,
  listDisputes,
  listOpenDisputes,
  raiseDispute,
  rejectDispute,
  releaseHold,
  reopenDispute,
  type Repayment,
  setSettleIncludeDisputed,
  touches,
  withdrawDispute,
} from '@splito/sync'
import {
  canDispute,
  canResolveDispute,
  type DisputeAction,
  type DisputeReason,
  type DisputeRecord,
  type PermissionResult,
} from '@splito/domain'

import {useMutationCtx, usePref, useProjection, useStore} from '#/data/hooks'
import {entitiesQuery, entityQuery, historyQuery, type Query, shareRows} from '#/data/projections'

/**
 * Reads and writes of disputes and holds (F-1210). Components come here, never to the store (ARCHITECTURE 1). The
 * records keep counting in every balance; these hooks only say which are marked, and how much of a balance sits on them.
 */

const NONE: never[] = []
const keyOf = (type: DisputeTarget, id: string) => `${type}:${id}`
const isMoneyChange = (c: Parameters<typeof touches>[0]) =>
  touches(c, 'expense') || touches(c, 'repayment') || touches(c, 'writeoff')

/** Every open dispute and hold, newest change first, and the same grouped by record. */
export interface OpenDisputes {
  all: Entity<Dispute>[]
  byRecord: ReadonlyMap<string, Entity<Dispute>[]>
}

const EMPTY_OPEN: OpenDisputes = {all: NONE, byRecord: new Map()}

const openQuery: Query<OpenDisputes> = {
  key: 'disputes:open',
  isTouchedBy: c => touches(c, 'dispute'),
  loader: store => async (_c, prev) => {
    const rows: Entity<Dispute>[] = []
    let after: Key | null = null
    do {
      const page = await listOpenDisputes(store, {after})
      rows.push(...page.items)
      after = page.next
    } while (after)
    const all = shareRows(prev?.all, rows)
    if (prev && all === prev.all) return prev
    if (all.length === 0) return EMPTY_OPEN
    const byRecord = new Map<string, Entity<Dispute>[]>()
    for (const d of all) byRecord.set(keyOf(d.data.targetType, d.data.targetId), [...(byRecord.get(keyOf(d.data.targetType, d.data.targetId)) ?? []), d])
    return {all, byRecord}
  },
}

/** The open disputes and holds, read once for the whole list (never per row). Undefined while loading. */
export function useOpenDisputes(): OpenDisputes | undefined {
  return useProjection(openQuery)
}

/** How one record is marked right now: a dispute wins over a hold (it needs an answer). */
export type DisputeMark = 'disputed' | 'hold' | undefined

export function markOf(open: OpenDisputes | undefined, type: DisputeTarget, id: string): DisputeMark {
  const list = open?.byRecord.get(keyOf(type, id))
  if (!list?.length) return undefined
  return list.some(d => d.data.kind === 'dispute') ? 'disputed' : 'hold'
}

/** The mark of one record, from the shared open list. */
export function useDisputeMark(type: DisputeTarget, id: string): DisputeMark {
  return markOf(useOpenDisputes(), type, id)
}

const recordQueries = new Map<string, Query<Entity<Dispute>[]>>()

function recordQuery(type: DisputeTarget, id: string): Query<Entity<Dispute>[]> {
  const key = `disputes:record:${type}:${id}`
  let q = recordQueries.get(key)
  if (!q) {
    q = {
      key,
      isTouchedBy: c => touches(c, 'dispute'),
      loader: store => async (_c, prev) => {
        const rows: Entity<Dispute>[] = []
        let after: Key | null = null
        do {
          const page = await listDisputes(store, type, id, {after})
          rows.push(...page.items)
          after = page.next
        } while (after)
        return shareRows(prev, rows)
      },
    }
    recordQueries.set(key, q)
  }
  return q
}

/** Every dispute and hold of one record, any state, oldest first. Undefined while loading. */
export function useRecordDisputes(type: DisputeTarget, id: string): Entity<Dispute>[] | undefined {
  return useProjection(recordQuery(type, id))
}

const lineQueries = new Map<string, Query<DisputeEvent[]>>()

/** The system lines of one record's disputes (raised, answered, reopened, released, gone), oldest first, for its thread. */
export function useDisputeEvents(type: DisputeTarget, id: string): DisputeEvent[] {
  const key = `dispute-events:${type}:${id}`
  let q = lineQueries.get(key)
  if (!q) {
    q = {
      key,
      isTouchedBy: c => touches(c, 'dispute'),
      loader: store => async (_c, prev) => {
        const next = await loadDisputeEvents(store, type, id)
        return prev && prev.length === next.length && prev.every((p, i) => p.key === next[i]!.key) ? prev : next
      },
    }
    lineQueries.set(key, q)
  }
  return useProjection(q) ?? NONE
}

/* -------------------------------------------------------------------------- */
/* Who may do what                                                            */
/* -------------------------------------------------------------------------- */

/**
 * The permission checks for one record, with everything they need read (the record, who added it, its group). Mutations
 * re-check the same rules; this only decides which buttons to show. Undefined while loading.
 */
export function useDisputeAccess(type: DisputeTarget, id: string | undefined) {
  const {actor} = useMutationCtx()
  /* No id (Add expense): nothing is read, so a composer with nothing to answer holds no extra subscription. */
  const entity = useProjection(id ? entityQuery<Expense & Repayment>(type, id) : null)
  const history = useProjection(id ? historyQuery(type, id) : null)
  const groups = useProjection(id ? entitiesQuery<Group>('group') : null)
  const groupId = entity?.data.groupId ?? null
  const record = useMemo((): DisputeRecord | undefined => {
    if (!entity || !history || !groups) return undefined
    const d = entity.data
    const isExpense = type === 'expense'
    const group = groupId ? groups.find(g => g.id === groupId && !g.deleted)?.data : undefined
    return {
      addedBy: history[0]?.actor ?? '',
      participants: isExpense ? [...new Set([...Object.keys(d.payers ?? {}), ...Object.keys(d.shares ?? {})])] : [d.from, d.to],
      payers: isExpense ? Object.keys(d.payers ?? {}) : [d.from],
      groupMembers: group ? group.members.filter(m => m.leftAt === null).map(m => m.personId) : [],
      groupAdmins: group ? groupAdmins(group) : [],
    }
  }, [entity, history, groups, groupId, type])
  return {
    me: actor,
    record,
    /** The record itself (an expense, payment or write-off), for what a fix would change. */
    entity,
    /** May `raisedBy` (default me) raise a dispute with `reason`, or a hold? */
    canRaise: (reason: DisputeReason, raisedBy = actor, kind: 'dispute' | 'hold' = 'dispute', hasOpen = false): PermissionResult =>
      record ? canDispute(record, {raisedBy, kind, reason}, hasOpen) : {ok: false, code: 'LOADING'},
    canDo: (d: Dispute, action: DisputeAction): boolean => !!record && canResolveDispute(record, d, actor, action).ok,
  }
}

/* -------------------------------------------------------------------------- */
/* Writes                                                                     */
/* -------------------------------------------------------------------------- */

/** Every dispute write, as the local "me"; each returns the written dispute and throws a `DomainError` with a code. */
export function useDisputeActions() {
  const store = useStore()
  const ctx = useMutationCtx()
  return {
    raise: (input: Parameters<typeof raiseDispute>[2]) => raiseDispute(store, ctx, input),
    hold: (input: Parameters<typeof holdRecord>[2]) => holdRecord(store, ctx, input),
    release: (id: string) => releaseHold(store, ctx, id),
    accept: (id: string, apply: boolean, note?: string) => acceptDispute(store, ctx, id, {apply, note}),
    reject: (id: string, note: string) => rejectDispute(store, ctx, id, {note}),
    withdraw: (id: string) => withdrawDispute(store, ctx, id),
    reopen: (id: string, note: string) => reopenDispute(store, ctx, id, {note}),
  }
}

/* -------------------------------------------------------------------------- */
/* "Of which disputed"                                                        */
/* -------------------------------------------------------------------------- */

const disputedQueries = new Map<string, Query<DisputedBalance[]>>()

/** The disputed or held part of a group's per-person nets (all of them when no group is given). Undefined while loading. */
export function useDisputedBalances(q: {personId?: string; groupId?: string | null}): DisputedBalance[] | undefined {
  const key = `disputed-balances:${q.personId ?? '*'}:${q.groupId === undefined ? '*' : (q.groupId ?? '')}`
  let query = disputedQueries.get(key)
  if (!query) {
    query = {
      key,
      isTouchedBy: c => touches(c, 'dispute') || isMoneyChange(c),
      loader: store => async (_c, prev) => {
        const next = await listDisputedBalances(store, q)
        const same = prev && prev.length === next.length && prev.every((p, i) => p.personId === next[i]!.personId && p.groupId === next[i]!.groupId && p.currency === next[i]!.currency && p.amount === next[i]!.amount)
        return same ? prev : next
      },
    }
    disputedQueries.set(key, query)
  }
  return useProjection(query)
}

const pairQueries = new Map<string, Query<DisputedPair[]>>()

/** The disputed or held part of what `otherId` owes `personId`, per group and currency. Undefined while loading. */
export function useDisputedPairs(personId: string, otherId?: string): DisputedPair[] | undefined {
  const key = `disputed-pairs:${personId}:${otherId ?? '*'}`
  let query = pairQueries.get(key)
  if (!query) {
    query = {
      key,
      isTouchedBy: c => touches(c, 'dispute') || isMoneyChange(c),
      loader: store => async (_c, prev) => {
        const next = await listDisputedPairs(store, personId, otherId)
        const same = prev && prev.length === next.length && prev.every((p, i) => p.otherId === next[i]!.otherId && p.groupId === next[i]!.groupId && p.currency === next[i]!.currency && p.amount === next[i]!.amount)
        return same ? prev : next
      },
    }
    pairQueries.set(key, query)
  }
  return useProjection(query)
}

/** Settle up for this group: the disputed and held amounts are in the plan (true) or left out (false, the default). */
export function useSettleIncludeDisputed(groupId: string): [boolean, (include: boolean) => Promise<void>] {
  const [ids] = usePref('group:settleIncludeDisputed')
  const store = useStore()
  const ctx = useMutationCtx()
  return [!!ids?.includes(groupId), include => setSettleIncludeDisputed(store, ctx, groupId, include)]
}

/**
 * The open disputes on an expense that I am allowed to answer (not my own; I added it, paid it or administer its
 * group). Editing the expense asks whether it resolves them (F-1210, 26.20). Empty in Add mode (no `expenseId`).
 */
export function useResolvableDisputes(expenseId: string | undefined): Entity<Dispute>[] {
  const open = useProjection(expenseId ? openQuery : null)
  const access = useDisputeAccess('expense', expenseId)
  const list = expenseId ? open?.byRecord.get(keyOf('expense', expenseId)) : undefined
  return useMemo(() => (list ?? NONE).filter(d => d.data.kind === 'dispute' && access.canDo(d.data, 'accept')), [list, access.record]) // eslint-disable-line react-hooks/exhaustive-deps
}

const recordsQuery: Query<HistoryEntry[]> = {
  key: 'disputes:records',
  isTouchedBy: c => touches(c, 'dispute') || isMoneyChange(c),
  loader: store => async (_c, prev) => {
    const next = await loadDisputedRecords(store)
    return prev && prev.length === next.length && prev.every((p, i) => p.entity.id === next[i]!.entity.id && p.entity.version === next[i]!.entity.version) ? prev : next
  },
}

/**
 * The live records with an open dispute or hold, newest first, whichever pages of a list are loaded: what "Disputed only"
 * shows on a group and a person. Read only while `enabled`. Undefined while loading.
 */
export function useDisputedRecords(enabled: boolean): HistoryEntry[] | undefined {
  return useProjection(enabled ? recordsQuery : null)
}
