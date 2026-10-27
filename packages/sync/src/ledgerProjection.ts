/**
 * The derived tables behind the hot screens (ARCHITECTURE 9.8): who paid and
 * owes what per expense (`expense_parties`), who is in which group
 * (`group_members`), and the balance sums (`balances`, `pair_balances`).
 * `projectEntity` runs inside the same transaction as every entity write, so
 * they can never drift; `rebuildProjections` recomputes all of them from the
 * entity rows (maintenance, migration, and the property test's reference).
 *
 * The money arithmetic is the domain's `recordEffects`; this file only keeps
 * its sums.
 */
import {type LedgerRecord, recordEffects} from '@splito/domain'

import type {RowAccess} from './engine'
import type {Expense, Group, Repayment} from './mutations'
import type {Key, Row} from './schema'
import {toExpenseRecord, toRepaymentRecord, toWriteOffRecord} from './selectors'
import type {Entity, EntityType} from './types'

type Sums = Map<string, {key: Key; amount: bigint; count: number}>

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
  if (type === 'expense' || type === 'repayment' || type === 'writeoff') {
    const nets: Sums = new Map()
    const pairs: Sums = new Map()
    addEffects(recordOf(prev), -1, nets, pairs)
    addEffects(recordOf(next), 1, nets, pairs)
    await writeSums(rows, nets, pairs, (next ?? prev)!.updatedAt)
  }
}

/**
 * Recomputes members, parties and balances from the entity rows, replacing
 * what is there. `entities` yields every row of the given type.
 */
export async function rebuildProjections(rows: RowAccess, entities: (type: EntityType) => Promise<Entity[]>): Promise<void> {
  for (const store of ['expense_parties', 'group_members', 'balances', 'pair_balances'] as const) await rows.clear(store)
  for (const g of (await entities('group')) as Entity<Group>[]) for (const r of memberRows(g)) await rows.put('group_members', r)
  const nets: Sums = new Map()
  const pairs: Sums = new Map()
  let latest = 0
  for (const type of ['expense', 'repayment', 'writeoff'] as const) {
    for (const e of await entities(type)) {
      if (type === 'expense') for (const r of partyRows(e as Entity<Expense>)) await rows.put('expense_parties', r)
      addEffects(recordOf(e), 1, nets, pairs)
      latest = Math.max(latest, e.updatedAt)
    }
  }
  await writeSums(rows, nets, pairs, latest)
}
