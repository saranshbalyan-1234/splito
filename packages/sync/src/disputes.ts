/**
 * Disputes and holds (ARCHITECTURE 26.20, owner 119; F-1210). A participant says "this is wrong" or "wait" about an
 * expense, one item of a bill, a payment or a write-off without editing someone else's record, and it is answered in
 * the open. The record keeps counting in balances; the `disputed_balances` / `disputed_pairs` projections (kept in
 * the same transaction, `ledgerProjection.ts`) say how much of each balance sits on such records. Every change is a
 * versioned write with history and an outbox op; who may do what is `@splito/domain` `permissions.ts`.
 */
import {
  allocate,
  canDispute,
  canResolveDispute,
  DISPUTE_REASONS,
  type DisputeAction,
  type DisputeKind,
  type DisputeReason,
  type DisputeRecord,
  type DisputeState,
  type DisputeStatus,
  DomainError,
  type PermissionResult,
} from '@splito/domain'

import {deleteExpense, deleteRepayment, deleteWriteOffs, type Expense, type ExpenseDraft, type Group, groupAdmins, requireLive, type Repayment, updateExpense, write} from './mutations'
import {encode} from './codec'
import {type Key} from './schema'
import {insideTransaction, type Page, type Store, type Tx} from './store'
import {type HistoryEntry} from './selectors'
import {type Entity, type HistoryRow, type MutationCtx} from './types'

export {DISPUTE_REASONS}
export type {DisputeKind, DisputeReason, DisputeStatus}

/** What a dispute hangs on: an expense (or one item of it), a recorded payment, or a write-off ("Call it even"). */
export type DisputeTarget = 'expense' | 'repayment' | 'writeoff'
export const DISPUTE_TARGETS: readonly DisputeTarget[] = ['expense', 'repayment', 'writeoff']

/** A hold's reason is free text in `note`; this is its `reason` value. */
export type StoredReason = DisputeReason | 'hold'

/** The change the raiser proposes, so the answer can be one tap. */
export type ProposedFix =
  | {kind: 'amount'; amount: bigint}
  | {kind: 'share'; personId: string; amount: bigint}
  | {kind: 'payer'; personId: string}
  | {kind: 'duplicate'; of: string}

export interface Dispute {
  targetType: DisputeTarget
  targetId: string
  /** The disputed item of an itemized bill (its portion); null: the whole record. */
  itemId: string | null
  /** Where the record lives (null: outside groups); copied so a list or filter needs no second read. */
  groupId: string | null
  /** Who it is raised as: me, or (before the backend) a participant I recorded it for. */
  raisedBy: string
  /** Who recorded it on this device. */
  recordedBy: string
  kind: DisputeKind
  reason: StoredReason
  note: string
  proposedFix: ProposedFix | null
  status: DisputeStatus
  resolvedBy: string | null
  /** The answer's note (a rejection's reason, an acceptance's remark). */
  resolution: string
  resolvedAt: number | null
  /** How often a rejection was reopened. */
  reopenCount: number
}

export const DISPUTE_NOTE_MAX = 1000

export interface DisputeInput {
  /** Makes a retried save idempotent. */
  id?: string
  targetType: DisputeTarget
  targetId: string
  itemId?: string | null
  /** Who it is raised as; default me. */
  raisedBy?: string
  reason: DisputeReason
  note?: string
  proposedFix?: ProposedFix | null
}

export interface HoldInput {
  id?: string
  targetType: DisputeTarget
  targetId: string
  raisedBy?: string
  /** Why it waits ("waiting for the refund"): required. */
  note: string
}

const FIX_FOR: Partial<Record<DisputeReason, ProposedFix['kind']>> = {
  wrong_amount: 'amount',
  wrong_share: 'share',
  left_out: 'share',
  wrong_payer: 'payer',
  duplicate: 'duplicate',
}

function cleanNote(note: string | undefined, required: boolean): string {
  const n = (note ?? '').trim()
  if (required && !n) throw new DomainError('NOTE_REQUIRED')
  if (n.length > DISPUTE_NOTE_MAX) throw new DomainError('NOTE_TOO_LONG')
  return n
}

const deny = (r: PermissionResult) => {
  if (!r.ok) throw new DomainError(r.code)
}

/** The record a dispute names, as the permission checks need it. */
async function recordOf(tx: Tx, type: DisputeTarget, id: string): Promise<{entity: Entity<Expense & Repayment>; record: DisputeRecord}> {
  const entity = await requireLive<Expense & Repayment>(tx, type, id)
  const d = entity.data
  const isExpense = type === 'expense'
  const payers = isExpense ? Object.keys(d.payers) : [d.from]
  const participants = isExpense ? [...new Set([...Object.keys(d.payers), ...Object.keys(d.shares)])] : [d.from, d.to]
  const first = (await tx.history(type, id))[0]
  const group = d.groupId ? await tx.get<Group>('group', d.groupId) : undefined
  const live = group && !group.deleted ? group.data : undefined
  return {
    entity,
    record: {
      addedBy: first?.actor ?? '',
      participants,
      payers,
      groupMembers: live ? live.members.filter(m => m.leftAt === null).map(m => m.personId) : [],
      groupAdmins: live ? groupAdmins(live) : [],
    },
  }
}

/** One record's open disputes and holds (a handful at most). */
async function openOn(tx: Tx, type: DisputeTarget, id: string): Promise<Entity<Dispute>[]> {
  return (await tx.page<Dispute>('dispute', {index: 'byTargetStatus', eq: [type, id, 'open'], limit: 100})).items.filter(d => !d.deleted)
}

const stateOf = (d: Dispute): DisputeState => ({raisedBy: d.raisedBy, recordedBy: d.recordedBy, kind: d.kind, status: d.status, reopenCount: d.reopenCount})

async function raise(
  store: Store,
  ctx: MutationCtx,
  input: {id?: string; targetType: DisputeTarget; targetId: string; itemId?: string | null; raisedBy?: string; kind: DisputeKind; reason: StoredReason; note: string; proposedFix?: ProposedFix | null},
): Promise<Entity<Dispute>> {
  if (!DISPUTE_TARGETS.includes(input.targetType)) throw new DomainError('INVALID_DISPUTE_TARGET')
  if (input.kind === 'dispute' && !(DISPUTE_REASONS as readonly string[]).includes(input.reason)) throw new DomainError('INVALID_REASON')
  if (input.reason === 'not_received' && input.targetType !== 'repayment') throw new DomainError('INVALID_REASON')
  const fix = input.proposedFix ?? null
  if (fix) {
    if (input.kind !== 'dispute' || input.targetType !== 'expense' || FIX_FOR[input.reason as DisputeReason] !== fix.kind) throw new DomainError('INVALID_FIX')
    if ((fix.kind === 'amount' || fix.kind === 'share') && fix.amount < 0n) throw new DomainError('INVALID_FIX')
    // An item's dispute is about that portion: a whole-bill change (amount, payer, duplicate) is not its fix.
    if (input.itemId) throw new DomainError('INVALID_FIX')
    if (fix.kind === 'duplicate' && fix.of === input.targetId) throw new DomainError('INVALID_FIX')
  }
  const raisedBy = input.raisedBy ?? ctx.actor
  const id = input.id ?? ctx.newId()
  return store.transaction(async tx => {
    const existing = await tx.get<Dispute>('dispute', id)
    if (existing) {
      // A retry carries the same input and gets what is stored; a different input under the same id is not a retry.
      const e = existing.data
      const same = e.targetType === input.targetType && e.targetId === input.targetId && e.itemId === (input.itemId ?? null) && e.raisedBy === raisedBy && e.kind === input.kind && e.reason === input.reason && e.note === input.note && encode(e.proposedFix) === encode(fix)
      if (!same) throw new DomainError('IDEMPOTENCY_CONFLICT')
      return existing
    }
    const {entity, record} = await recordOf(tx, input.targetType, input.targetId)
    await requireLive(tx, 'person', raisedBy, 'UNKNOWN_PERSON')
    const itemId = input.itemId ?? null
    if (itemId !== null) {
      const split = input.targetType === 'expense' ? entity.data.split : undefined
      if (split?.mode !== 'items' || !split.items.some(i => i.id === itemId)) throw new DomainError('INVALID_ITEM')
    }
    if (fix?.kind === 'duplicate') await requireLive(tx, 'expense', fix.of, 'INVALID_FIX')
    if (fix && (fix.kind === 'share' || fix.kind === 'payer')) await requireLive(tx, 'person', fix.personId, 'UNKNOWN_PERSON')
    const mine = (await openOn(tx, input.targetType, input.targetId)).some(d => d.data.raisedBy === raisedBy)
    deny(canDispute(record, {raisedBy, kind: input.kind, reason: input.reason as DisputeReason}, mine))
    const data: Dispute = {
      targetType: input.targetType,
      targetId: input.targetId,
      itemId,
      groupId: entity.data.groupId ?? null,
      raisedBy,
      recordedBy: ctx.actor,
      kind: input.kind,
      reason: input.reason,
      note: input.note,
      proposedFix: fix,
      status: 'open',
      resolvedBy: null,
      resolution: '',
      resolvedAt: null,
      reopenCount: 0,
    }
    return write(tx, ctx, 'dispute', id, data, false, input.kind === 'hold' ? 'dispute.hold' : 'dispute.raise')
  })
}

/** Says "this is wrong" about a record. The note is required for `other`. The record keeps counting. */
export async function raiseDispute(store: Store, ctx: MutationCtx, input: DisputeInput): Promise<Entity<Dispute>> {
  const note = cleanNote(input.note, input.reason === 'other')
  return raise(store, ctx, {...input, kind: 'dispute', note})
}

/** Puts a record on hold ("waiting for the refund"): the light version of a dispute, with a required reason. */
export async function holdRecord(store: Store, ctx: MutationCtx, input: HoldInput): Promise<Entity<Dispute>> {
  return raise(store, ctx, {...input, kind: 'hold', reason: 'hold', note: cleanNote(input.note, true)})
}

async function load(tx: Tx, id: string) {
  const d = await tx.get<Dispute>('dispute', id)
  if (!d || d.deleted) throw new DomainError('NOT_FOUND')
  return d
}

async function close(tx: Tx, ctx: MutationCtx, d: Entity<Dispute>, action: DisputeAction, status: DisputeStatus, note: string, opType: string): Promise<Entity<Dispute>> {
  const {record} = await recordOf(tx, d.data.targetType, d.data.targetId)
  deny(canResolveDispute(record, stateOf(d.data), ctx.actor, action))
  return write(tx, ctx, 'dispute', d.id, {...d.data, status, resolvedBy: ctx.actor, resolution: note, resolvedAt: ctx.now()}, false, opType)
}

/** Lets a hold go. Any participant (or the adder, or an admin) may. */
export function releaseHold(store: Store, ctx: MutationCtx, id: string): Promise<Entity<Dispute>> {
  return store.transaction(async tx => close(tx, ctx, await load(tx, id), 'release', 'released', '', 'dispute.release'))
}

/** The raiser takes it back. */
export function withdrawDispute(store: Store, ctx: MutationCtx, id: string): Promise<Entity<Dispute>> {
  return store.transaction(async tx => close(tx, ctx, await load(tx, id), 'withdraw', 'withdrawn', '', 'dispute.withdraw'))
}

/** Says no, with a reason (required). Changes nothing on the record. */
export async function rejectDispute(store: Store, ctx: MutationCtx, id: string, input: {note: string}): Promise<Entity<Dispute>> {
  const note = cleanNote(input.note, true)
  return store.transaction(async tx => close(tx, ctx, await load(tx, id), 'reject', 'rejected', note, 'dispute.reject'))
}

/**
 * The raiser reopens a rejection with a new note: once for the raiser, after that only a group admin may.
 * Needs the record still live and no other open dispute of theirs on it.
 */
export async function reopenDispute(store: Store, ctx: MutationCtx, id: string, input: {note: string}): Promise<Entity<Dispute>> {
  const note = cleanNote(input.note, true)
  return store.transaction(async tx => {
    const d = await load(tx, id)
    const {record} = await recordOf(tx, d.data.targetType, d.data.targetId)
    deny(canResolveDispute(record, stateOf(d.data), ctx.actor, 'reopen'))
    if ((await openOn(tx, d.data.targetType, d.data.targetId)).some(o => o.data.raisedBy === d.data.raisedBy)) throw new DomainError('ALREADY_OPEN')
    return write(
      tx,
      ctx,
      'dispute',
      id,
      {...d.data, status: 'open', note, resolvedBy: null, resolution: '', resolvedAt: null, reopenCount: d.data.reopenCount + 1},
      false,
      'dispute.reopen',
    )
  })
}

const sum = (xs: Iterable<bigint>) => [...xs].reduce((a, b) => a + b, 0n)

/** `amounts` scaled to sum to `total`, in the same proportions (a person with 0 stays at 0). */
function scaled(total: bigint, amounts: Record<string, bigint>): Record<string, bigint> {
  const weights = Object.entries(amounts).filter(([, v]) => v > 0n)
  if (weights.length === 0) throw new DomainError('INVALID_FIX')
  return {...Object.fromEntries(Object.keys(amounts).map(id => [id, 0n])), ...allocate(total, weights.map(([id, weight]) => ({id, weight})))}
}

/**
 * Whether a proposed fix can be applied in one tap without changing how the record is split (ruling after the F-1210
 * review): an amount fix scales an equal, percent, shares or adjusted split (the rule stays) but not exact amounts or
 * a bill of items; a share fix needs an exact split (it sets that person's amount); a payer fix never touches the
 * split. A duplicate is deleted. Anything else is for "Edit it", by hand.
 */
export function fixApplies(e: Expense, fix: ProposedFix): boolean {
  switch (fix.kind) {
    case 'amount':
      return e.split.mode === 'equal' || e.split.mode === 'percent' || e.split.mode === 'shares' || e.split.mode === 'adjusted'
    case 'share':
      return e.split.mode === 'exact'
    case 'payer':
    case 'duplicate':
      return true
  }
}

/**
 * The expense the proposed fix makes, as a draft for `updateExpense` (the same validation as any edit); `NO_FIX` when
 * the fix does not apply in one tap (`fixApplies`). The split mode is never converted: an amount fix keeps the split
 * rule and scales what it needs to, a share fix sets one exact amount and spreads the rest over the others in
 * proportion, a payer fix makes that person the only payer.
 */
export function applyFix(e: Expense, fix: Exclude<ProposedFix, {kind: 'duplicate'}>): ExpenseDraft {
  if (!fixApplies(e, fix)) throw new DomainError('NO_FIX')
  const {shares, ...draft} = e
  if (fix.kind === 'payer') return {...draft, payers: {[fix.personId]: e.total}}
  if (fix.kind === 'amount') {
    const total = fix.amount
    if (total <= 0n) throw new DomainError('INVALID_FIX')
    const payers = Object.keys(e.payers).length === 1 ? {[Object.keys(e.payers)[0]!]: total} : scaled(total, e.payers)
    return {...draft, total, payers}
  }
  // share (exact split): the person's share becomes `amount`; everyone else keeps their proportion of what is left.
  if (fix.amount > e.total) throw new DomainError('INVALID_FIX')
  const others = Object.fromEntries(Object.entries(shares).filter(([id]) => id !== fix.personId))
  const rest = e.total - fix.amount
  const names = Object.keys(others)
  if (names.length === 0 && rest !== 0n) throw new DomainError('INVALID_FIX')
  const spread = names.length === 0 ? {} : sum(Object.values(others)) > 0n ? scaled(rest, others) : allocate(rest, names.map(id => ({id, weight: 1n})))
  return {...draft, split: {mode: 'exact', amounts: {...spread, [fix.personId]: fix.amount}}}
}

async function acceptIn(store: Store, tx: Tx, ctx: MutationCtx, id: string, input: {note?: string; apply?: boolean}) {
  const d = await load(tx, id)
  const {record, entity} = await recordOf(tx, d.data.targetType, d.data.targetId)
  deny(canResolveDispute(record, stateOf(d.data), ctx.actor, 'accept'))
  const note = cleanNote(input.note, false)
  // Marked first: a fix that deletes the record would otherwise close this dispute as Gone.
  const next: Dispute = {...d.data, status: 'accepted', resolvedBy: ctx.actor, resolution: note, resolvedAt: ctx.now()}
  const accepted = await write(tx, ctx, 'dispute', id, next, false, 'dispute.accept')
  if (!input.apply) return accepted
  const fix = d.data.proposedFix
  const inner = insideTransaction(store, tx)
  if (fix?.kind === 'duplicate') await deleteExpense(inner, ctx, d.data.targetId)
  else if (fix) await updateExpense(inner, ctx, d.data.targetId, applyFix(entity.data as Expense, fix))
  else if (d.data.reason === 'not_received') await deleteRepayment(inner, ctx, d.data.targetId)
  else if (d.data.targetType === 'writeoff') await deleteWriteOffs(inner, ctx, [d.data.targetId])
  else throw new DomainError('NO_FIX')
  return accepted
}

/**
 * Agrees with a dispute. With `apply`, the proposed fix is applied in the same transaction as a normal edit with
 * history (a duplicate, or a payment "not received", is deleted); without, it only records that the resolver agreed
 * (they edit by hand, or already did).
 */
export function acceptDispute(store: Store, ctx: MutationCtx, id: string, input: {note?: string; apply?: boolean} = {}): Promise<Entity<Dispute>> {
  return store.transaction(tx => acceptIn(store, tx, ctx, id, input))
}

/**
 * Saves an edit to an expense and marks the given open disputes accepted ("Does this resolve <name>'s dispute?"
 * answered yes), all in one transaction.
 */
export async function updateExpenseResolving(store: Store, ctx: MutationCtx, expenseId: string, draft: ExpenseDraft, resolveIds: readonly string[]): Promise<Entity<Expense>> {
  return store.transaction(async tx => {
    const saved = await updateExpense(insideTransaction(store, tx), ctx, expenseId, draft)
    for (const id of resolveIds) await acceptIn(store, tx, ctx, id, {})
    return saved
  })
}

/* -------------------------------------------------------------------------- */
/* Reads                                                                      */
/* -------------------------------------------------------------------------- */

export const DISPUTE_PAGE = 100

/** Every dispute and hold on one record, any state, oldest first, by cursor over `byTarget`. */
export function listDisputes(store: Store, targetType: DisputeTarget, targetId: string, q: {after?: Key | null; limit?: number} = {}): Promise<Page<Entity<Dispute>>> {
  return store.page<Dispute>('dispute', {index: 'byTarget', eq: [targetType, targetId], after: q.after, limit: q.limit ?? DISPUTE_PAGE})
}

/** Open disputes and holds, newest change first, by cursor over `byStatus`: the Disputed filter and badges. */
export function listOpenDisputes(store: Store, q: {after?: Key | null; limit?: number} = {}): Promise<Page<Entity<Dispute>>> {
  return store.page<Dispute>('dispute', {index: 'byStatus', eq: ['open'], dir: 'prev', after: q.after, limit: q.limit ?? DISPUTE_PAGE})
}

/** The system lines a dispute leaves in its record's thread and in Activity, one per history version. */
export type DisputeEventKind = 'raised' | 'held' | 'accepted' | 'rejected' | 'withdrawn' | 'reopened' | 'released' | 'gone'

export interface DisputeEvent {
  /** `<disputeId>:<version>`: stable forever. */
  key: string
  disputeId: string
  version: number
  at: number
  actor: string
  kind: DisputeEventKind
  data: Dispute
}

/** What a stored version of a dispute means, given the version before it (undefined: nothing worth a line). */
export function disputeEventKind(row: Pick<HistoryRow, 'data'>, prev: Pick<HistoryRow, 'data'> | undefined): DisputeEventKind | undefined {
  const d = row.data as Dispute
  if (!prev) return d.kind === 'hold' ? 'held' : 'raised'
  const was = prev.data as Dispute
  if (was.status === d.status) return undefined
  if (d.status === 'open') return 'reopened'
  return d.status === 'accepted' || d.status === 'rejected' || d.status === 'withdrawn' || d.status === 'released' || d.status === 'gone' ? d.status : undefined
}

/** The events of several disputes' histories, oldest first. */
export function disputeEvents(history: readonly HistoryRow[]): DisputeEvent[] {
  const byId = new Map<string, HistoryRow[]>()
  for (const h of history) if (h.entityType === 'dispute') byId.set(h.entityId, [...(byId.get(h.entityId) ?? []), h])
  const out: DisputeEvent[] = []
  for (const [disputeId, rows] of byId) {
    rows.sort((x, y) => x.version - y.version)
    rows.forEach((row, i) => {
      const kind = disputeEventKind(row, rows[i - 1])
      if (kind) out.push({key: `${disputeId}:${row.version}`, disputeId, version: row.version, at: row.at, actor: row.actor, kind, data: row.data as Dispute})
    })
  }
  return out.sort((x, y) => x.at - y.at || (x.key < y.key ? -1 : 1))
}

/**
 * Every dispute event of one record's disputes, oldest first: the system lines of its thread. Reads the record's
 * disputes by `byTarget` and their histories (a handful of rows).
 */
export async function loadDisputeEvents(store: Store, targetType: DisputeTarget, targetId: string): Promise<DisputeEvent[]> {
  const rows: Entity<Dispute>[] = []
  let after: Key | null = null
  do {
    const page: Page<Entity<Dispute>> = await listDisputes(store, targetType, targetId, {after})
    rows.push(...page.items)
    after = page.next
  } while (after)
  return disputeEvents(await store.historyMany(rows.map(r => ({type: 'dispute' as const, id: r.id}))))
}

/** The disputed or held part of the net balances (same selection as `store.balances`): the "of which disputed" figures. */
export const listDisputedBalances = (store: Store, q: {personId?: string; groupId?: string | null} = {}) => store.disputedBalances(q)

/** The disputed or held part of what others owe `personId` (or `otherId` owes them). */
export const listDisputedPairs = (store: Store, personId: string, otherId?: string) => store.disputedPairs(personId, otherId)

/**
 * Every live expense, payment and write-off with an open dispute or hold, newest first, as history entries: what the
 * "Disputed only" filter lists. Read from `byStatus` (the open disputes) and the records they name by id, so it never
 * depends on which pages of a list are loaded.
 */
export async function loadDisputedRecords(store: Store): Promise<HistoryEntry[]> {
  const ids: Record<DisputeTarget, Set<string>> = {expense: new Set(), repayment: new Set(), writeoff: new Set()}
  let after: Key | null = null
  do {
    const page: Page<Entity<Dispute>> = await listOpenDisputes(store, {after})
    for (const d of page.items) ids[d.data.targetType].add(d.data.targetId)
    after = page.next
  } while (after)
  const out: HistoryEntry[] = []
  for (const kind of DISPUTE_TARGETS) for (const entity of await store.getMany(kind, [...ids[kind]])) if (!entity.deleted) out.push({kind, entity} as HistoryEntry)
  return out.sort((x, y) => (x.entity.data as {date: string}).date < (y.entity.data as {date: string}).date ? 1 : (x.entity.data as {date: string}).date > (y.entity.data as {date: string}).date ? -1 : x.entity.id < y.entity.id ? -1 : 1)
}
