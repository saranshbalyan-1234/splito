import {type Contact, type CurrencyCode, DomainError} from '@splito/domain'

import {type Account, linkPerson, outgoingRequests, requirePending} from './friends'
import {buildGroup, type Group, groupAdmins, type JoinPolicy, joinPolicyOf, requireLive, withMembers, write, type Person} from './mutations'
import {type Asked, pendingIn, requestState} from './requests'
import {type Store, type Tx} from './store'
import {type Entity, type MutationCtx} from './types'

/*
 * Group requests (F-269, ARCHITECTURE 26.18, owner 196). Nobody is added to a group, and nobody joins one that wants
 * approval, without a yes from the other side. One entity covers four cases, built on the friend-request patterns
 * (same statuses, 30-day lifetime, `pendingIn`, `requirePending`, `linkPerson`):
 *   invite / incoming   "Riya added you to Goa trip" (Join / Decline)
 *   invite / outgoing   "You added Sam to Goa trip" (waiting: the group shows Sam as "Invited"; Cancel)
 *   join   / incoming   "Sam opened Goa trip's link" (an admin: Approve / Decline)
 *   join   / outgoing   "You asked to join Goa trip" (waiting for an admin; Cancel)
 * Someone with a pending request is NOT a member (a request is its own record, never a member), so no expense, split
 * or picker can use them by construction. The server (F-2105) delivers the other side; until then, only the demo does.
 */

export interface GroupRequest extends Asked {
  kind: 'invite' | 'join'
  groupId: string
  /** A snapshot, so a request for a group this device does not hold yet still reads and can create it on Join. */
  groupName: string
  groupKind: Group['kind']
  groupCurrency: CurrencyCode
  /** The group's join rule when the request was made (absent: 'approve'); a group created here from the request keeps it. */
  groupJoinPolicy?: JoinPolicy
  /** The other side: who added me, the person I added, who asked to join; '' on my own join request. */
  name: string
  accountId: string | null
  contact: Contact | null
  /** Outgoing invite: the person I added. Incoming join: the person created on approval. Else null. */
  personId: string | null
}

/** Group requests waiting for my answer (Join / Approve), newest first. */
export const incomingGroupRequests = pendingIn('incoming')
/** Group requests I sent that are still waiting, newest first. */
export const outgoingGroupRequests = outgoingRequests

/** The people a group has asked to join and who have not answered: shown as "Invited", never selectable. */
export function invitedPeople(requests: Entity<GroupRequest>[], groupId: string, now: number): Entity<GroupRequest>[] {
  return outgoingRequests(requests, now).filter(r => r.data.groupId === groupId && r.data.kind === 'invite')
}

/** Join requests waiting in groups I run: what the admins approve. */
export function joinRequestsForAdmin(requests: Entity<GroupRequest>[], groups: Entity<Group>[], me: string, now: number): Entity<GroupRequest>[] {
  const mine = new Set(groups.filter(g => !g.deleted && groupAdmins(g.data).includes(me)).map(g => g.id))
  return incomingGroupRequests(requests, now).filter(r => r.data.kind === 'join' && mine.has(r.data.groupId))
}

/** What opening a group link does under the group's rule: join at once, send a join request, or nothing (invite only). */
export function linkOutcome(g: Pick<Group, 'joinPolicy'>): 'join' | 'request' | 'none' {
  const p = joinPolicyOf(g)
  return p === 'link' ? 'join' : p === 'approve' ? 'request' : 'none'
}

type GroupSnapshot = {groupId: string; groupName: string; groupKind: Group['kind']; groupCurrency: CurrencyCode; groupJoinPolicy?: JoinPolicy}

const blank = (g: GroupSnapshot, now: number): Omit<GroupRequest, 'kind' | 'direction' | 'status'> => ({
  ...g,
  name: '',
  accountId: null,
  contact: null,
  personId: null,
  sentAt: now,
})

/** Someone added me to a group (from a pull, or the demo). `ctx.actor` is their account. */
export async function receiveGroupInvite(store: Store, ctx: MutationCtx, input: GroupSnapshot & {id: string; inviter: Account}): Promise<Entity<GroupRequest>> {
  const {id, inviter, ...snapshot} = input
  const data: GroupRequest = {...blank(snapshot, ctx.now()), kind: 'invite', direction: 'incoming', status: 'pending', name: inviter.name, accountId: inviter.accountId, contact: inviter.contact}
  return store.transaction(tx => write(tx, ctx, 'groupRequest', id, data, false, 'groupRequest.receive', {remote: true}))
}

/** Someone opened the link of a group I run and it needs my approval (from a pull, or the demo). */
export async function receiveJoinRequest(store: Store, ctx: MutationCtx, input: {id: string; groupId: string; joiner: Account}): Promise<Entity<GroupRequest>> {
  return store.transaction(async tx => {
    const g = await requireLive<Group>(tx, 'group', input.groupId)
    const data: GroupRequest = {
      ...blank({groupId: g.id, groupName: g.data.name, groupKind: g.data.kind, groupCurrency: g.data.currency}, ctx.now()),
      kind: 'join',
      direction: 'incoming',
      status: 'pending',
      name: input.joiner.name,
      accountId: input.joiner.accountId,
      contact: input.joiner.contact,
    }
    return write(tx, ctx, 'groupRequest', input.id, data, false, 'groupRequest.receive', {remote: true})
  })
}

/**
 * I opened a group's link and it needs approval: a join request that waits for an admin. `admin` is who answers it
 * (the link's owner, when the directory says); a request that lapsed does not block asking again.
 */
export async function requestToJoin(store: Store, ctx: MutationCtx, input: GroupSnapshot & {admin?: Account}): Promise<Entity<GroupRequest>> {
  const {admin, ...snapshot} = input
  const data: GroupRequest = {
    ...blank(snapshot, ctx.now()),
    kind: 'join',
    direction: 'outgoing',
    status: 'pending',
    name: admin?.name ?? '',
    accountId: admin?.accountId ?? null,
    contact: admin?.contact ?? null,
  }
  return store.transaction(async tx => {
    const waiting = await tx.page<GroupRequest>('groupRequest', {index: 'byGroup', eq: [input.groupId, 'pending'], limit: 200})
    if (waiting.items.some(r => !r.deleted && r.data.kind === 'join' && r.data.direction === 'outgoing' && requestState(r.data, ctx.now()) === 'pending')) throw new DomainError('ALREADY_REQUESTED')
    return write(tx, ctx, 'groupRequest', ctx.newId(), data, false, 'groupRequest.send')
  })
}

/**
 * Puts me in a group, creating it here when this device does not hold it yet (until the backend, the group arrives
 * only as the snapshot a request carries: its name, type, currency and rule, plus whoever brought me in). A group I
 * deleted is not brought back by a request. The write is `remote`: the server owns membership, and what this device
 * sends is the request's own answer (or the link code), never a second op for the group. `via` marks the version so
 * Activity tells it with the request's row, not as "created" or "edited".
 */
async function enter(tx: Tx, ctx: MutationCtx, me: string, snapshot: GroupSnapshot, other: Entity<Person> | null, via: string): Promise<Entity<Group>> {
  const existing = await tx.get<Group>('group', snapshot.groupId)
  if (existing?.deleted) throw new DomainError('GROUP_DELETED')
  if (existing) return write(tx, ctx, 'group', existing.id, {...existing.data, members: withMembers(existing.data.members, [me], ctx.now()), viaRequest: via}, false, 'group.join', {remote: true})
  const joinedAt = ctx.now()
  const members = [
    ...(other ? [{personId: other.id, joinedAt, leftAt: null, role: 'admin' as const}] : []),
    {personId: me, joinedAt, leftAt: null, role: other ? ('member' as const) : ('admin' as const)},
  ]
  const data = {
    ...buildGroup({name: snapshot.groupName, kind: snapshot.groupKind, currency: snapshot.groupCurrency, startDate: null, endDate: null, joinPolicy: snapshot.groupJoinPolicy}, members),
    viaRequest: via,
  }
  return write(tx, ctx, 'group', snapshot.groupId, data, false, 'group.join', {remote: true})
}

/** "Riya added you to Goa trip" and I tap Join: I become a member (consent given). */
export async function joinGroup(store: Store, ctx: MutationCtx, id: string): Promise<{group: Entity<Group>; request: Entity<GroupRequest>}> {
  const people = await store.getAll<Person>('person')
  return store.transaction(async tx => {
    const r = await requirePending<GroupRequest>(tx, id, 'incoming', 'groupRequest')
    if (r.data.kind !== 'invite') throw new DomainError('NOT_AN_INVITE')
    const inviter = await linkPerson(tx, ctx, people, {accountId: r.data.accountId!, name: r.data.name, contact: r.data.contact}, false)
    const group = await enter(tx, ctx, ctx.actor, r.data, inviter, id)
    const request = await write(tx, ctx, 'groupRequest', id, {...r.data, status: 'accepted' as const, personId: inviter.id}, false, 'groupRequest.accept')
    return {group, request}
  })
}

/** Opening a group's link under "Anyone with the link": in at once, no request. */
export async function joinGroupViaLink(store: Store, ctx: MutationCtx, input: GroupSnapshot & {inviter: Account; code: string}): Promise<Entity<Group>> {
  const people = await store.getAll<Person>('person')
  return store.transaction(async tx => {
    const inviter = await linkPerson(tx, ctx, people, input.inviter, false)
    const group = await enter(tx, ctx, ctx.actor, input, inviter, input.code)
    // The group row arrives from the server; what I send is joining it by this link (using a link is consent).
    await tx.enqueue({
      opId: ctx.newId(),
      deviceId: ctx.deviceId,
      actor: ctx.actor,
      entityType: 'group',
      entityId: group.id,
      opType: 'group.join',
      baseVersion: group.version,
      payload: {code: input.code},
      schemaVersion: 1,
      deps: [],
      attempts: 0,
      nextAttemptAt: null,
      lastError: null,
    })
    return group
  })
}

/** An admin approves a join request: the joiner becomes a member (their opening the link was their consent). */
export async function approveJoinRequest(store: Store, ctx: MutationCtx, id: string): Promise<{group: Entity<Group>; request: Entity<GroupRequest>}> {
  const people = await store.getAll<Person>('person')
  return store.transaction(async tx => {
    const r = await requirePending<GroupRequest>(tx, id, 'incoming', 'groupRequest')
    if (r.data.kind !== 'join') throw new DomainError('NOT_A_JOIN')
    const g = await requireLive<Group>(tx, 'group', r.data.groupId)
    if (!groupAdmins(g.data).includes(ctx.actor)) throw new DomainError('NOT_ADMIN')
    const person = await linkPerson(tx, ctx, people, {accountId: r.data.accountId!, name: r.data.name, contact: r.data.contact}, false)
    const group = await write(tx, ctx, 'group', g.id, {...g.data, members: withMembers(g.data.members, [person.id], ctx.now()), viaRequest: id}, false, 'group.members')
    const request = await write(tx, ctx, 'groupRequest', id, {...r.data, status: 'accepted' as const, personId: person.id}, false, 'groupRequest.approve')
    return {group, request}
  })
}

/** Decline a request that came to me (a Join or an Approve): silent to the sender, like a declined friend request. */
export async function declineGroupRequest(store: Store, ctx: MutationCtx, id: string): Promise<Entity<GroupRequest>> {
  return store.transaction(async tx => {
    const r = await requirePending<GroupRequest>(tx, id, 'incoming', 'groupRequest')
    if (r.data.kind === 'join') {
      const g = await requireLive<Group>(tx, 'group', r.data.groupId)
      if (!groupAdmins(g.data).includes(ctx.actor)) throw new DomainError('NOT_ADMIN')
    }
    return write(tx, ctx, 'groupRequest', id, {...r.data, status: 'declined'}, false, 'groupRequest.decline')
  })
}

/** Take back a request I sent (an invite to a friend, or my own join request). */
export async function cancelGroupRequest(store: Store, ctx: MutationCtx, id: string): Promise<Entity<GroupRequest>> {
  return store.transaction(async tx => {
    const r = await requirePending<GroupRequest>(tx, id, 'outgoing', 'groupRequest')
    return write(tx, ctx, 'groupRequest', id, {...r.data, status: 'cancelled'}, false, 'groupRequest.cancel')
  })
}

/**
 * They said yes to a request I sent (from a pull, or the demo): an invited friend becomes a member; for my own join
 * request the group appears here with me in it as a member and the approver (`account`, else the admin the request
 * named) as its admin. `ctx.actor` is their account, `me` mine.
 */
export async function applyGroupRequestAccepted(store: Store, ctx: MutationCtx, id: string, me: string, account?: Account): Promise<Entity<GroupRequest>> {
  const people = await store.getAll<Person>('person')
  return store.transaction(async tx => {
    const r = await requirePending<GroupRequest>(tx, id, 'outgoing', 'groupRequest')
    if (r.data.kind === 'invite') {
      const g = await requireLive<Group>(tx, 'group', r.data.groupId)
      await write(tx, ctx, 'group', g.id, {...g.data, members: withMembers(g.data.members, [r.data.personId!], ctx.now()), viaRequest: id}, false, 'group.members', {remote: true})
    } else {
      const approver = account ?? (r.data.accountId ? {accountId: r.data.accountId, name: r.data.name, contact: r.data.contact} : null)
      const admin = approver ? await linkPerson(tx, ctx, people, approver, true) : null
      await enter(tx, ctx, me, r.data, admin, id)
    }
    return write(tx, ctx, 'groupRequest', id, {...r.data, status: 'accepted'}, false, 'groupRequest.accepted', {remote: true})
  })
}
