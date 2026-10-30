import {
  assertInRange,
  capitalizeName,
  computeShares,
  type Contact,
  type CurrencyCode,
  DomainError,
  type EdgeRule,
  getCurrency,
  type LocalDate,
  parseLocalDate,
  type SettlementRules,
  type SplitInput,
  validateExpense,
} from '@splito/domain'

import {formatContact, isContact} from './contact'
import {type Dispute} from './disputes'
import {type GroupRequest} from './groupJoins'
import {requestState} from './requests'
import {editIdsPref, unhideItems} from './preferences'
import {type Key} from './schema'
import {type Page, type Store, type Tx} from './store'
import {type Entity, type EntityType, type MutationCtx} from './types'

export interface Person {
  name: string
  isMe: boolean
  /** UPI ID (VPA) used for `upi://pay` links. Optional; null or absent when unknown. */
  upiId?: string | null
  /** How to reach them (F-601: a private friend may have one). Absent on older rows. */
  contact?: Contact | null
  /** Their Splito account once linked (they accepted). Absent/null: a private "only for you" friend. */
  accountId?: string | null
}

/** How a member's balance stood when they left (F-613, F-615): nothing owed, settled, forgiven, or left open. */
export type MemberExit = 'none' | 'settled' | 'forgiven' | 'kept'

/** One place in a group. `role` absent on older groups: see `groupAdmins`. */
export interface GroupMemberEntry {
  personId: string
  joinedAt: number
  leftAt: number | null
  role?: 'admin' | 'member'
  /** Set when `leftAt` is: the choice made about the balance, kept in history. */
  exit?: MemberExit
}

/** What a group's deletion took with it, kept on its tombstone so the deleted group can say what comes back. */
export interface GroupRemoval {
  expenses: number
  repayments: number
  writeoffs: number
}

/**
 * Who can join a group (owner 196): 'link' anyone with the group link joins at once, 'approve' (the default) a link
 * opens a join request an admin answers, 'invite' there is no link and people join only when a member adds them and
 * they accept.
 */
export type JoinPolicy = 'link' | 'approve' | 'invite'
export const JOIN_POLICIES: readonly JoinPolicy[] = ['link', 'approve', 'invite']

/** A group's join rule; groups made before it existed read as 'approve' (read-time adapter, no schema change). */
export function joinPolicyOf(g: Pick<Group, 'joinPolicy'>): JoinPolicy {
  return g.joinPolicy ?? 'approve'
}

export interface Group {
  name: string
  kind: 'trip' | 'home' | 'couple' | 'other'
  currency: CurrencyCode
  members: GroupMemberEntry[]
  startDate: LocalDate | null
  endDate: LocalDate | null
  /** Where a trip is, plain text (owner 182). Absent on groups made before it: reads as null. Kept when the type changes away from Trip. */
  location?: string | null
  /** Legacy flag from before Active / Inactive (decision 89): it reads as inactive (`isGroupInactive`) and is cleared by "Make active". */
  archived: boolean
  /** Inactive (decision 89): takes no new expenses but can still settle. Absent: active. */
  inactive?: boolean
  /** "Who you settle with" rules. Absent: every member pair is allowed. */
  rules?: SettlementRules
  /** Who can join (owner 196). Absent: 'approve'. Only an admin changes it. */
  joinPolicy?: JoinPolicy
  /** The request (or link code) whose answer wrote this version: Activity tells the story with the request's own row, not as a group edit. */
  viaRequest?: string
  /** Set on the tombstone by "Delete group"; cleared by restore. */
  removed?: GroupRemoval
}

/** Whether a group is inactive: the new flag, or the old `archived` one (read-time adapter, no schema change). */
export function isGroupInactive(g: Pick<Group, 'archived' | 'inactive'>): boolean {
  return g.inactive === true || g.archived === true
}

/**
 * The members with every role filled in. Groups made before roles existed have none: their first member,
 * the creator, is the admin and the rest are members.
 */
export function normalizeRoles(members: Group['members']): Group['members'] {
  const hasRoles = members.some(m => m.role !== undefined)
  return members.map((m, i) => ({...m, role: m.role ?? (!hasRoles && i === 0 ? 'admin' : 'member')}))
}

/** The people who run a group right now: admins who have not left. */
export function groupAdmins(g: Pick<Group, 'members'>): string[] {
  return normalizeRoles(g.members)
    .filter(m => m.role === 'admin' && m.leftAt === null)
    .map(m => m.personId)
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

/** A payment recorded between two people. Splito records it; it never moves money. */
export interface Repayment {
  groupId: string | null
  currency: CurrencyCode
  from: string
  to: string
  amount: bigint
  date: LocalDate
  tz: string
  note: string
}

/** `id` makes a retried save idempotent: the same id never records a second payment. */
export type RepaymentInput = Repayment & {id?: string}

/**
 * A debt let go ("Call it even"): `from` owed `to`, and `to` forgave it. Same
 * shape as a payment, but its own entity type, so it is never shown or synced
 * as money that changed hands.
 */
export type WriteOff = Repayment

/** `id` makes a retried save idempotent, as for payments. */
export type WriteOffInput = WriteOff & {id?: string}

/** The money entity types: a deleted one stays in its list, struck through, forever (decision 103). */
export type MoneyType = 'expense' | 'repayment' | 'writeoff'

/**
 * The mark on a tombstone. `deletedWithGroup`: the group whose deletion took this record with it, so restoring
 * the group brings back exactly these (F-615). (Older builds also wrote `purgedAt`; it is ignored now.)
 */
export type Tombstone = {deletedWithGroup?: string}

/** What a tombstone sends to the server: the delete, and the mark that decides whether others may restore it. */
function tombstonePayload(data: unknown): Tombstone & {deleted: true} {
  const {deletedWithGroup} = (data ?? {}) as Tombstone
  return {deleted: true, ...(deletedWithGroup !== undefined && {deletedWithGroup})}
}

/**
 * Versioned write: entity, history row and outbox op, all inside the caller's
 * transaction. `opType: null` keeps the write on this device (no outbox op), for records no
 * server takes yet. `remote` applies a change that came from someone else (a pull,
 * or the demo directory): history, but no outbox op.
 * @internal shared by the mutation modules of this package.
 */
export async function write<T>(
  tx: Tx,
  ctx: MutationCtx,
  type: EntityType,
  id: string,
  data: T,
  deleted: boolean,
  opType: string | null,
  {remote = false}: {remote?: boolean} = {},
): Promise<Entity<T>> {
  const prev = await tx.get<T>(type, id)
  const at = ctx.now()
  const version = (prev?.version ?? 0) + 1
  // A local change waits for the server (`pending`, then `tx.enqueue` below). Only a real server
  // acknowledgement ever moves a row to `synced` (ARCHITECTURE 9.8): a change applied from someone else's
  // side (`remote`) has none yet, and a device-only write (`opType` null: feedback, device preferences) is
  // never queued, so both keep the row's state (`local` for a new row, `pending` if its own op is still queued).
  const sync = remote || opType === null
    ? ({syncStatus: prev?.syncStatus ?? 'local', serverVersion: prev?.serverVersion ?? null, syncedAt: prev?.syncedAt ?? null, syncError: prev?.syncError ?? null} as const)
    : ({syncStatus: 'pending', serverVersion: prev?.serverVersion ?? null, syncedAt: prev?.syncedAt ?? null, syncError: null} as const)
  const e: Entity<T> = {type, id, data, version, deleted, createdAt: prev?.createdAt ?? at, updatedAt: at, ...sync}
  await tx.put(e)
  await tx.appendHistory({entityType: type, entityId: id, version: e.version, data, deleted, at, actor: ctx.actor})
  // A deleted record's open disputes close as Gone in the same transaction (F-1210), whoever deleted it and from where;
  // so do those of a bill item an edit took out of the bill. Nothing is queued for a write that is not queued itself.
  if ((type === 'expense' || type === 'repayment' || type === 'writeoff') && (deleted || prev)) await closeDisputesGone(tx, ctx, type, id, deleted ? undefined : data, remote || opType === null)
  if (remote || opType === null) return e
  await tx.enqueue({
    opId: ctx.newId(),
    deviceId: ctx.deviceId,
    actor: ctx.actor,
    entityType: type,
    entityId: id,
    opType,
    baseVersion: prev?.version ?? 0,
    payload: deleted ? tombstonePayload(data) : data,
    schemaVersion: 1,
    deps: [],
    attempts: 0,
    nextAttemptAt: null,
    lastError: null,
  })
  return e
}

/**
 * Closes open disputes and holds as `gone`: all of a deleted record's (`live` undefined), or only the item disputes of an
 * expense whose item is no longer in its bill (`live` is the saved expense).
 */
async function closeDisputesGone(tx: Tx, ctx: MutationCtx, type: MoneyType, id: string, live: unknown, localOnly: boolean) {
  if (live !== undefined && type !== 'expense') return
  const open = await tx.page<Dispute>('dispute', {index: 'byTargetStatus', eq: [type, id, 'open'], limit: 100})
  const split = (live as Partial<Expense> | undefined)?.split
  const items = new Set(split?.mode === 'items' ? split.items.map(i => i.id) : [])
  for (const d of open.items) {
    if (live !== undefined && (d.data.itemId === null || items.has(d.data.itemId))) continue
    await write(tx, ctx, 'dispute', d.id, {...d.data, status: 'gone', resolvedBy: ctx.actor, resolution: '', resolvedAt: ctx.now()}, false, localOnly ? null : 'dispute.gone')
  }
}

/** @internal */
export function cleanName(name: string) {
  const n = name.trim()
  if (!n) throw new DomainError('INVALID_NAME')
  return n
}

/** A trip's place as saved (owner 182): trimmed, inner whitespace collapsed, null when empty. */
export function cleanLocation(location: string | null | undefined): string | null {
  return location?.replace(/\s+/g, ' ').trim() || null
}

/** A person's name as saved (owner 181): capitalised word by word, never empty. Group names and titles use `cleanName`. */
export function cleanPersonName(name: string) {
  return cleanName(capitalizeName(name))
}

/** A person (or friend request) row with its name capitalised, for display: old lower-case rows read right, a correct row comes back as is. */
export function displayPerson<E extends Entity<{name: string; contact?: Contact | null}>>(e: E): E {
  if (e.data.contact && e.data.name === formatContact(e.data.contact)) return e // the contact stood in for a name
  const name = capitalizeName(e.data.name)
  return name === e.data.name ? e : {...e, data: {...e.data, name}}
}

/** @internal */
export async function requireLive<T>(tx: Tx, type: EntityType, id: string, code = 'NOT_FOUND'): Promise<Entity<T>> {
  const e = await tx.get<T>(type, id)
  if (!e || e.deleted) throw new DomainError(code)
  return e
}

export async function ensureMe(store: Store, ctx: MutationCtx, name: string): Promise<Entity<Person>> {
  return store.transaction(async tx => (await tx.get<Person>('person', ctx.actor)) ?? write(tx, ctx, 'person', ctx.actor, {name: cleanPersonName(name), isMe: true}, false, 'person.create'))
}

// ponytail: shape check only (handle@psp); the payer's UPI app is the real validator.
const UPI_RE = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9.-]{1,64}$/

function cleanUpi(upiId: string | null | undefined): string | null {
  const v = (upiId ?? '').trim()
  if (!v) return null
  if (!UPI_RE.test(v)) throw new DomainError('INVALID_UPI')
  return v
}

/**
 * A private friend (F-601): only you see them, usable at once. With a
 * contact and no name, the contact is the name.
 */
export async function createPerson(
  store: Store,
  ctx: MutationCtx,
  input: {name: string; upiId?: string | null; contact?: Contact | null},
): Promise<Entity<Person>> {
  const contact = input.contact ?? null
  if (contact && !isContact(contact)) throw new DomainError('INVALID_CONTACT')
  // A contact used as the name (an email, a phone number) is not a name to capitalise.
  const name = capitalizeName(input.name) || (contact ? formatContact(contact) : '')
  const data: Person = {name: cleanName(name), isMe: false, upiId: cleanUpi(input.upiId), ...(contact ? {contact} : {})}
  return store.transaction(tx => write(tx, ctx, 'person', ctx.newId(), data, false, 'person.create'))
}

export async function updatePerson(store: Store, ctx: MutationCtx, id: string, input: {name: string; upiId?: string | null}): Promise<Entity<Person>> {
  const name = cleanPersonName(input.name)
  const upiId = cleanUpi(input.upiId)
  return store.transaction(async tx => {
    const p = await requireLive<Person>(tx, 'person', id)
    return write(tx, ctx, 'person', id, {...p.data, name, upiId}, false, 'person.update')
  })
}

export async function deletePerson(store: Store, ctx: MutationCtx, id: string): Promise<void> {
  // ponytail: reference check reads outside the write transaction (IndexedDB can't await other
  // reads mid-transaction). Fine for one local writer; the server re-checks once sync exists.
  if (await isPersonUsed(store, id)) throw new DomainError('PERSON_IN_USE')
  await store.transaction(async tx => {
    const p = await requireLive<Person>(tx, 'person', id)
    if (p.data.isMe) throw new DomainError('PERSON_IN_USE')
    await write(tx, ctx, 'person', id, p.data, true, 'person.delete')
  })
}

/** Brings a deleted friend back (the person stays in People, struck, until then). */
export async function restorePerson(store: Store, ctx: MutationCtx, id: string): Promise<void> {
  await store.transaction(async tx => {
    const p = await tx.get<Person>('person', id)
    if (!p?.deleted) throw new DomainError('NOT_FOUND')
    await write(tx, ctx, 'person', id, p.data, false, 'person.restore')
    await unhideItems(tx, ctx, [id])
  })
}

/**
 * Hides one deleted item from my own lists, or shows it again (decisions 104 to 106). Personal: only the account
 * preference `lists.hiddenItems` changes, never the item, so nobody else sees a thing. Only a deleted expense,
 * payment, write-off or friend can be hidden (a live one has no "Hide"); a group hides through `setGroupHidden`.
 */
export async function setItemHidden(store: Store, ctx: MutationCtx, type: MoneyType | 'person', id: string, hidden: boolean): Promise<void> {
  await store.transaction(async tx => {
    if (hidden && !(await tx.get(type, id))?.deleted) throw new DomainError('NOT_DELETED')
    await editIdsPref(tx, ctx, 'lists.hiddenItems', ids => (ids.includes(id) === hidden ? ids : hidden ? [...ids, id] : ids.filter(x => x !== id)))
  })
}

/** Whether any live expense, group or payment names the person: index reads, no scan. */
async function isPersonUsed(store: Store, id: string): Promise<boolean> {
  if ((await store.parties({index: 'byPersonDate', eq: [id], limit: 1})).items.length > 0) return true
  if ((await store.members({personId: id})).length > 0) return true
  for (const type of ['repayment', 'writeoff'] as const)
    for (const index of ['byFrom', 'byTo']) {
      let after: Key | null = null
      do {
        const page: Page<Entity> = await store.page(type, {index, eq: [id], after, limit: 20})
        if (page.items.some(r => !r.deleted)) return true
        after = page.next
      } while (after)
    }
  return false
}

/** Who a money record or a group names, as stored. */
function namedIn(type: MoneyType | 'group', data: unknown): string[] {
  const d = data as Partial<Expense & Repayment & Group> | null
  if (type === 'group') return (d?.members ?? []).map(m => m.personId)
  if (type === 'expense') return [...Object.keys(d?.payers ?? {}), ...Object.keys(d?.shares ?? {})]
  return [d?.from, d?.to].filter((p): p is string => typeof p === 'string')
}

/** The stored shape of a new group (name and place cleaned, active, the default rule): one builder for a group made here and one that arrives from a request. @internal */
export function buildGroup(input: Omit<Group, 'members' | 'archived' | 'joinPolicy'> & {joinPolicy?: JoinPolicy}, members: Group['members']): Group {
  return {...input, name: cleanName(input.name), location: cleanLocation(input.location), members, archived: false, joinPolicy: input.joinPolicy ?? 'approve'}
}

export async function createGroup(
  store: Store,
  ctx: MutationCtx,
  input: Omit<Group, 'members' | 'archived' | 'joinPolicy'> & {memberIds: string[]; joinPolicy?: JoinPolicy},
): Promise<Entity<Group>> {
  getCurrency(input.currency)
  if (input.startDate) parseLocalDate(input.startDate)
  if (input.endDate) parseLocalDate(input.endDate)
  if (input.startDate && input.endDate && input.endDate < input.startDate) throw new DomainError('INVALID_DATE')
  if (input.joinPolicy && !JOIN_POLICIES.includes(input.joinPolicy)) throw new DomainError('INVALID_POLICY')
  const ids = [...new Set([ctx.actor, ...input.memberIds])]
  return store.transaction(async tx => {
    // A Splito friend is asked, not added (owner 196); a private "only for you" friend joins at once.
    const direct: string[] = []
    const asked: Entity<Person>[] = []
    for (const pid of ids) {
      const p = await requireLive<Person>(tx, 'person', pid, 'UNKNOWN_PERSON')
      if (pid !== ctx.actor && p.data.accountId) asked.push(p)
      else direct.push(pid)
    }
    const joinedAt = ctx.now()
    const {memberIds: _m, ...rest} = input
    const members = direct.map(personId => ({personId, joinedAt, leftAt: null, role: personId === ctx.actor ? ('admin' as const) : ('member' as const)}))
    const groupId = ctx.newId()
    const group = await write(tx, ctx, 'group', groupId, buildGroup(rest, members), false, 'group.create')
    for (const p of asked) await inviteIn(tx, ctx, group, p)
    return group
  })
}

/**
 * Asks a Splito friend to join a group: an outgoing group request. A request still waiting is not repeated; one that
 * lapsed (30 days) does not block asking again. True when a request went out. @internal
 */
export async function inviteIn(tx: Tx, ctx: MutationCtx, group: Entity<Group>, person: Entity<Person>): Promise<boolean> {
  const pending = await tx.page<GroupRequest>('groupRequest', {index: 'byGroup', eq: [group.id, 'pending'], limit: 200})
  if (pending.items.some(r => !r.deleted && r.data.kind === 'invite' && r.data.direction === 'outgoing' && r.data.personId === person.id && requestState(r.data, ctx.now()) === 'pending')) return false
  const g = group.data
  const data: GroupRequest = {
    kind: 'invite',
    direction: 'outgoing',
    status: 'pending',
    groupId: group.id,
    groupName: g.name,
    groupKind: g.kind,
    groupCurrency: g.currency,
    groupJoinPolicy: joinPolicyOf(g),
    name: person.data.name,
    accountId: person.data.accountId ?? null,
    contact: person.data.contact ?? null,
    personId: person.id,
    sentAt: ctx.now(),
  }
  await write(tx, ctx, 'groupRequest', ctx.newId(), data, false, 'groupRequest.send')
  return true
}

/**
 * The members with `personIds` in from `joinedAt`: new people as members, a former member back (the old exit choice is
 * history now, and a returning admin comes back as a member). Roles are filled in first, so a group made before roles
 * keeps its creator as admin. @internal
 */
export function withMembers(members: Group['members'], personIds: Iterable<string>, joinedAt: number): Group['members'] {
  const out = [...normalizeRoles(members)]
  for (const personId of new Set(personIds)) {
    const i = out.findIndex(m => m.personId === personId)
    if (i === -1) out.push({personId, joinedAt, leftAt: null, role: 'member'})
    else if (out[i]!.leftAt !== null) {
      const {exit: _exit, ...rest} = out[i]!
      out[i] = {...rest, leftAt: null, role: 'member'}
    }
  }
  return out
}

/**
 * Applies a new join rule inside the caller's transaction (admins only). Invite only revokes every group link; the
 * other two keep them and set whether each join waits for approval, so a link always says what the group says.
 */
async function applyJoinPolicy(tx: Tx, ctx: MutationCtx, g: Entity<Group>, policy: JoinPolicy): Promise<Group> {
  if (!JOIN_POLICIES.includes(policy)) throw new DomainError('INVALID_POLICY')
  if (!groupAdmins(g.data).includes(ctx.actor)) throw new DomainError('NOT_ADMIN')
  const next: Group = {...g.data, joinPolicy: policy}
  let after: Key | null = null
  // ponytail: reads every invite link (a person has a handful); an indexed `byGroup` read if links ever number in the thousands.
  do {
    const page: Page<Entity<InviteLinkRow>> = await tx.page<InviteLinkRow>('inviteLink', {index: 'byUpdatedAt', after, limit: 100})
    for (const l of page.items) {
      if (l.deleted || l.data.kind !== 'group' || l.data.groupId !== g.id || l.data.revoked) continue
      const approveJoins = policy === 'approve'
      if (policy === 'invite') await write(tx, ctx, 'inviteLink', l.id, {...l.data, revoked: true}, false, 'inviteLink.revoke')
      else if (l.data.approveJoins !== approveJoins) await write(tx, ctx, 'inviteLink', l.id, {...l.data, approveJoins}, false, 'inviteLink.update')
    }
    after = page.next
  } while (after)
  return next
}

/** Changes who can join a group and nothing else (the Add members sheet's "Who can join"); admins only. */
export async function setJoinPolicy(store: Store, ctx: MutationCtx, groupId: string, policy: JoinPolicy): Promise<Entity<Group>> {
  return store.transaction(async tx => {
    const g = await requireLive<Group>(tx, 'group', groupId)
    if (joinPolicyOf(g.data) === policy) return g
    return write(tx, ctx, 'group', groupId, await applyJoinPolicy(tx, ctx, g, policy), false, 'group.joinPolicy')
  })
}

/** The fields of an invite link this module touches (the whole type lives in `friends`). */
type InviteLinkRow = {kind: 'friend' | 'group'; groupId: string | null; approveJoins: boolean; revoked: boolean}

/** Edits a group's name, type, currency, trip dates, place and who can join (`location` and `joinPolicy` left out: unchanged; changing the rule is admin-only); members, rules and history stay. */
export async function updateGroup(
  store: Store,
  ctx: MutationCtx,
  groupId: string,
  input: Pick<Group, 'name' | 'kind' | 'currency' | 'startDate' | 'endDate' | 'location' | 'joinPolicy'>,
): Promise<Entity<Group>> {
  const name = cleanName(input.name)
  getCurrency(input.currency)
  if (input.startDate) parseLocalDate(input.startDate)
  if (input.endDate) parseLocalDate(input.endDate)
  if (input.startDate && input.endDate && input.endDate < input.startDate) throw new DomainError('INVALID_DATE')
  return store.transaction(async tx => {
    const g = await requireLive<Group>(tx, 'group', groupId)
    const {kind, currency, startDate, endDate} = input
    const location = input.location === undefined ? (g.data.location ?? null) : cleanLocation(input.location)
    // Only a real change of the rule is admin-only and touches the links; saving the same rule is just an edit.
    const joinPolicy = input.joinPolicy ?? joinPolicyOf(g.data)
    const next = joinPolicy === joinPolicyOf(g.data) ? g.data : await applyJoinPolicy(tx, ctx, g, joinPolicy)
    return write(tx, ctx, 'group', groupId, {...next, name, kind, currency, startDate, endDate, location}, false, 'group.update')
  })
}

/** Validates a draft against domain rules and current people/group state; returns the stored shape. */
async function buildExpense(tx: Tx, d: ExpenseDraft): Promise<Expense> {
  cleanName(d.title)
  getCurrency(d.currency)
  parseLocalDate(d.date)
  const shares = computeShares(d.total, d.split)
  const bill = d.split.mode === 'items' ? d.split : undefined
  validateExpense({total: d.total, payers: d.payers, shares, charges: bill?.charges, roundOff: bill?.roundOff, currency: d.currency})
  const people = [...new Set([...Object.keys(d.payers), ...Object.keys(shares)])]
  for (const pid of people) await requireLive(tx, 'person', pid, 'UNKNOWN_PERSON')
  if (d.groupId) {
    const g = await requireLive<Group>(tx, 'group', d.groupId)
    // An inactive group takes no new, edited or moved-in expenses (decision 89); settling and payments are fine.
    if (isGroupInactive(g.data)) throw new DomainError('GROUP_INACTIVE')
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
    const stored = await requireLive<Expense>(tx, 'expense', id)
    // An expense in an inactive group cannot be edited or moved out: that changes the group's balances (decision 89).
    const from = stored.data.groupId ? (await tx.get<Group>('group', stored.data.groupId))?.data : undefined
    if (from && isGroupInactive(from)) throw new DomainError('GROUP_INACTIVE')
    return write(tx, ctx, 'expense', id, await buildExpense(tx, d), false, 'expense.update')
  })
}

export async function deleteExpense(store: Store, ctx: MutationCtx, id: string): Promise<void> {
  await softDelete(store, ctx, 'expense', id)
}

export async function restoreExpense(store: Store, ctx: MutationCtx, id: string): Promise<void> {
  await restore(store, ctx, 'expense', id)
}

/** Tombstones a live ledger entity: a new version, never a hard delete. */
async function softDelete(store: Store, ctx: MutationCtx, type: MoneyType, id: string) {
  await store.transaction(async tx => {
    const e = await requireLive(tx, type, id)
    await write(tx, ctx, type, id, e.data, true, `${type}.delete`)
  })
}

/**
 * A tombstone comes back only if everything it names is live, as when it was created (audit M4):
 * UNKNOWN_PERSON for a person who is gone, GROUP_DELETED for a deleted group (restore the group first).
 */
/** @internal shared with the group lifecycle. */
export async function requireRestorable(tx: Tx, type: MoneyType | 'group', data: unknown) {
  for (const pid of new Set(namedIn(type, data))) await requireLive(tx, 'person', pid, 'UNKNOWN_PERSON')
  const groupId = (data as {groupId?: string | null}).groupId
  if (groupId) await requireLive(tx, 'group', groupId, 'GROUP_DELETED')
}

/** Brings a tombstone back as a new version. */
async function restore(store: Store, ctx: MutationCtx, type: MoneyType, id: string) {
  await store.transaction(async tx => {
    const e = await tx.get<Tombstone>(type, id)
    if (!e?.deleted) throw new DomainError('NOT_FOUND')
    await requireRestorable(tx, type, e.data)
    // Restoring an expense into an inactive group is a new expense there (decision 89). Payments may come back.
    const groupId = (e.data as {groupId?: string | null}).groupId
    const into = type === 'expense' && groupId ? (await tx.get<Group>('group', groupId))?.data : undefined
    if (into && isGroupInactive(into)) throw new DomainError('GROUP_INACTIVE')
    const {deletedWithGroup: _g, ...data} = e.data
    await write(tx, ctx, type, id, data, false, `${type}.restore`)
    // Live again: a hide made while it was deleted no longer applies (it would leave a counted row out of the lists).
    await unhideItems(tx, ctx, [id])
  })
}

export async function createRepayment(store: Store, ctx: MutationCtx, input: RepaymentInput): Promise<Entity<Repayment>> {
  return (await createRepayments(store, ctx, [input]))[0]!
}

/**
 * Records several payments in one transaction: all or none. A friend's page
 * uses it to split one payment across the direct and group parts of a
 * balance (`splitPayment`). Each id is idempotent, as in `createRepayment`.
 */
export async function createRepayments(store: Store, ctx: MutationCtx, inputs: RepaymentInput[]): Promise<Entity<Repayment>[]> {
  return recordTransfers(store, ctx, 'repayment', inputs)
}

/**
 * Records write-offs ("Call it even") in one transaction: all or none, each
 * id idempotent. A friend's page writes one per balance part it clears
 * (`writeOffParts`), so each group's own balance moves too.
 */
export async function createWriteOffs(store: Store, ctx: MutationCtx, inputs: WriteOffInput[]): Promise<Entity<WriteOff>[]> {
  return recordTransfers(store, ctx, 'writeoff', inputs)
}

const isSameTransfer = (x: Repayment, y: Repayment) =>
  x.groupId === y.groupId && x.currency === y.currency && x.from === y.from && x.to === y.to && x.amount === y.amount && x.date === y.date && x.tz === y.tz && x.note === y.note

/** Payments and write-offs: validated alike, written as `<type>.create`. */
async function recordTransfers(store: Store, ctx: MutationCtx, type: 'repayment' | 'writeoff', inputs: RepaymentInput[]): Promise<Entity<Repayment>[]> {
  const parts = inputs.map(({id, ...rest}) => {
    getCurrency(rest.currency)
    parseLocalDate(rest.date)
    if (rest.amount <= 0n) throw new DomainError('INVALID_AMOUNT')
    assertInRange(rest.amount)
    if (rest.from === rest.to) throw new DomainError('SAME_PERSON')
    return {id: id ?? ctx.newId(), data: {...rest, note: rest.note.trim()} satisfies Repayment}
  })
  return store.transaction(async tx => {
    const written: Entity<Repayment>[] = []
    for (const {id, data} of parts) {
      const existing = await tx.get<Repayment>(type, id)
      if (existing) {
        // A retry returns what is stored. A tombstone or different data under the same id is not a retry (audit m11).
        if (existing.deleted || !isSameTransfer(existing.data, data)) throw new DomainError('IDEMPOTENCY_CONFLICT')
        written.push(existing)
        continue
      }
      for (const pid of [data.from, data.to]) await requireLive(tx, 'person', pid, 'UNKNOWN_PERSON')
      if (data.groupId) {
        // Former members can still settle (or forgive) what is owed from their time in the group.
        const g = await requireLive<Group>(tx, 'group', data.groupId)
        const members = new Set(g.data.members.map(m => m.personId))
        if (!members.has(data.from) || !members.has(data.to)) throw new DomainError('NOT_A_MEMBER')
      }
      written.push(await write(tx, ctx, type, id, data, false, `${type}.create`))
    }
    return written
  })
}

export async function deleteRepayment(store: Store, ctx: MutationCtx, id: string): Promise<void> {
  await softDelete(store, ctx, 'repayment', id)
}

export async function restoreRepayment(store: Store, ctx: MutationCtx, id: string): Promise<void> {
  await restore(store, ctx, 'repayment', id)
}

/** Undoes a write-off: the balance it cleared comes back. */
export async function deleteWriteOff(store: Store, ctx: MutationCtx, id: string): Promise<void> {
  await deleteWriteOffs(store, ctx, [id])
}

/**
 * Undoes several write-offs (one "Call it even" across parts) in one
 * transaction: all or none, so a failure never leaves a partial undo (audit m16).
 */
export async function deleteWriteOffs(store: Store, ctx: MutationCtx, ids: string[]): Promise<void> {
  await store.transaction(async tx => {
    for (const id of ids) {
      const e = await requireLive(tx, 'writeoff', id)
      await write(tx, ctx, 'writeoff', id, e.data, true, 'writeoff.delete')
    }
  })
}

export async function restoreWriteOff(store: Store, ctx: MutationCtx, id: string): Promise<void> {
  await restore(store, ctx, 'writeoff', id)
}

const EDGE_RULES: EdgeRule[] = ['allowed', 'preferred', 'excluded']

/** Replaces a group's "Who you settle with" rules. Every edge must join two different members. */
export async function updateGroupRules(store: Store, ctx: MutationCtx, groupId: string, rules: SettlementRules): Promise<Entity<Group>> {
  return store.transaction(async tx => {
    const g = await requireLive<Group>(tx, 'group', groupId)
    const members = new Set(g.data.members.map(m => m.personId))
    const valid =
      typeof rules.allowListOnly === 'boolean' &&
      Object.entries(rules.edges).every(([key, rule]) => {
        const [from, to, ...extra] = key.split('>')
        return extra.length === 0 && from !== to && members.has(from!) && members.has(to!) && EDGE_RULES.includes(rule)
      })
    if (!valid) throw new DomainError('INVALID_RULES')
    const clean: SettlementRules = {allowListOnly: rules.allowListOnly, edges: {...rules.edges}}
    return write(tx, ctx, 'group', groupId, {...g.data, rules: clean}, false, 'group.rules')
  })
}

/** What `addGroupMembers` did: who is in now, and whom a request went out to (those show as "Invited"). */
export interface AddedMembers {
  group: Entity<Group>
  added: string[]
  asked: string[]
}

/**
 * Adds people to a group from now on; earlier splits are untouched. A former member rejoins. A friend whose account is
 * linked is asked, not added (owner 196): they get a group request and show as "Invited" until they join. Anyone with
 * no account link (a private friend, or any friend before sync exists) joins at once.
 */
export async function addGroupMembers(store: Store, ctx: MutationCtx, groupId: string, personIds: string[]): Promise<AddedMembers> {
  return store.transaction(async tx => {
    const g = await requireLive<Group>(tx, 'group', groupId)
    const current = new Set(g.data.members.filter(m => m.leftAt === null).map(m => m.personId))
    const added: string[] = []
    const asked: string[] = []
    for (const personId of new Set(personIds)) {
      const p = await requireLive<Person>(tx, 'person', personId, 'UNKNOWN_PERSON')
      if (current.has(personId)) continue
      if (!p.data.accountId) added.push(personId)
      else if (await inviteIn(tx, ctx, g, p)) asked.push(personId)
    }
    // Nobody joined (only requests went out, or all were in already): the group itself did not change.
    if (added.length === 0) return {group: g, added, asked}
    const group = await write(tx, ctx, 'group', groupId, {...g.data, members: withMembers(g.data.members, added, ctx.now())}, false, 'group.members')
    return {group, added, asked}
  })
}
