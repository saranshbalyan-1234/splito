import {
  computeShares,
  type CurrencyCode,
  DomainError,
  getCurrency,
  type LocalDate,
  parseLocalDate,
  type SplitInput,
  validateExpense,
} from '@splito/domain'

import type {Store, Tx} from './store'
import type {Entity, EntityType, MutationCtx} from './types'

export interface Person {
  name: string
  isMe: boolean
}

export interface Group {
  name: string
  kind: 'trip' | 'home' | 'couple' | 'other'
  currency: CurrencyCode
  members: Array<{personId: string; joinedAt: number; leftAt: number | null}>
  startDate: LocalDate | null
  endDate: LocalDate | null
  archived: boolean
}

export interface Expense {
  title: string
  groupId: string | null
  currency: CurrencyCode
  total: bigint
  payers: Record<string, bigint>
  split: SplitInput
  shares: Record<string, bigint>
  date: LocalDate
  tz: string
  category: string
  notes: string
}

export type ExpenseDraft = Omit<Expense, 'shares'>

/** Versioned write: entity, history row and outbox op, all inside the caller's transaction. */
async function write<T>(tx: Tx, ctx: MutationCtx, type: EntityType, id: string, data: T, deleted: boolean, opType: string): Promise<Entity<T>> {
  const prev = await tx.get<T>(type, id)
  const at = ctx.now()
  const e: Entity<T> = {type, id, data, version: (prev?.version ?? 0) + 1, deleted, updatedAt: at}
  await tx.put(e)
  await tx.appendHistory({entityType: type, entityId: id, version: e.version, data, deleted, at, actor: ctx.actor})
  await tx.enqueue({
    opId: ctx.newId(),
    deviceId: ctx.deviceId,
    actor: ctx.actor,
    entityType: type,
    entityId: id,
    opType,
    baseVersion: prev?.version ?? 0,
    payload: deleted ? {deleted: true} : data,
    schemaVersion: 1,
    deps: [],
    attempts: 0,
    nextAttemptAt: null,
    lastError: null,
  })
  return e
}

function cleanName(name: string) {
  const n = name.trim()
  if (!n) throw new DomainError('INVALID_NAME')
  return n
}

async function requireLive<T>(tx: Tx, type: EntityType, id: string, code = 'NOT_FOUND'): Promise<Entity<T>> {
  const e = await tx.get<T>(type, id)
  if (!e || e.deleted) throw new DomainError(code)
  return e
}

export async function ensureMe(store: Store, ctx: MutationCtx, name: string): Promise<Entity<Person>> {
  return store.transaction(async tx => (await tx.get<Person>('person', ctx.actor)) ?? write(tx, ctx, 'person', ctx.actor, {name: cleanName(name), isMe: true}, false, 'person.create'))
}

export async function createPerson(store: Store, ctx: MutationCtx, input: {name: string}): Promise<Entity<Person>> {
  const data: Person = {name: cleanName(input.name), isMe: false}
  return store.transaction(tx => write(tx, ctx, 'person', ctx.newId(), data, false, 'person.create'))
}

export async function deletePerson(store: Store, ctx: MutationCtx, id: string): Promise<void> {
  // ponytail: reference check reads outside the write transaction (IndexedDB can't await other
  // reads mid-transaction). Fine for one local writer; the server re-checks once sync exists.
  const expenses = await store.getAll<Expense>('expense')
  const groups = await store.getAll<Group>('group')
  const used =
    expenses.some(e => !e.deleted && (id in e.data.payers || id in e.data.shares)) ||
    groups.some(g => !g.deleted && g.data.members.some(m => m.personId === id))
  if (used) throw new DomainError('PERSON_IN_USE')
  await store.transaction(async tx => {
    const p = await requireLive<Person>(tx, 'person', id)
    if (p.data.isMe) throw new DomainError('PERSON_IN_USE')
    await write(tx, ctx, 'person', id, p.data, true, 'person.delete')
  })
}

export async function createGroup(
  store: Store,
  ctx: MutationCtx,
  input: Omit<Group, 'members' | 'archived'> & {memberIds: string[]},
): Promise<Entity<Group>> {
  getCurrency(input.currency)
  if (input.startDate) parseLocalDate(input.startDate)
  if (input.endDate) parseLocalDate(input.endDate)
  const ids = [...new Set([ctx.actor, ...input.memberIds])]
  return store.transaction(async tx => {
    for (const pid of ids) await requireLive(tx, 'person', pid, 'UNKNOWN_PERSON')
    const joinedAt = ctx.now()
    const {memberIds: _m, ...rest} = input
    const data: Group = {...rest, name: cleanName(input.name), members: ids.map(personId => ({personId, joinedAt, leftAt: null})), archived: false}
    return write(tx, ctx, 'group', ctx.newId(), data, false, 'group.create')
  })
}

/** Validates a draft against domain rules and current people/group state; returns the stored shape. */
async function buildExpense(tx: Tx, d: ExpenseDraft): Promise<Expense> {
  cleanName(d.title)
  getCurrency(d.currency)
  parseLocalDate(d.date)
  const shares = computeShares(d.total, d.split)
  validateExpense({total: d.total, payers: d.payers, shares})
  const people = [...new Set([...Object.keys(d.payers), ...Object.keys(shares)])]
  for (const pid of people) await requireLive(tx, 'person', pid, 'UNKNOWN_PERSON')
  if (d.groupId) {
    const g = await requireLive<Group>(tx, 'group', d.groupId)
    const current = new Set(g.data.members.filter(m => m.leftAt === null).map(m => m.personId))
    if (people.some(p => !current.has(p))) throw new DomainError('NOT_A_MEMBER')
  }
  return {...d, shares}
}

export async function createExpense(store: Store, ctx: MutationCtx, d: ExpenseDraft): Promise<Entity<Expense>> {
  return store.transaction(async tx => write(tx, ctx, 'expense', ctx.newId(), await buildExpense(tx, d), false, 'expense.create'))
}

export async function updateExpense(store: Store, ctx: MutationCtx, id: string, d: ExpenseDraft): Promise<Entity<Expense>> {
  return store.transaction(async tx => {
    await requireLive(tx, 'expense', id)
    return write(tx, ctx, 'expense', id, await buildExpense(tx, d), false, 'expense.update')
  })
}

export async function deleteExpense(store: Store, ctx: MutationCtx, id: string): Promise<void> {
  await store.transaction(async tx => {
    const e = await requireLive<Expense>(tx, 'expense', id)
    await write(tx, ctx, 'expense', id, e.data, true, 'expense.delete')
  })
}

export async function restoreExpense(store: Store, ctx: MutationCtx, id: string): Promise<void> {
  await store.transaction(async tx => {
    const e = await tx.get<Expense>('expense', id)
    if (!e?.deleted) throw new DomainError('NOT_FOUND')
    await write(tx, ctx, 'expense', id, e.data, false, 'expense.restore')
  })
}
