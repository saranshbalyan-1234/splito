import {beforeEach, expect, test} from 'bun:test'
import {type Contact, DomainError} from '@splito/domain'

import {activityFromHistory} from '../src/activity'
import {demoDirectory, offlineDirectory} from '../src/directory'
import {
  acceptFriendRequest,
  acceptInvite,
  applyFriendRequestAccepted,
  cancelFriendRequest,
  createInviteLink,
  declineFriendRequest,
  type FriendRequest,
  incomingRequests,
  type InviteLink,
  inviteLinkState,
  isInviteCode,
  mintInviteCode,
  outgoingRequests,
  receiveFriendRequest,
  recordInviteUse,
  REQUEST_LIFETIME_MS,
  requestState,
  resendFriendRequest,
  revokeInviteLink,
  selectablePeople,
  sendFriendRequest,
  usesLeft,
} from '../src/friends'
import {createExpense, createGroup, createPerson, ensureMe, type Person} from '../src/mutations'
import {openSqlStore} from '../src/sqlStore'
import {type Store} from '../src/store'
import {type MutationCtx} from '../src/types'
import {bunExecutor} from './bunExecutor'

let s: Store
let ctx: MutationCtx
let n = 0
let clock = 1_000_000
beforeEach(async () => {
  s = await openSqlStore(bunExecutor(':memory:'))
  clock = 1_000_000
  ctx = {deviceId: 'dev1', actor: 'me', now: () => clock, newId: () => 'id' + ++n}
  await ensureMe(s, ctx, 'Me')
})

const ananya: Contact = {kind: 'email', value: 'ananya@example.com'}
const phone: Contact = {kind: 'phone', value: '+919876543210'}
const them = (accountId: string): MutationCtx => ({...ctx, actor: accountId})
const ops = async (entityId: string) => (await s.outbox()).filter(o => o.entityId === entityId).map(o => o.opType)
const code = (e: unknown) => (e instanceof DomainError ? e.code : String(e))

test('an outgoing request is pending, queued in the outbox, and its person is not selectable', async () => {
  const r = await sendFriendRequest(s, ctx, {contact: ananya, name: 'Ananya', reach: 'on-splito'})
  expect(r.data).toMatchObject({direction: 'outgoing', status: 'pending', reach: 'on-splito', personId: null, sentAt: clock})
  expect(await ops(r.id)).toEqual(['friendRequest.send'])
  expect(requestState(r.data, clock)).toBe('pending')
  // Nobody is created until they accept, so no picker or mutation can use them.
  expect((await s.getAll<Person>('person')).map(p => p.id)).toEqual(['me'])
  expect(outgoingRequests([r], clock).map(x => x.id)).toEqual([r.id])
})

test('sending twice to the same contact, or to a friend, is refused', async () => {
  await sendFriendRequest(s, ctx, {contact: ananya, name: '', reach: 'on-splito'})
  expect(await sendFriendRequest(s, ctx, {contact: ananya, name: '', reach: 'on-splito'}).catch(code)).toBe('ALREADY_REQUESTED')
  const r = await sendFriendRequest(s, ctx, {contact: phone, name: '', reach: 'on-splito'})
  await applyFriendRequestAccepted(s, them('acc-p'), r.id, {accountId: 'acc-p', name: 'Pranav'})
  expect(await sendFriendRequest(s, ctx, {contact: phone, name: '', reach: 'on-splito'}).catch(code)).toBe('ALREADY_FRIENDS')
})

test('a bad contact is refused', async () => {
  expect(await sendFriendRequest(s, ctx, {contact: {kind: 'phone', value: '123'}, name: '', reach: 'on-splito'}).catch(code)).toBe('INVALID_CONTACT')
})

test('requests expire after 30 days; resend restarts the clock; cancel is final', async () => {
  const r = await sendFriendRequest(s, ctx, {contact: ananya, name: '', reach: 'unchecked'})
  expect(requestState(r.data, clock + REQUEST_LIFETIME_MS + 1)).toBe('expired')
  expect(outgoingRequests([r], clock + REQUEST_LIFETIME_MS + 1)).toEqual([])
  clock += 10 * 86_400_000
  const again = await resendFriendRequest(s, ctx, r.id)
  expect(again.data.sentAt).toBe(clock)
  expect(requestState(again.data, clock + 25 * 86_400_000)).toBe('pending')
  const gone = await cancelFriendRequest(s, ctx, r.id)
  expect(gone.data.status).toBe('cancelled')
  expect(await ops(r.id)).toEqual(['friendRequest.send', 'friendRequest.resend', 'friendRequest.cancel'])
  expect(await resendFriendRequest(s, ctx, r.id).catch(code)).toBe('NOT_PENDING')
})

test('when they accept, a friend linked to their account appears and is selectable everywhere', async () => {
  const r = await sendFriendRequest(s, ctx, {contact: ananya, name: 'Ananya', reach: 'on-splito'})
  const {person, request} = await applyFriendRequestAccepted(s, them('acc-a'), r.id, {accountId: 'acc-a', name: 'Ananya Gupta'})
  expect(person.data).toMatchObject({name: 'Ananya Gupta', accountId: 'acc-a', contact: ananya, isMe: false})
  expect(request.data).toMatchObject({status: 'accepted', personId: person.id})
  // Applied from their side: history, but nothing for this device to push.
  expect(await ops(r.id)).toEqual(['friendRequest.send'])
  expect(await ops(person.id)).toEqual([])
  const g = await createGroup(s, ctx, {name: 'Trip', kind: 'trip', currency: 'INR', startDate: null, endDate: null, memberIds: [person.id]})
  await createExpense(s, ctx, {
    title: 'Taxi', groupId: g.id, currency: 'INR', total: 200n, payers: {me: 200n},
    split: {mode: 'equal', participants: ['me', person.id]}, date: '2026-10-26', tz: 'Asia/Kolkata', category: 'transport', notes: '',
  })
})

test('a private friend with the same contact is linked on accept, not duplicated (F-616)', async () => {
  const priv = await createPerson(s, ctx, {name: 'Riya', contact: phone})
  expect(priv.data.accountId).toBeUndefined()
  const r = await sendFriendRequest(s, ctx, {contact: phone, name: 'Riya', reach: 'on-splito'})
  const {person} = await applyFriendRequestAccepted(s, them('acc-r'), r.id, {accountId: 'acc-r', name: 'Riya S'})
  expect(person.id).toBe(priv.id)
  // Your name for them stays; their account is now attached.
  expect(person.data).toMatchObject({name: 'Riya', accountId: 'acc-r', contact: phone})
  expect((await s.getAll<Person>('person')).length).toBe(2)
})

test('a private friend can be added by contact alone, named after it', async () => {
  const p = await createPerson(s, ctx, {name: ' ', contact: phone})
  expect(p.data.name).toBe('+91 98765 43210')
  expect(await createPerson(s, ctx, {name: 'X', contact: {kind: 'email', value: 'nope'}}).catch(code)).toBe('INVALID_CONTACT')
})

test('incoming: received without an op, accepted or declined by me with one', async () => {
  const r = await receiveFriendRequest(s, them('acc-i'), {id: 'req-i', accountId: 'acc-i', name: 'Ishaan', contact: null})
  expect(r.data).toMatchObject({direction: 'incoming', status: 'pending'})
  expect(await ops('req-i')).toEqual([])
  expect(incomingRequests([r], clock).map(x => x.id)).toEqual(['req-i'])
  const {person} = await acceptFriendRequest(s, ctx, 'req-i')
  expect(person.data).toMatchObject({name: 'Ishaan', accountId: 'acc-i'})
  expect(await ops('req-i')).toEqual(['friendRequest.accept'])
  expect(await ops(person.id)).toEqual(['person.create'])

  const d = await receiveFriendRequest(s, them('acc-d'), {id: 'req-d', accountId: 'acc-d', name: 'Dev', contact: null})
  const declined = await declineFriendRequest(s, ctx, d.id)
  expect(declined.data.status).toBe('declined')
  expect(incomingRequests([declined], clock)).toEqual([])
  expect(await acceptFriendRequest(s, ctx, 'req-d').catch(code)).toBe('NOT_PENDING')
  // Only incoming requests can be accepted by you.
  const out = await sendFriendRequest(s, ctx, {contact: ananya, name: '', reach: 'on-splito'})
  expect(await acceptFriendRequest(s, ctx, out.id).catch(code)).toBe('NOT_INCOMING')
})

test('activity: incoming requests and acceptances by others, but not the linked person row', async () => {
  await receiveFriendRequest(s, them('acc-i'), {id: 'req-i', accountId: 'acc-i', name: 'Ishaan', contact: null})
  const out = await sendFriendRequest(s, ctx, {contact: ananya, name: '', reach: 'on-splito'})
  await applyFriendRequestAccepted(s, them('acc-a'), out.id, {accountId: 'acc-a', name: 'Ananya'})
  const rows = [
    ...(await s.history('friendRequest', 'req-i')),
    ...(await s.history('friendRequest', out.id)),
    ...(await Promise.all((await s.getAll('person')).map(p => s.history('person', p.id)))).flat(),
  ]
  const kinds = activityFromHistory(rows).map(e => `${e.kind}:${e.actor}`)
  expect(kinds.sort()).toEqual(['friendRequest.accepted:acc-a', 'friendRequest.received:acc-i', 'friendRequest.sent:me'])
})

test('accepting someone’s invite link makes them a friend and records the acceptance', async () => {
  const p = await acceptInvite(s, ctx, {code: 'abc123', inviter: {accountId: 'acc-x', name: 'Xavier', contact: null}})
  expect(p.data).toMatchObject({name: 'Xavier', accountId: 'acc-x'})
  expect((await s.outbox()).map(o => o.opType)).toContain('invite.accept')
  // Accepting again returns the same friend.
  const again = await acceptInvite(s, ctx, {code: 'abc123', inviter: {accountId: 'acc-x', name: 'Xavier', contact: null}})
  expect(again.id).toBe(p.id)
})

test('invite links: limits, uses left, expiry, revoke', async () => {
  const link = await createInviteLink(s, ctx, {kind: 'friend', groupId: null, maxUses: 1, expiresInMs: 7 * 86_400_000, approveJoins: false})
  expect(isInviteCode(link.id)).toBe(true)
  expect(link.data).toMatchObject({code: link.id, uses: 0, maxUses: 1, expiresAt: clock + 7 * 86_400_000, revoked: false})
  expect(usesLeft(link.data)).toBe(1)
  expect(inviteLinkState(link.data, clock)).toBe('active')
  expect(inviteLinkState(link.data, clock + 7 * 86_400_000 + 1)).toBe('expired')
  const used = await recordInviteUse(s, them('acc-u'), link.id)
  expect(usesLeft(used.data)).toBe(0)
  expect(inviteLinkState(used.data, clock)).toBe('used-up')
  expect(await recordInviteUse(s, them('acc-u'), link.id).catch(code)).toBe('INVITE_USED_UP')

  const forever = await createInviteLink(s, ctx, {kind: 'friend', groupId: null, maxUses: null, expiresInMs: null, approveJoins: false})
  expect(usesLeft(forever.data)).toBeNull()
  expect(inviteLinkState(forever.data, clock + 10 ** 12)).toBe('active')
  const revoked = await revokeInviteLink(s, ctx, forever.id)
  expect(inviteLinkState(revoked.data, clock)).toBe('revoked')
  expect(await ops(forever.id)).toEqual(['inviteLink.create', 'inviteLink.revoke'])
})

test('group invite links need a live group and validate their limits', async () => {
  expect(await createInviteLink(s, ctx, {kind: 'group', groupId: 'nope', maxUses: 25, expiresInMs: null, approveJoins: true}).catch(code)).toBe('NOT_FOUND')
  const g = await createGroup(s, ctx, {name: 'Goa', kind: 'trip', currency: 'INR', startDate: null, endDate: null, memberIds: []})
  const link = await createInviteLink(s, ctx, {kind: 'group', groupId: g.id, maxUses: 25, expiresInMs: null, approveJoins: true})
  expect(link.data).toMatchObject({kind: 'group', groupId: g.id, approveJoins: true})
  expect(await createInviteLink(s, ctx, {kind: 'friend', groupId: null, maxUses: 0, expiresInMs: null, approveJoins: false}).catch(code)).toBe('INVALID_LIMIT')
  expect(await createInviteLink(s, ctx, {kind: 'friend', groupId: null, maxUses: 1, expiresInMs: -1, approveJoins: false}).catch(code)).toBe('INVALID_LIMIT')
})

test('isInviteCode sanitises link params', () => {
  expect(isInviteCode('k3j2h1g0f9e8')).toBe(true)
  for (const bad of ['', 'ab', 'A'.repeat(4), 'abc/def', 'x'.repeat(33), '../etc']) expect(isInviteCode(bad)).toBe(false)
  const minted = mintInviteCode({newId: () => '3F2504E0-4F89-41D3-9A0C-0305E82C3301'})
  expect(minted).toBe('3f2504e04f8941d3')
  expect(isInviteCode(minted)).toBe(true)
})

test('a link takes the code the directory accepted', async () => {
  const link = await createInviteLink(s, ctx, {kind: 'friend', groupId: null, maxUses: 1, expiresInMs: null, approveJoins: false, code: 'k3j2h1g0f9e8'})
  expect(link.id).toBe('k3j2h1g0f9e8')
  expect(await createInviteLink(s, ctx, {kind: 'friend', groupId: null, maxUses: 1, expiresInMs: null, approveJoins: false, code: 'BAD/'}).catch(code)).toBe('INVALID_INVITE')
})

test('pickers: friends (private or linked) are selectable; pending requests are listed apart', async () => {
  const priv = await createPerson(s, ctx, {name: 'Only mine'})
  await sendFriendRequest(s, ctx, {contact: ananya, name: 'Ananya', reach: 'on-splito'})
  const people = await s.getAll<Person>('person')
  const requests = await s.getAll<FriendRequest>('friendRequest')
  const pick = selectablePeople(people, requests, clock)
  expect(pick.selectable.map(p => p.id)).toEqual([priv.id])
  expect(pick.pending.map(r => r.data.name)).toEqual(['Ananya'])
})

test('offline directory never claims success', async () => {
  expect(await offlineDirectory.lookup(ananya)).toBe('unavailable')
  expect(await offlineDirectory.sendRequest('r')).toBe('queued')
  expect(await offlineDirectory.createInviteLink('c')).toBe('unavailable')
  expect(await offlineDirectory.revoke('c')).toBe('queued')
  expect(await offlineDirectory.accept('r')).toBe('queued')
  expect(await offlineDirectory.openInvite('abc123')).toBe('unavailable')
  expect(offlineDirectory.isDemo).toBe(false)
})

test('demo directory answers every branch', async () => {
  const d = demoDirectory({
    accounts: [{accountId: 'acc-a', name: 'Ananya', contact: ananya}],
    invites: {demo123: {kind: 'friend', inviter: 'acc-a', groupName: null}},
    latencyMs: 0,
  })
  expect(d.isDemo).toBe(true)
  expect(await d.lookup(ananya)).toBe('on-splito')
  expect(await d.lookup(phone)).toBe('not-on-splito')
  expect(await d.sendRequest('r')).toBe('sent')
  expect(await d.createInviteLink('c')).toBe('created')
  expect(await d.openInvite('demo123')).toEqual({kind: 'friend', inviter: {accountId: 'acc-a', name: 'Ananya', contact: ananya}, groupName: null})
  expect(await d.openInvite('zzz999')).toBe('not-found')
  expect(d.accountFor(ananya)?.accountId).toBe('acc-a')
})

test('link records stay typed', async () => {
  const link = await createInviteLink(s, ctx, {kind: 'friend', groupId: null, maxUses: 5, expiresInMs: 86_400_000, approveJoins: false})
  const all = await s.getAll<InviteLink>('inviteLink')
  expect(all[0]!.data.maxUses).toBe(5)
  expect(link.data.createdAt).toBe(clock)
})
