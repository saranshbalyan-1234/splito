/**
 * A group's life cycle (F-604, F-615, F-613 part 1): archive and unarchive, leave or remove a member with a
 * choice about their balance, delete a whole group and bring it back. Each is one transaction (entity, history,
 * outbox): all of it or none. Nothing is hard-deleted; a deleted group and the records it took with it are
 * tombstones, marked `deletedWithGroup` so a restore brings back exactly those.
 */
import {
  type CurrencyCode,
  DomainError,
  type ExitChange,
  type ExitTransfer,
  type LocalDate,
  memberExitChanges,
  memberExitTransfers,
  NO_RULES,
  parseLocalDate,
  zeroFillNets,
} from '@splito/domain'

import {
  type BinType,
  createRepayments,
  createWriteOffs,
  type Group,
  type GroupMemberEntry,
  type GroupRemoval,
  groupAdmins,
  isGroupInactive,
  type MemberExit,
  normalizeRoles,
  type Purged,
  requireLive,
  requireRestorable,
  write,
} from './mutations'
import {getPref, setPref} from './preferences'
import {type Key} from './schema'
import {insideTransaction, type Page, type Store} from './store'
import {type Entity, type MutationCtx} from './types'

/* ------------------- active / inactive and show / hide (F-604) ---------------- */

async function setInactive(store: Store, ctx: MutationCtx, groupId: string, inactive: boolean): Promise<Entity<Group>> {
  return store.transaction(async tx => {
    const g = await requireLive<Group>(tx, 'group', groupId)
    // Already there: nothing to write, nothing to sync.
    if (isGroupInactive(g.data) === inactive) return g
    // `archived` follows `inactive`, so the byArchived index keeps meaning inactive and an old flag is cleared by Make active.
    return write(tx, ctx, 'group', groupId, {...g.data, inactive, archived: inactive}, false, inactive ? 'group.inactive' : 'group.active')
  })
}

/**
 * Makes a group inactive for every member: it takes no new, edited, moved-in or restored-in expenses
 * (`GROUP_INACTIVE`), but balances, settling, payments, write-offs and search all stay (decision 89).
 */
export const makeGroupInactive = (store: Store, ctx: MutationCtx, groupId: string) => setInactive(store, ctx, groupId, true)

/** Makes an inactive group active again. */
export const makeGroupActive = (store: Store, ctx: MutationCtx, groupId: string) => setInactive(store, ctx, groupId, false)

/**
 * Hides a group from my own lists, or shows it again (decision 89). Personal: it writes only the account
 * preference `groups.hidden`, never the group, so nobody else sees a change.
 */
export async function setGroupHidden(store: Store, ctx: MutationCtx, groupId: string, hidden: boolean): Promise<void> {
  const ids = await getPref(store, 'groups.hidden')
  if (ids.includes(groupId) === hidden) return
  await setPref(store, ctx, 'groups.hidden', hidden ? [...ids, groupId] : ids.filter(id => id !== groupId))
}

/* -------------------------- reading a group's records ------------------------ */

const RECORD_INDEX = {expense: 'byGroupDate', repayment: 'byGroup', writeoff: 'byGroup'} as const

/**
 * One group's records of the three money types, tombstones included, read by the group's own index in pages.
 * ponytail: the read runs before the write transaction (the store has no range read inside one); one local writer
 * makes that safe, and the server re-checks once sync exists.
 */
async function groupRecords(store: Store, groupId: string, keep: (e: Entity<Purged>) => boolean) {
  const out = {expense: [] as Entity<Purged>[], repayment: [] as Entity<Purged>[], writeoff: [] as Entity<Purged>[]}
  for (const type of ['expense', 'repayment', 'writeoff'] as const) {
    let after: Key | null = null
    do {
      const page: Page<Entity<Purged>> = await store.page<Purged>(type, {index: RECORD_INDEX[type], eq: [groupId], after, limit: 200})
      out[type].push(...page.items.filter(keep))
      after = page.next
    } while (after)
  }
  return out
}

/** How many live expenses, payments and write-offs a group holds: what deleting it takes with it. */
export async function groupContents(store: Store, groupId: string): Promise<GroupRemoval> {
  const r = await groupRecords(store, groupId, e => !e.deleted)
  return {expenses: r.expense.length, repayments: r.repayment.length, writeoffs: r.writeoff.length}
}

/* ------------------------ leave and remove (F-615, F-613) -------------------- */

/** What happens to a member's balance as they go: pay it off, let it go, or stay on as an inactive member with it open. */
export type ExitChoice = 'settle' | 'forgive' | 'keep'

/** The group's balances per currency with every member listed (zero when none), from the stored sums. */
async function groupNets(store: Store, g: Entity<Group>) {
  const nets: Record<CurrencyCode, Record<string, bigint>> = {}
  for (const b of await store.balances({groupId: g.id})) (nets[b.currency] ??= {})[b.personId] = b.amount
  return zeroFillNets(nets, g.data.members.map(m => m.personId))
}

export interface ExitPreview {
  /** The member's balance per currency (> 0: owed); empty when settled up. */
  owed: Record<CurrencyCode, bigint>
  /** The payments (or write-offs) that clear it. */
  transfers: ExitTransfer[]
  /** Every member whose balance moves if those are recorded, before and after. */
  changes: ExitChange[]
}

/** What settling or forgiving a member's balance would do, for the sheet to show before anything is written. */
export async function previewMemberExit(store: Store, groupId: string, personId: string): Promise<ExitPreview> {
  const g = await store.get<Group>('group', groupId)
  if (!g || g.deleted) throw new DomainError('NOT_FOUND')
  const nets = await groupNets(store, g)
  const transfers = memberExitTransfers(nets, personId, g.data.rules ?? NO_RULES)
  const owed = Object.fromEntries(Object.entries(nets).flatMap(([c, net]) => ((net[personId] ?? 0n) === 0n ? [] : [[c, net[personId]!]])))
  return {owed, transfers, changes: memberExitChanges(nets, transfers)}
}

export interface MemberExitInput {
  groupId: string
  /** Who goes. Leaving yourself is `leaveGroup`, which fills in the actor. */
  personId: string
  /** Used only when they have a balance; `keep` leaves it open and names the member inactive. */
  choice: ExitChoice
  /** Required when this member is the last admin and others remain: who takes over. */
  handAdminTo?: string
  /** The day and zone the settling payments or write-offs are dated. */
  date: LocalDate
  tz: string
}

/**
 * Takes a member out of a group going forward (their `leftAt`); earlier splits and the history stay. With a
 * balance, `settle` records the payments that clear it and `forgive` records write-offs ("Call it even"),
 * both in the same transaction as the exit, so it happens whole or not at all; `keep` leaves the balance open
 * with the member inactive. The choice is recorded on the member (`exit`) and shows in history and Activity.
 * The last admin cannot go until admin is handed on (LAST_ADMIN).
 */
export async function removeGroupMember(store: Store, ctx: MutationCtx, input: MemberExitInput): Promise<Entity<Group>> {
  const {groupId, personId, choice, handAdminTo} = input
  parseLocalDate(input.date)
  const preview = await previewMemberExit(store, groupId, personId)
  const hasBalance = Object.keys(preview.owed).length > 0
  return store.transaction(async tx => {
    const g = await requireLive<Group>(tx, 'group', groupId)
    // Anyone may leave; only an admin may remove somebody else (decision 90 / 26.12).
    if (personId !== ctx.actor && !groupAdmins(g.data).includes(ctx.actor)) throw new DomainError('NOT_ADMIN')
    const members = normalizeRoles(g.data.members)
    const leaver = members.find(m => m.personId === personId)
    if (!leaver || leaver.leftAt !== null) throw new DomainError('NOT_A_MEMBER')
    const admins = groupAdmins(g.data)
    const needsHandOver = admins.includes(personId) && !admins.some(p => p !== personId)
    if (needsHandOver && !members.some(m => m.personId === handAdminTo && m.leftAt === null && m.personId !== personId)) throw new DomainError('LAST_ADMIN')

    const exit: MemberExit = !hasBalance ? 'none' : choice === 'settle' ? 'settled' : choice === 'forgive' ? 'forgiven' : 'kept'
    if (exit === 'settled' || exit === 'forgiven') {
      const records = preview.transfers.map(t => ({groupId, currency: t.currency, from: t.from, to: t.to, amount: t.amount, date: input.date, tz: input.tz, note: ''}))
      const inner = insideTransaction(store, tx)
      await (exit === 'settled' ? createRepayments(inner, ctx, records) : createWriteOffs(inner, ctx, records))
    }
    const left = ctx.now()
    const next: GroupMemberEntry[] = members.map(m =>
      m.personId === personId ? {...m, leftAt: left, role: 'member', exit} : needsHandOver && m.personId === handAdminTo ? {...m, role: 'admin'} : m,
    )
    return write(tx, ctx, 'group', groupId, {...g.data, members: next}, false, 'group.leave')
  })
}

/** Leaves a group as the local user. */
export const leaveGroup = (store: Store, ctx: MutationCtx, input: Omit<MemberExitInput, 'personId'>) => removeGroupMember(store, ctx, {...input, personId: ctx.actor})

/* ------------------------------ delete group (F-615) ------------------------- */

/** The records a group's deletion took, with the group's own mark; their type names the store. */
const MONEY: BinType[] = ['expense', 'repayment', 'writeoff']

/**
 * Deletes a group and every live expense, payment and write-off in it, in one transaction. Each record is
 * tombstoned with `deletedWithGroup`, so restoring the group brings back exactly those (records deleted earlier
 * stay in Recently deleted on their own), and the group's tombstone says how many went. Returns what went.
 */
export async function deleteGroup(store: Store, ctx: MutationCtx, groupId: string): Promise<GroupRemoval> {
  const records = await groupRecords(store, groupId, e => !e.deleted)
  return store.transaction(async tx => {
    const g = await requireLive<Group>(tx, 'group', groupId)
    // Only an admin deletes the group; any member may leave, hide it or make it inactive.
    if (!groupAdmins(g.data).includes(ctx.actor)) throw new DomainError('NOT_ADMIN')
    const removed: GroupRemoval = {expenses: 0, repayments: 0, writeoffs: 0}
    for (const type of MONEY) {
      for (const { id } of records[type]) {
        const e = await tx.get<Purged>(type, id)
        if (!e || e.deleted) continue
        await write(tx, ctx, type, id, {...e.data, deletedWithGroup: groupId}, true, `${type}.delete`)
        removed[type === 'expense' ? 'expenses' : type === 'repayment' ? 'repayments' : 'writeoffs']++
      }
    }
    await write(tx, ctx, 'group', groupId, {...g.data, removed}, true, 'group.delete')
    return removed
  })
}

/** A group's tombstone that can still be brought back or deleted forever (not purged). */
async function deletedGroup(store: Store, groupId: string) {
  const g = await store.get<Group & Purged>('group', groupId)
  if (!g?.deleted || g.data.purgedAt !== undefined) throw new DomainError('NOT_FOUND')
  return g
}

/**
 * Brings a deleted group back with exactly the records its deletion took, as new versions (history kept). Refuses
 * (UNKNOWN_PERSON) when a member or a person on one of those records has since been removed for good.
 */
export async function restoreGroup(store: Store, ctx: MutationCtx, groupId: string): Promise<void> {
  const deleted = await deletedGroup(store, groupId)
  const kids = await groupRecords(store, groupId, e => e.deleted && e.data.deletedWithGroup === groupId && e.data.purgedAt === undefined)
  await store.transaction(async tx => {
    const g = (await tx.get<Group & Purged>('group', groupId))!
    if (g.version !== deleted.version) throw new DomainError('NOT_FOUND')
    await requireRestorable(tx, 'group', g.data)
    // Past its own end date it has left Recently deleted (decision 102).
    if (g.data.purgeAfter !== undefined && g.data.purgeAfter <= ctx.now()) throw new DomainError('NOT_FOUND')
    const {removed: _removed, purgeAfter: _purge, ...data} = g.data
    await write(tx, ctx, 'group', groupId, data, false, 'group.restore')
    for (const type of MONEY) {
      for (const { id } of kids[type]) {
        const e = (await tx.get<Purged>(type, id))!
        await requireRestorable(tx, type, e.data)
        const {deletedWithGroup: _g, purgeAfter: _p, ...rest} = e.data
        await write(tx, ctx, type, id, rest, false, `${type}.restore`)
      }
    }
  })
}

/** "Delete forever" for a deleted group: it and its records leave Recently deleted for good; history stays. */
export async function purgeDeletedGroup(store: Store, ctx: MutationCtx, groupId: string): Promise<void> {
  await deletedGroup(store, groupId)
  const kids = await groupRecords(store, groupId, e => e.deleted && e.data.deletedWithGroup === groupId && e.data.purgedAt === undefined)
  await store.transaction(async tx => {
    const at = ctx.now()
    for (const type of MONEY) for (const { id } of kids[type]) {
      const e = (await tx.get<Purged>(type, id))!
      await write(tx, ctx, type, id, {...e.data, purgedAt: at}, true, `${type}.purge`)
    }
    const g = (await tx.get<Group & Purged>('group', groupId))!
    await write(tx, ctx, 'group', groupId, {...g.data, purgedAt: at}, true, 'group.purge')
  })
}
