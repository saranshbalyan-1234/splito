import {type Contact, contactKey, DomainError, isContact} from '@splito/domain'

import {cleanName, type Person, requireLive, write} from './mutations'
import type {Store, Tx} from './store'
import type {Entity, MutationCtx} from './types'

/*
 * Friends by consent (ARCHITECTURE 26.18). Nobody becomes your friend until
 * they accept: an outgoing request is its own record, never a Person, so no
 * picker or mutation can use them while it waits. Accepting (either side, or
 * through an invite link) links or creates a Person with their account id.
 * Private "only for you" friends (F-601) are ordinary Persons without one.
 */

/** Unanswered requests lapse after 30 days; declining is silent, so the sender sees this too. */
export const REQUEST_LIFETIME_MS = 30 * 86_400_000

export type RequestStatus = 'pending' | 'accepted' | 'declined' | 'cancelled'
/** What the directory said when an outgoing request was made. */
export type RequestReach = 'on-splito' | 'invited' | 'unchecked'

export interface FriendRequest {
  direction: 'outgoing' | 'incoming'
  /** Outgoing: the name you gave (or ''); incoming: theirs. */
  name: string
  contact: Contact | null
  status: RequestStatus
  /** Outgoing only; null on incoming requests. */
  reach: RequestReach | null
  /** Their account, once known (incoming: always). */
  accountId: string | null
  /** The friend this became, once accepted. */
  personId: string | null
  /** The personal invite link sent along, for people not on Splito. */
  inviteCode: string | null
  /** Epoch ms of the last send (a resend restarts the 30 days). */
  sentAt: number
}

export type RequestState = RequestStatus | 'expired'

/** Derived, never stored: a pending request past its 30 days reads as expired. */
export function requestState(r: FriendRequest, now: number): RequestState {
  return r.status === 'pending' && now > r.sentAt + REQUEST_LIFETIME_MS ? 'expired' : r.status
}

const pendingIn = (direction: FriendRequest['direction']) => (rs: Entity<FriendRequest>[], now: number) =>
  rs.filter(r => !r.deleted && r.data.direction === direction && requestState(r.data, now) === 'pending').sort((x, y) => y.data.sentAt - x.data.sentAt)

/** People > "Invites sent": your requests still waiting, newest first. */
export const outgoingRequests = pendingIn('outgoing')
/** People > "Requests" and Activity: requests waiting for your answer, newest first. */
export const incomingRequests = pendingIn('incoming')

/**
 * What expense and group pickers offer: every friend (private or linked) is
 * selectable; people whose request is still pending are shown apart, greyed.
 */
export function selectablePeople(people: Entity<Person>[], requests: Entity<FriendRequest>[], now: number) {
  return {
    selectable: people.filter(p => !p.deleted && !p.data.isMe),
    pending: outgoingRequests(requests, now),
  }
}

function checkContact(contact: Contact) {
  if (!isContact(contact)) throw new DomainError('INVALID_CONTACT')
  return contact
}

async function requirePending(tx: Tx, id: string, direction: FriendRequest['direction']) {
  const r = await requireLive<FriendRequest>(tx, 'friendRequest', id)
  if (r.data.direction !== direction) throw new DomainError(direction === 'incoming' ? 'NOT_INCOMING' : 'NOT_OUTGOING')
  if (r.data.status !== 'pending') throw new DomainError('NOT_PENDING')
  return r
}

/**
 * Asks someone to be your friend. `reach` records what the directory said;
 * 'unchecked' (offline) waits in the outbox and the server decides.
 */
export async function sendFriendRequest(
  store: Store,
  ctx: MutationCtx,
  input: {contact: Contact; name: string; reach: RequestReach; inviteCode?: string | null},
): Promise<Entity<FriendRequest>> {
  const contact = checkContact(input.contact)
  const key = contactKey(contact)
  // ponytail: duplicate checks read outside the transaction (IndexedDB can't await other reads mid-transaction); the server re-checks.
  const people = await store.getAll<Person>('person')
  if (people.some(p => !p.deleted && p.data.accountId && p.data.contact && contactKey(p.data.contact) === key)) throw new DomainError('ALREADY_FRIENDS')
  const requests = await store.getAll<FriendRequest>('friendRequest')
  if (outgoingRequests(requests, ctx.now()).some(r => r.data.contact && contactKey(r.data.contact) === key)) throw new DomainError('ALREADY_REQUESTED')
  const data: FriendRequest = {
    direction: 'outgoing',
    name: input.name.trim(),
    contact,
    status: 'pending',
    reach: input.reach,
    accountId: null,
    personId: null,
    inviteCode: input.inviteCode ?? null,
    sentAt: ctx.now(),
  }
  return store.transaction(tx => write(tx, ctx, 'friendRequest', ctx.newId(), data, false, 'friendRequest.send'))
}

/** Sends a pending request again; its 30 days start over. */
export async function resendFriendRequest(store: Store, ctx: MutationCtx, id: string): Promise<Entity<FriendRequest>> {
  return store.transaction(async tx => {
    const r = await requirePending(tx, id, 'outgoing')
    return write(tx, ctx, 'friendRequest', id, {...r.data, sentAt: ctx.now()}, false, 'friendRequest.resend')
  })
}

export async function cancelFriendRequest(store: Store, ctx: MutationCtx, id: string): Promise<Entity<FriendRequest>> {
  return store.transaction(async tx => {
    const r = await requirePending(tx, id, 'outgoing')
    return write(tx, ctx, 'friendRequest', id, {...r.data, status: 'cancelled'}, false, 'friendRequest.cancel')
  })
}

/**
 * Someone asked to be your friend (from a pull, or the demo directory).
 * `ctx.actor` is their account, so Activity shows it as from them.
 */
export async function receiveFriendRequest(
  store: Store,
  ctx: MutationCtx,
  input: {id: string; accountId: string; name: string; contact: Contact | null},
): Promise<Entity<FriendRequest>> {
  const data: FriendRequest = {
    direction: 'incoming',
    name: cleanName(input.name),
    contact: input.contact,
    status: 'pending',
    reach: null,
    accountId: input.accountId,
    personId: null,
    inviteCode: null,
    sentAt: ctx.now(),
  }
  return store.transaction(tx => write(tx, ctx, 'friendRequest', input.id, data, false, 'friendRequest.receive', {remote: true}))
}

type Account = {accountId: string; name: string; contact: Contact | null}

/**
 * The friend for an account: the one already linked to it, else a private
 * friend with the same contact (linked now: F-616, history kept), else new.
 * `people` is read before the transaction (see sendFriendRequest).
 */
async function linkPerson(tx: Tx, ctx: MutationCtx, people: Entity<Person>[], account: Account, remote: boolean): Promise<Entity<Person>> {
  const live = people.filter(p => !p.deleted && !p.data.isMe)
  const linked = live.find(p => p.data.accountId === account.accountId)
  if (linked) return linked
  const key = account.contact ? contactKey(account.contact) : null
  const priv = key ? live.find(p => !p.data.accountId && p.data.contact && contactKey(p.data.contact) === key) : undefined
  if (priv) {
    const current = await requireLive<Person>(tx, 'person', priv.id)
    return write(tx, ctx, 'person', priv.id, {...current.data, accountId: account.accountId}, false, 'person.link', {remote})
  }
  const data: Person = {name: cleanName(account.name), isMe: false, accountId: account.accountId, contact: account.contact}
  return write(tx, ctx, 'person', ctx.newId(), data, false, 'person.create', {remote})
}

/** You accept an incoming request: they become a full friend on both sides. */
export async function acceptFriendRequest(store: Store, ctx: MutationCtx, id: string) {
  const people = await store.getAll<Person>('person')
  return store.transaction(async tx => {
    const r = await requirePending(tx, id, 'incoming')
    const person = await linkPerson(tx, ctx, people, {accountId: r.data.accountId!, name: r.data.name, contact: r.data.contact}, false)
    const request = await write(tx, ctx, 'friendRequest', id, {...r.data, status: 'accepted', personId: person.id}, false, 'friendRequest.accept')
    return {person, request}
  })
}

/** Silent to the sender: their side stays pending until it expires. */
export async function declineFriendRequest(store: Store, ctx: MutationCtx, id: string): Promise<Entity<FriendRequest>> {
  return store.transaction(async tx => {
    const r = await requirePending(tx, id, 'incoming')
    return write(tx, ctx, 'friendRequest', id, {...r.data, status: 'declined'}, false, 'friendRequest.decline')
  })
}

/** They accepted your request (from a pull, or the demo). `ctx.actor` is their account. */
export async function applyFriendRequestAccepted(store: Store, ctx: MutationCtx, id: string, account: {accountId: string; name: string}) {
  const people = await store.getAll<Person>('person')
  return store.transaction(async tx => {
    const r = await requirePending(tx, id, 'outgoing')
    const person = await linkPerson(tx, ctx, people, {...account, contact: r.data.contact}, true)
    const data: FriendRequest = {...r.data, status: 'accepted', accountId: account.accountId, personId: person.id}
    const request = await write(tx, ctx, 'friendRequest', id, data, false, 'friendRequest.accepted', {remote: true})
    return {person, request}
  })
}

/** Opening someone's invite link and tapping Accept: using a link is consent (26.18). */
export async function acceptInvite(store: Store, ctx: MutationCtx, input: {code: string; inviter: Account}): Promise<Entity<Person>> {
  if (!isInviteCode(input.code)) throw new DomainError('INVALID_INVITE')
  const people = await store.getAll<Person>('person')
  return store.transaction(async tx => {
    const person = await linkPerson(tx, ctx, people, input.inviter, false)
    await tx.enqueue({
      opId: ctx.newId(),
      deviceId: ctx.deviceId,
      actor: ctx.actor,
      entityType: 'person',
      entityId: person.id,
      opType: 'invite.accept',
      baseVersion: person.version,
      payload: {code: input.code, accountId: input.inviter.accountId},
      schemaVersion: 1,
      deps: [],
      attempts: 0,
      nextAttemptAt: null,
      lastError: null,
    })
    return person
  })
}

/* Invite links */

export interface InviteLink {
  kind: 'friend' | 'group'
  groupId: string | null
  /** The link's secret; also the entity id. */
  code: string
  /** Null: unlimited. */
  maxUses: number | null
  uses: number
  /** Epoch ms; null: never expires. */
  expiresAt: number | null
  /** Groups: each join waits for your approval. */
  approveJoins: boolean
  revoked: boolean
  createdAt: number
}

export type InviteLinkState = 'active' | 'expired' | 'used-up' | 'revoked'

const MAX_USES_CAP = 1000

/** Charset and length check for codes from links and QR codes (section 14). */
export function isInviteCode(s: string): boolean {
  return /^[a-z0-9]{3,32}$/.test(s)
}

/** Null when unlimited. */
export function usesLeft(link: InviteLink): number | null {
  return link.maxUses === null ? null : Math.max(0, link.maxUses - link.uses)
}

export function inviteLinkState(link: InviteLink, now: number): InviteLinkState {
  if (link.revoked) return 'revoked'
  if (link.expiresAt !== null && now > link.expiresAt) return 'expired'
  return usesLeft(link) === 0 ? 'used-up' : 'active'
}

/**
 * A new link code: 16 lower-case characters from a fresh UUID (60 random
 * bits), minted on the device like every id (section 9.3) and registered with
 * the directory before the link is recorded.
 */
export function mintInviteCode(ctx: Pick<MutationCtx, 'newId'>) {
  return ctx.newId().toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 16)
}

/**
 * Records an invite link the server has issued (the caller asks the
 * directory first; offline, no link is made: section 10 "never fabricates a URL").
 */
export async function createInviteLink(
  store: Store,
  ctx: MutationCtx,
  input: {
    kind: InviteLink['kind']
    groupId: string | null
    maxUses: number | null
    expiresInMs: number | null
    approveJoins: boolean
    /** The code the directory accepted (`mintInviteCode`); minted here when absent. */
    code?: string
  },
): Promise<Entity<InviteLink>> {
  const {maxUses, expiresInMs} = input
  if (maxUses !== null && !(Number.isInteger(maxUses) && maxUses >= 1 && maxUses <= MAX_USES_CAP)) throw new DomainError('INVALID_LIMIT')
  if (expiresInMs !== null && !(Number.isFinite(expiresInMs) && expiresInMs > 0)) throw new DomainError('INVALID_LIMIT')
  const code = input.code ?? mintInviteCode(ctx)
  if (!isInviteCode(code)) throw new DomainError('INVALID_INVITE')
  return store.transaction(async tx => {
    if (input.kind === 'group') await requireLive(tx, 'group', input.groupId ?? '')
    const now = ctx.now()
    const data: InviteLink = {
      kind: input.kind,
      groupId: input.kind === 'group' ? input.groupId : null,
      code,
      maxUses,
      uses: 0,
      expiresAt: expiresInMs === null ? null : now + expiresInMs,
      approveJoins: input.kind === 'group' && input.approveJoins,
      revoked: false,
      createdAt: now,
    }
    return write(tx, ctx, 'inviteLink', code, data, false, 'inviteLink.create')
  })
}

/** Stops a link working. Queues offline: it only ever takes access away. */
export async function revokeInviteLink(store: Store, ctx: MutationCtx, code: string): Promise<Entity<InviteLink>> {
  return store.transaction(async tx => {
    const l = await requireLive<InviteLink>(tx, 'inviteLink', code)
    return write(tx, ctx, 'inviteLink', code, {...l.data, revoked: true}, false, 'inviteLink.revoke')
  })
}

/** Someone used your link (from a pull, or the demo). */
export async function recordInviteUse(store: Store, ctx: MutationCtx, code: string): Promise<Entity<InviteLink>> {
  return store.transaction(async tx => {
    const l = await requireLive<InviteLink>(tx, 'inviteLink', code)
    if (inviteLinkState(l.data, ctx.now()) === 'used-up') throw new DomainError('INVITE_USED_UP')
    return write(tx, ctx, 'inviteLink', code, {...l.data, uses: l.data.uses + 1}, false, 'inviteLink.used', {remote: true})
  })
}
