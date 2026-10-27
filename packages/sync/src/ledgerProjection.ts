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
import {type LedgerRecord, recordCells, recordEffects, type SpendCell} from '@splito/domain'

import {decode} from './codec'
import {type RowAccess} from './engine'
import {type Expense, type Group, type Repayment} from './mutations'
import {type Key, type Row} from './schema'
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

/** One row per person on a live expense. */
export function partyRows(e: Entity<Expense> | undefined): Row[] {
  if (!e || e.deleted || !e.data?.payers || !e.data.shares) return []
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
    deleted: 0,
    ...syncFields(e),
  }))
}

/** One row per member of a live group. */
export function memberRows(e: Entity<Group> | undefined): Row[] {
  if (!e || e.deleted || !Array.isArray(e.data?.members)) return []
  return e.data.members.map(m => ({
    id: `${e.id}:${m.personId}`,
    groupId: e.id,
    personId: m.personId,
    joinedAt: m.joinedAt,
    leftAt: m.leftAt ?? null,
    role: 'member',
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

/** The cells of a live money entity (`recordCells` of its record). */
function cellsOf(e: Entity | undefined): SpendCell[] {
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
    const aggs: Aggregates = new Map()
    addAggregates(aggs, cellsOf(prev), -1)
    addAggregates(aggs, cellsOf(next), 1)
    await writeAggregates(rows, aggs, (next ?? prev)!.updatedAt)
    // Any change to a record in a group or on a person, a delete included, is their latest activity (26.17).
    if (next) {
      for (const groupId of new Set([groupOf(prev), groupOf(next)])) if (groupId) await bumpActivity(rows, 'groups', groupId, next.updatedAt)
      for (const personId of new Set([...peopleOf(prev), ...peopleOf(next)])) await bumpActivity(rows, 'people', personId, next.updatedAt)
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
  for (const store of ['expense_parties', 'group_members', 'balances', 'pair_balances', 'aggregates', 'search_terms'] as const) await rows.clear(store)
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
      addAggregates(aggs, cellsOf(e), 1)
      latest = Math.max(latest, e.updatedAt)
      money.push(e)
    }
  }
  await writeSums(rows, nets, pairs, latest)
  await writeAggregates(rows, aggs, latest)
  for (const type of ['person', 'group', 'expense'] as const) for (const e of type === 'group' ? groups : await entities(type)) for (const r of termRows(e)) await rows.put('search_terms', r)
  await rebuildActivity(rows, money)
}

/**
 * Sets each group's `activityAt` and each person's `lastActivityAt` from the
 * history: every version of a money record bumps the groups and people it and
 * the version before it name, at that version's time, exactly as the write
 * did (a record moved out of a group is activity there too). `money` is the
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
      for (const personId of peopleOf(e)) bump(personAt, personId, at)
    }
  }
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
