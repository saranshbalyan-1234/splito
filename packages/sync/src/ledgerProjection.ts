/**
 * The derived tables behind the hot screens (ARCHITECTURE 9.8): who paid and
 * owes what per expense (`expense_parties`), who is in which group
 * (`group_members`), the balance sums (`balances`, `pair_balances`), the
 * spending sums per month (`aggregates`), the search keys (`search_terms`) and
 * the activity times of groups and people. `projectEntity` runs inside the
 * same transaction as every entity write, so they can never drift;
 * `rebuildProjections` recomputes all of them from the entity rows and the
 * history (maintenance, migration, and the property test's reference).
 *
 * The money arithmetic is the domain's `recordEffects`; this file only keeps
 * its sums.
 */
import {allocate, type Debt, expenseDebts, type ExpenseRecord, type LedgerRecord, participantId, participantWeight, recordCells, recordEffects, type SpendCell} from '@splito/domain'

import {decode} from './codec'
import {type RowAccess} from './engine'
import {type Dispute} from './disputes'
import {type Expense, type Group, normalizeRoles, type Repayment} from './mutations'
import {ENTITY_STORE, entityOfRow, type Key, type Row} from './schema'
import {termKey, termRows} from './searchTerms'
import {toExpenseRecord, toRepaymentRecord, toWriteOffRecord} from './selectors'
import {type Entity, type EntityType} from './types'

type Sums = Map<string, {key: Key; amount: bigint; count: number}>
type Aggregates = Map<string, {key: Key; total: bigint; paid: bigint; share: bigint; net: bigint; count: number}>

const live = (e: Entity | undefined): e is Entity => !!e && !e.deleted

/**
 * The ledger record of a live money entity; undefined for everything else and
 * for a row whose data is not the shape this build knows (a newer device's
 * row stays stored, untouched, and counts for nothing here).
 */
function recordOf(e: Entity | undefined): LedgerRecord | undefined {
  if (!live(e)) return undefined
  const d = e.data as Partial<Expense & Repayment> | null
  if (e.type === 'expense') return d?.payers && d.shares && typeof d.currency === 'string' ? toExpenseRecord(e as Entity<Expense>) : undefined
  if (e.type === 'repayment' || e.type === 'writeoff') {
    if (typeof d?.from !== 'string' || typeof d.to !== 'string' || typeof d.amount !== 'bigint' || typeof d.currency !== 'string') return undefined
    return e.type === 'repayment' ? toRepaymentRecord(e as Entity<Repayment>) : toWriteOffRecord(e as Entity<Repayment>)
  }
  return undefined
}

const syncFields = (e: Entity) => ({
  version: e.version,
  updatedAt: e.updatedAt,
  syncStatus: e.syncStatus,
  serverVersion: e.serverVersion,
  syncedAt: e.syncedAt,
  syncError: e.syncError,
})

/** One row per person on an expense; a deleted expense keeps its rows (`deleted` 1) so a person's history can list it in place. */
export function partyRows(e: Entity<Expense> | undefined): Row[] {
  if (!e || !e.data?.payers || !e.data.shares) return []
  const d = e.data
  const people = [...new Set([...Object.keys(d.payers ?? {}), ...Object.keys(d.shares ?? {})])]
  return people.map(personId => ({
    id: `${e.id}:${personId}`,
    expenseId: e.id,
    personId,
    paid: String(d.payers?.[personId] ?? 0n),
    share: String(d.shares?.[personId] ?? 0n),
    groupId: d.groupId ?? '',
    currency: d.currency ?? '',
    date: d.date ?? '',
    createdAt: e.createdAt,
    deleted: e.deleted ? 1 : 0,
    ...syncFields(e),
  }))
}

/** One row per member of a live group. */
export function memberRows(e: Entity<Group> | undefined): Row[] {
  if (!e || e.deleted || !Array.isArray(e.data?.members)) return []
  return normalizeRoles(e.data.members).map(m => ({
    id: `${e.id}:${m.personId}`,
    groupId: e.id,
    personId: m.personId,
    joinedAt: m.joinedAt,
    leftAt: m.leftAt ?? null,
    role: m.role ?? 'member',
    createdAt: m.joinedAt,
    deleted: 0,
    ...syncFields(e),
  }))
}

function addSum(sums: Sums, key: Key, amount: bigint, count: number) {
  const id = JSON.stringify(key)
  const s = sums.get(id) ?? {key, amount: 0n, count: 0}
  s.amount += amount
  s.count += count
  sums.set(id, s)
}

/** Adds (`sign` 1) or removes (-1) one record's effects. */
function addEffects(r: LedgerRecord | undefined, sign: 1 | -1, nets: Sums, pairs: Sums) {
  if (!r) return
  const {net, debts} = recordEffects(r)
  const s = BigInt(sign)
  for (const {person, amount} of net) addSum(nets, [person, r.groupId ?? '', r.currency], amount * s, sign)
  for (const d of debts) {
    addSum(pairs, [d.creditor, d.debtor, r.currency], d.amount * s, 0)
    addSum(pairs, [d.debtor, d.creditor, r.currency], -d.amount * s, 0)
  }
}

/**
 * The cells of a live money entity (`recordCells` of its record); none for a deleted row or one whose data is not
 * the shape this build knows. Readers of the date indexes use it so they agree with the stored `aggregates`.
 */
export function cellsOfEntity(e: Entity | undefined): SpendCell[] {
  const r = recordOf(e)
  return r ? recordCells(r.kind === 'expense' ? {...r, category: (e!.data as Expense).category} : r) : []
}

/** Adds (`sign` 1) or removes (-1) cells to the per-month sums. */
function addAggregates(aggs: Aggregates, cells: SpendCell[], sign: 1 | -1) {
  const s = BigInt(sign)
  for (const c of cells) {
    const key: Key = [c.currency, c.date.slice(0, 7), c.groupId, c.category, c.person, c.kind]
    const id = JSON.stringify(key)
    const a = aggs.get(id) ?? {key, total: 0n, paid: 0n, share: 0n, net: 0n, count: 0}
    a.total += c.total * s
    a.paid += c.paid * s
    a.share += c.share * s
    a.net += c.net * s
    a.count += c.count * sign
    aggs.set(id, a)
  }
}

async function writeAggregates(rows: RowAccess, aggs: Aggregates, now: number) {
  for (const {key, ...delta} of aggs.values()) {
    const [currency, month, groupId, categoryId, personId, kind] = key as [string, string, string, string, string, string]
    const cur = await rows.get('aggregates', key)
    const sum = (field: 'total' | 'paid' | 'share' | 'net') => (cur ? BigInt(cur[field] as string) : 0n) + delta[field]
    const next = {total: sum('total'), paid: sum('paid'), share: sum('share'), net: sum('net'), count: ((cur?.count as number | undefined) ?? 0) + delta.count}
    if (next.count <= 0 && next.total === 0n && next.paid === 0n && next.share === 0n && next.net === 0n) {
      if (cur) await rows.delete('aggregates', key)
    } else
      await rows.put('aggregates', {
        currency, month, groupId, categoryId, personId, kind,
        total: String(next.total), paid: String(next.paid), share: String(next.share), net: String(next.net), count: next.count, updatedAt: now,
      })
  }
}

async function writeSums(rows: RowAccess, nets: Sums, pairs: Sums, now: number) {
  for (const {key, amount, count} of nets.values()) {
    const [personId, groupId, currency] = key as [string, string, string]
    const cur = await rows.get('balances', key)
    const total = (cur ? BigInt(cur.amount as string) : 0n) + amount
    const n = ((cur?.count as number | undefined) ?? 0) + count
    if (n <= 0 && total === 0n) {
      if (cur) await rows.delete('balances', key)
    } else await rows.put('balances', {personId, groupId, currency, amount: String(total), count: n, updatedAt: now})
  }
  for (const {key, amount} of pairs.values()) {
    const [personId, otherId, currency] = key as [string, string, string]
    const cur = await rows.get('pair_balances', key)
    const total = (cur ? BigInt(cur.amount as string) : 0n) + amount
    if (total === 0n) {
      if (cur) await rows.delete('pair_balances', key)
    } else await rows.put('pair_balances', {personId, otherId, currency, amount: String(total), updatedAt: now})
  }
}

/**
 * Brings the derived tables in line with one entity write: `prev` is the row
 * before, `next` the row after (undefined: the row is gone). Reads and
 * writes only through `rows`, so it is part of the caller's transaction.
 */
export async function projectEntity(rows: RowAccess, prev: Entity | undefined, next: Entity | undefined): Promise<void> {
  const type = (next ?? prev)?.type
  if (type === 'dispute') return projectDispute(rows, prev as Entity<Dispute> | undefined, next as Entity<Dispute> | undefined)
  if (type === 'expense') {
    const was = partyRows(prev as Entity<Expense> | undefined)
    const is = partyRows(next as Entity<Expense> | undefined)
    const kept = new Set(is.map(r => r.personId))
    for (const r of was) if (!kept.has(r.personId)) await rows.delete('expense_parties', [r.expenseId as string, r.personId as string])
    for (const r of is) await rows.put('expense_parties', r)
  } else if (type === 'group') {
    const was = memberRows(prev as Entity<Group> | undefined)
    const is = memberRows(next as Entity<Group> | undefined)
    const kept = new Set(is.map(r => r.personId))
    for (const r of was) if (!kept.has(r.personId)) await rows.delete('group_members', [r.groupId as string, r.personId as string])
    for (const r of is) await rows.put('group_members', r)
  }
  // Only the sync fields moved (an op queued, acknowledged, failed): nothing derived from the data changes.
  if (prev && next && prev.data === next.data && prev.deleted === next.deleted) return
  if (type === 'expense' || type === 'repayment' || type === 'writeoff') {
    const nets: Sums = new Map()
    const pairs: Sums = new Map()
    addEffects(recordOf(prev), -1, nets, pairs)
    addEffects(recordOf(next), 1, nets, pairs)
    await writeSums(rows, nets, pairs, (next ?? prev)!.updatedAt)
    // A disputed record that changes moves its disputed part with it (the open disputes are read by index, a few rows).
    const open = await openDisputesOf(rows, type, (next ?? prev)!.id)
    if (open.length) {
      const dn: Sums = new Map()
      const dp: Sums = new Map()
      addDisputed(disputedPart(prev, open), -1, dn, dp)
      addDisputed(disputedPart(next, open), 1, dn, dp)
      await writeDisputed(rows, dn, dp, (next ?? prev)!.updatedAt)
    }
    const aggs: Aggregates = new Map()
    addAggregates(aggs, cellsOfEntity(prev), -1)
    addAggregates(aggs, cellsOfEntity(next), 1)
    await writeAggregates(rows, aggs, (next ?? prev)!.updatedAt)
    // Any change to a record in a group or on a person, a delete included, is their latest activity (26.17).
    if (next) {
      for (const groupId of new Set([groupOf(prev), groupOf(next)])) if (groupId) await bumpActivity(rows, 'groups', groupId, next.updatedAt)
      // A friend is active when a record I am on changes; two friends' own record is not my activity (audit m20).
      for (const side of [prev, next]) {
        const names = peopleOf(side)
        if (await isMeAmong(rows, names)) for (const personId of names) await bumpActivity(rows, 'people', personId, next.updatedAt)
      }
    }
  }
  if (type === 'expense' || type === 'person' || type === 'group') {
    const was = termRows(prev)
    const is = termRows(next)
    const kept = new Set(is.map(r => JSON.stringify(termKey(r))))
    const had = new Set(was.map(r => JSON.stringify(termKey(r))))
    for (const r of was) if (!kept.has(JSON.stringify(termKey(r)))) await rows.delete('search_terms', termKey(r))
    for (const r of is) if (!had.has(JSON.stringify(termKey(r)))) await rows.put('search_terms', r)
  }
}

const groupOf = (e: Entity | undefined) => (e?.data as {groupId?: string | null} | undefined)?.groupId ?? null

/** Everyone a money entity names (its data as stored, a deleted record included). */
function peopleOf(e: Entity | undefined): string[] {
  const d = e?.data as Partial<Expense & Repayment> | null | undefined
  if (!d) return []
  if (e!.type === 'expense') return [...new Set([...Object.keys(d.payers ?? {}), ...Object.keys(d.shares ?? {})])]
  return [d.from, d.to].filter((p): p is string => typeof p === 'string')
}

/** Whether one of `ids` is the local "me" (its people row says `isMe`). */
async function isMeAmong(rows: RowAccess, ids: string[]): Promise<boolean> {
  for (const id of ids) if ((await rows.get('people', [id]))?.isMe === 1) return true
  return false
}

/** Raises a group's `activityAt` or a person's `lastActivityAt`, never lowers it. */
async function bumpActivity(rows: RowAccess, store: 'groups' | 'people', id: string, at: number) {
  const column = store === 'groups' ? 'activityAt' : 'lastActivityAt'
  const r = await rows.get(store, [id])
  if (r && (r[column] as number) < at) await rows.put(store, {...r, [column]: at})
}

/**
 * Recomputes every derived table from the entity rows and the history,
 * replacing what is there. `entities` yields every row of the given type.
 */
export async function rebuildProjections(rows: RowAccess, entities: (type: EntityType) => Promise<Entity[]>): Promise<void> {
  for (const store of ['expense_parties', 'group_members', 'balances', 'pair_balances', 'aggregates', 'search_terms', 'disputed_balances', 'disputed_pairs'] as const)
    await rows.clear(store)
  const groups = (await entities('group')) as Entity<Group>[]
  for (const g of groups) for (const r of memberRows(g)) await rows.put('group_members', r)
  const nets: Sums = new Map()
  const pairs: Sums = new Map()
  const aggs: Aggregates = new Map()
  const money: Entity[] = []
  let latest = 0
  for (const type of ['expense', 'repayment', 'writeoff'] as const) {
    for (const e of await entities(type)) {
      if (type === 'expense') for (const r of partyRows(e as Entity<Expense>)) await rows.put('expense_parties', r)
      addEffects(recordOf(e), 1, nets, pairs)
      addAggregates(aggs, cellsOfEntity(e), 1)
      latest = Math.max(latest, e.updatedAt)
      money.push(e)
    }
  }
  await writeSums(rows, nets, pairs, latest)
  await writeAggregates(rows, aggs, latest)
  await rebuildDisputedProjections(rows, entities)
  for (const type of ['person', 'group', 'expense'] as const) for (const e of type === 'group' ? groups : await entities(type)) for (const r of termRows(e)) await rows.put('search_terms', r)
  await rebuildActivity(rows, money)
}

/* -------------------------------------------------------------------------- */
/* Disputed sums (F-1210): the part of the balances on disputed or held records */
/* -------------------------------------------------------------------------- */

/** An open dispute or hold with its id. */
type OpenDispute = Pick<Dispute, 'itemId'> & {id: string}

/** The open disputes and holds on one record, by `byTargetStatus` (a handful of rows at most). */
async function openDisputesOf(rows: RowAccess, targetType: string, targetId: string): Promise<OpenDispute[]> {
  const found = await rows.range('disputes', {index: 'byTargetStatus', eq: [targetType, targetId, 'open']})
  return found.filter(r => r.deleted === 0).map(r => ({id: r.id as string, itemId: (decode(r.data as string) as Dispute).itemId ?? null}))
}

/**
 * The part of a live record that open disputes mark, as a ledger record: all of it when a dispute names the
 * record (or the record has no items), otherwise only the disputed items' portions (each item split among its
 * participants by weight, paid by the payers in proportion to what they paid; charges are not part of an item).
 * ponytail: an item's share of tax and tip is not counted as disputed; refine with `itemBreakdown` if asked.
 */
function disputedPart(e: Entity | undefined, open: ReadonlyArray<Pick<OpenDispute, 'itemId'>>): LedgerRecord | undefined {
  const record = recordOf(e)
  if (!record || open.length === 0) return undefined
  const split = record.kind === 'expense' ? (e!.data as Expense).split : undefined
  if (!split || split.mode !== 'items' || open.some(d => d.itemId === null)) return record
  /* Items are found by their own id: a reordered bill moves nothing, and an item an edit removed counts for nothing. */
  const wanted = new Set(open.map(d => d.itemId))
  const picked = split.items.filter(i => wanted.has(i.id))
  if (picked.length === 0) return undefined
  const shares: Record<string, bigint> = {}
  let total = 0n
  for (const item of picked) {
    total += item.amount
    const part = allocate(item.amount, item.participants.map(p => ({id: participantId(p), weight: BigInt(participantWeight(p))})))
    for (const [id, v] of Object.entries(part)) shares[id] = (shares[id] ?? 0n) + v
  }
  const paid = Object.entries((record as ExpenseRecord).payers).filter(([, v]) => v > 0n)
  const payers = paid.length ? allocate(total, paid.map(([id, v]) => ({id, weight: v}))) : {}
  return {...(record as ExpenseRecord), payers, shares}
}

/** Who owes whom on a record, inside groups too (the stored `pair_balances` keep direct debts only). */
function pairDebts(r: LedgerRecord): Debt[] {
  if (r.kind === 'expense') return expenseDebts(r)
  return [{debtor: r.to, creditor: r.from, amount: r.amount}]
}

/** Adds (`sign` 1) or removes (-1) a disputed part: nets per `[person, group, currency]`, debts per `[person, other, group, currency]`. */
function addDisputed(r: LedgerRecord | undefined, sign: 1 | -1, nets: Sums, pairs: Sums) {
  if (!r) return
  const s = BigInt(sign)
  for (const {person, amount} of recordEffects(r).net) addSum(nets, [person, r.groupId ?? '', r.currency], amount * s, sign)
  for (const d of pairDebts(r)) {
    addSum(pairs, [d.creditor, d.debtor, r.groupId ?? '', r.currency], d.amount * s, 0)
    addSum(pairs, [d.debtor, d.creditor, r.groupId ?? '', r.currency], -d.amount * s, 0)
  }
}

async function writeDisputed(rows: RowAccess, nets: Sums, pairs: Sums, now: number) {
  for (const {key, amount, count} of nets.values()) {
    const [personId, groupId, currency] = key as [string, string, string]
    const cur = await rows.get('disputed_balances', key)
    const total = (cur ? BigInt(cur.amount as string) : 0n) + amount
    const n = ((cur?.count as number | undefined) ?? 0) + count
    if (n <= 0 && total === 0n) {
      if (cur) await rows.delete('disputed_balances', key)
    } else await rows.put('disputed_balances', {personId, groupId, currency, amount: String(total), count: n, updatedAt: now})
  }
  for (const {key, amount} of pairs.values()) {
    const [personId, otherId, groupId, currency] = key as [string, string, string, string]
    const cur = await rows.get('disputed_pairs', key)
    const total = (cur ? BigInt(cur.amount as string) : 0n) + amount
    if (total === 0n) {
      if (cur) await rows.delete('disputed_pairs', key)
    } else await rows.put('disputed_pairs', {personId, otherId, groupId, currency, amount: String(total), updatedAt: now})
  }
}

/**
 * Moves the disputed sums when a dispute opens or closes: the record's disputed part before the change comes off,
 * the part after goes on. A record that is not live counts for nothing (its own write already took its part off).
 */
async function projectDispute(rows: RowAccess, prev: Entity<Dispute> | undefined, next: Entity<Dispute> | undefined) {
  const was = prev && !prev.deleted && prev.data?.status === 'open' ? prev.data : undefined
  const is = next && !next.deleted && next.data?.status === 'open' ? next.data : undefined
  if (!was && !is) return
  const d = (is ?? was)!
  if (was && is && was.itemId === is.itemId && was.targetId === is.targetId) return
  const id = (next ?? prev)!.id
  const raw = await rows.get(ENTITY_STORE[d.targetType], [d.targetId])
  const target = raw ? entityOfRow(d.targetType, raw) : undefined
  if (!live(target)) return
  const others = (await openDisputesOf(rows, d.targetType, d.targetId)).filter(o => o.id !== id)
  const before = was ? [...others, {id, itemId: was.itemId ?? null}] : others
  const after = is ? [...others, {id, itemId: is.itemId ?? null}] : others
  const nets: Sums = new Map()
  const pairs: Sums = new Map()
  addDisputed(disputedPart(target, before), -1, nets, pairs)
  addDisputed(disputedPart(target, after), 1, nets, pairs)
  await writeDisputed(rows, nets, pairs, (next ?? prev)!.updatedAt)
}

/** Recomputes `disputed_balances` and `disputed_pairs` from the open disputes and the live records they name. */
export async function rebuildDisputedProjections(rows: RowAccess, entities: (type: EntityType) => Promise<Entity[]>): Promise<void> {
  await rows.clear('disputed_balances')
  await rows.clear('disputed_pairs')
  const byTarget = new Map<string, {type: Dispute['targetType']; id: string; open: OpenDispute[]}>()
  for (const e of (await entities('dispute')) as Entity<Dispute>[]) {
    if (e.deleted || e.data?.status !== 'open') continue
    const key = `${e.data.targetType}:${e.data.targetId}`
    const group = byTarget.get(key) ?? {type: e.data.targetType, id: e.data.targetId, open: []}
    group.open.push({id: e.id, itemId: e.data.itemId ?? null})
    byTarget.set(key, group)
  }
  const nets: Sums = new Map()
  const pairs: Sums = new Map()
  let latest = 0
  for (const {type, id, open} of byTarget.values()) {
    const raw = await rows.get(ENTITY_STORE[type], [id])
    const target = raw ? entityOfRow(type, raw) : undefined
    addDisputed(disputedPart(target, open), 1, nets, pairs)
    latest = Math.max(latest, target?.updatedAt ?? 0)
  }
  await writeDisputed(rows, nets, pairs, latest)
}

/**
 * Sets each group's `activityAt` and each person's `lastActivityAt` from the
 * history: every version of a money record bumps the groups and people it and
 * the version before it name, at that version's time, exactly as the write
 * did (a record moved out of a group is activity there too; a friend only counts for a record I am on, audit m20). `money` is the
 * live and deleted money entities, for any whose history is missing.
 */
export async function rebuildActivity(rows: RowAccess, money: Entity[]): Promise<void> {
  const groupAt = new Map<string, number>()
  const personAt = new Map<string, number>()
  const bump = (map: Map<string, number>, id: string, at: number) => map.set(id, Math.max(map.get(id) ?? 0, at))
  const touch = (data: Entity | undefined, at: number, ...before: Array<Entity | undefined>) => {
    for (const e of [data, ...before]) {
      const groupId = groupOf(e)
      if (groupId) bump(groupAt, groupId, at)
      const names = peopleOf(e)
      if (names.some(p => me.has(p))) for (const personId of names) bump(personAt, personId, at)
    }
  }
  const me = new Set((await rows.range('people', {})).filter(p => p.isMe === 1).map(p => p.id as string))
  const isMoney = new Set<string>(['expense', 'repayment', 'writeoff'])
  let previous: {key: string; entity: Entity} | undefined
  for (const h of await rows.range('history', {})) {
    if (!isMoney.has(h.entityType as string)) continue
    const key = `${h.entityType}:${h.entityId}`
    const entity = {type: h.entityType, data: decode(h.data as string)} as Entity
    touch(entity, h.at as number, previous?.key === key ? previous.entity : undefined)
    previous = {key, entity}
  }
  for (const e of money) touch(e, e.updatedAt)
  for (const g of await rows.range('groups', {})) {
    const at = Math.max(g.updatedAt as number, groupAt.get(g.id as string) ?? 0)
    if (g.activityAt !== at) await rows.put('groups', {...g, activityAt: at})
  }
  for (const p of await rows.range('people', {})) {
    const at = personAt.get(p.id as string) ?? 0
    if (p.lastActivityAt !== at) await rows.put('people', {...p, lastActivityAt: at})
  }
}
