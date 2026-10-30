/* F-269: who can join a group, and consent to be added (owner 196). Run on both engines. */
import 'fake-indexeddb/auto'
import {IDBFactory} from 'fake-indexeddb'

import {describe, expect, test} from 'bun:test'
import {DomainError} from '@splito/domain'

import {activityFromHistory} from '../src/activity'
import {createInviteLink, type InviteLink} from '../src/friends'
import {openIdbStore} from '../src/idbStore'
import {
  applyGroupRequestAccepted,
  approveJoinRequest,
  cancelGroupRequest,
  declineGroupRequest,
  type GroupRequest,
  invitedPeople,
  joinGroup,
  joinGroupViaLink,
  joinRequestsForAdmin,
  linkOutcome,
  receiveGroupInvite,
  receiveJoinRequest,
  requestToJoin,
} from '../src/groupJoins'
import {
  addGroupMembers,
  createExpense,
  createGroup,
  createPerson,
  ensureMe,
  type ExpenseDraft,
  type Group,
  joinPolicyOf,
  groupAdmins,
  setJoinPolicy,
  updateGroup,
} from '../src/mutations'
import {deleteGroup} from '../src/groupLifecycle'
import {openSqlStore} from '../src/sqlStore'
import {type Store} from '../src/store'
import {type MutationCtx} from '../src/types'
import {bunExecutor} from './bunExecutor'
import {expectDerivedTablesMatch} from './projectionCheck'

const code = (e: unknown) => (e instanceof DomainError ? e.code : String(e))
const engines: Array<[string, () => Promise<Store>]> = [
  ['SQLite', () => openSqlStore(bunExecutor(':memory:'))],
  ['IndexedDB', () => openIdbStore('joins', new IDBFactory())],
]

describe.each(engines)('%s group joins', (_name, open) => {
  let s: Store
  let ctx: MutationCtx
  let n = 0
  async function setup() {
    s = await open()
    ctx = {deviceId: 'dev1', actor: 'me', now: () => 1_000_000 + ++n, newId: () => 'id' + ++n}
    await ensureMe(s, ctx, 'Me')
  }
  const them = (accountId: string): MutationCtx => ({...ctx, actor: accountId})
  const ops = async (entityId: string) => (await s.outbox()).filter(o => o.entityId === entityId).map(o => o.opType)
  const linked = async (name: string, accountId: string) => {
    const p = await createPerson(s, ctx, {name})
    await s.transaction(tx => tx.put({...p, data: {...p.data, accountId}, version: p.version + 1}))
    return (await s.get<{name: string}>('person', p.id))!
  }
  const group = (extra: Partial<Parameters<typeof createGroup>[2]> = {}) =>
    createGroup(s, ctx, {name: 'Goa', kind: 'trip', currency: 'INR', startDate: null, endDate: null, memberIds: [], ...extra})
  const dinner = (groupId: string, who: string[]): ExpenseDraft => ({
    title: 'Dinner', groupId, currency: 'INR', total: 300n, payers: {me: 300n}, split: {mode: 'equal', participants: ['me', ...who]},
    date: '2026-10-26', tz: 'Asia/Kolkata', category: 'food', notes: '',
  })

  test('a new group defaults to "approve each join", and an old group without the field reads the same', async () => {
    await setup()
    const g = await group()
    expect(g.data.joinPolicy).toBe('approve')
    expect(joinPolicyOf({})).toBe('approve')
    expect((await group({joinPolicy: 'invite'})).data.joinPolicy).toBe('invite')
    expect(await group({joinPolicy: 'nope' as never}).catch(code)).toBe('INVALID_POLICY')
  })

  test('adding a Splito friend sends a group request; a private friend joins at once', async () => {
    await setup()
    const riya = await linked('Riya', 'acc-riya')
    const sam = await createPerson(s, ctx, {name: 'Sam'})
    const g = await group({memberIds: [sam.id, riya.id]})
    expect(g.data.members.map(m => m.personId).sort()).toEqual(['me', sam.id].sort())
    const [req] = await s.getAll<GroupRequest>('groupRequest')
    expect(req!.data).toMatchObject({kind: 'invite', direction: 'outgoing', status: 'pending', groupId: g.id, personId: riya.id, name: 'Riya'})
    expect(await ops(req!.id)).toEqual(['groupRequest.send'])
    expect(req!.syncStatus).toBe('pending')
    // Invited people are not members, so nothing can split with them.
    expect(invitedPeople([req!], g.id, 2_000_000).map(r => r.id)).toEqual([req!.id])
    expect(await createExpense(s, ctx, dinner(g.id, [riya.id])).catch(code)).toBe('NOT_A_MEMBER')
    // Adding again later does not repeat the request.
    const again = await addGroupMembers(s, ctx, g.id, [riya.id])
    expect(again).toMatchObject({added: [], asked: []})
    expect((await s.getAll('groupRequest')).length).toBe(1)
    expect(await addGroupMembers(s, ctx, g.id, [sam.id])).toMatchObject({added: [], asked: []})
    await expectDerivedTablesMatch(s)
  })

  test('once they say yes the invited friend is a member and selectable; cancel and decline keep them out', async () => {
    await setup()
    const riya = await linked('Riya', 'acc-riya')
    const g = await group()
    await addGroupMembers(s, ctx, g.id, [riya.id])
    const [req] = await s.getAll<GroupRequest>('groupRequest')
    const done = await applyGroupRequestAccepted(s, them('acc-riya'), req!.id, 'me')
    expect(done.data.status).toBe('accepted')
    expect(await ops(req!.id)).toEqual(['groupRequest.send'])
    await createExpense(s, ctx, dinner(g.id, [riya.id]))
    await addGroupMembers(s, ctx, g.id, [riya.id])
    const cancelled = await linked('Cara', 'acc-cara')
    await addGroupMembers(s, ctx, g.id, [cancelled.id])
    const second = (await s.getAll<GroupRequest>('groupRequest')).find(r => r.data.personId === cancelled.id)!
    const c = await cancelGroupRequest(s, ctx, second.id)
    expect(c.data.status).toBe('cancelled')
    expect(await ops(second.id)).toEqual(['groupRequest.send', 'groupRequest.cancel'])
    expect(invitedPeople(await s.getAll<GroupRequest>('groupRequest'), g.id, 2_000_000)).toEqual([])
    expect(await declineGroupRequest(s, ctx, second.id).catch(code)).toBe('NOT_INCOMING')
  })

  test('"X added you to G": Join makes the group here with me in it; Decline is silent and final', async () => {
    await setup()
    const snap = {groupId: 'goa-remote', groupName: 'Goa', groupKind: 'trip' as const, groupCurrency: 'INR'}
    const inv = await receiveGroupInvite(s, them('acc-riya'), {id: 'gi1', ...snap, inviter: {accountId: 'acc-riya', name: 'Riya', contact: null}})
    expect(inv.data).toMatchObject({kind: 'invite', direction: 'incoming', status: 'pending', name: 'Riya'})
    expect(await ops('gi1')).toEqual([])
    const {group: joined, request} = await joinGroup(s, ctx, 'gi1')
    expect(request.data.status).toBe('accepted')
    expect(joined.id).toBe('goa-remote')
    expect(joined.data.members.map(m => m.personId)).toContain('me')
    expect(await ops('gi1')).toEqual(['groupRequest.accept'])
    expect(await joinGroup(s, ctx, 'gi1').catch(code)).toBe('NOT_PENDING')
    await receiveGroupInvite(s, them('acc-riya'), {id: 'gi2', ...snap, groupId: 'trek', groupName: 'Trek', inviter: {accountId: 'acc-riya', name: 'Riya', contact: null}})
    const declined = await declineGroupRequest(s, ctx, 'gi2')
    expect(declined.data.status).toBe('declined')
    expect(await s.get('group', 'trek')).toBeUndefined()
    expect(await joinGroup(s, ctx, 'gi2').catch(code)).toBe('NOT_PENDING')
    await expectDerivedTablesMatch(s)
  })

  test('a join request is answered by an admin only; approving adds the joiner, declining does not', async () => {
    await setup()
    const g = await group({joinPolicy: 'approve'})
    const joiner = {accountId: 'acc-sam', name: 'Sam', contact: null}
    await receiveJoinRequest(s, them('acc-sam'), {id: 'jr1', groupId: g.id, joiner})
    await receiveJoinRequest(s, them('acc-sam'), {id: 'jr2', groupId: g.id, joiner: {...joiner, accountId: 'acc-ned', name: 'Ned'}})
    const all = await s.getAll<GroupRequest>('groupRequest')
    const groups = await s.getAll<Group>('group')
    expect(joinRequestsForAdmin(all, groups, 'me', 2_000_000).map(r => r.id).sort()).toEqual(['jr1', 'jr2'])
    expect(joinRequestsForAdmin(all, groups, 'someone-else', 2_000_000)).toEqual([])
    const bob = await createPerson(s, ctx, {name: 'Bob'})
    await addGroupMembers(s, ctx, g.id, [bob.id])
    const asBob: MutationCtx = {...ctx, actor: bob.id}
    expect(await approveJoinRequest(s, asBob, 'jr1').catch(code)).toBe('NOT_ADMIN')
    expect(await declineGroupRequest(s, asBob, 'jr1').catch(code)).toBe('NOT_ADMIN')
    const {group: after, request} = await approveJoinRequest(s, ctx, 'jr1')
    expect(request.data).toMatchObject({status: 'accepted'})
    expect(after.data.members.map(m => m.personId)).toContain(request.data.personId!)
    expect(await ops('jr1')).toEqual(['groupRequest.approve'])
    await createExpense(s, ctx, dinner(g.id, [request.data.personId!]))
    const declined = await declineGroupRequest(s, ctx, 'jr2')
    expect(declined.data.status).toBe('declined')
    expect((await s.get<Group>('group', g.id))!.data.members.length).toBe(3)
    expect(await approveJoinRequest(s, ctx, 'gi-nope').catch(code)).toBe('NOT_FOUND')
    expect(await approveJoinRequest(s, ctx, 'jr2').catch(code)).toBe('NOT_PENDING')
    await expectDerivedTablesMatch(s)
  })

  test('opening a link: join at once, a join request, or nothing, by the group\'s rule', async () => {
    await setup()
    expect(linkOutcome({joinPolicy: 'link'})).toBe('join')
    expect(linkOutcome({})).toBe('request')
    expect(linkOutcome({joinPolicy: 'invite'})).toBe('none')
    const snap = {groupId: 'lis', groupName: 'Lisbon', groupKind: 'trip' as const, groupCurrency: 'EUR'}
    const mine = await requestToJoin(s, ctx, snap)
    expect(mine.data).toMatchObject({kind: 'join', direction: 'outgoing', status: 'pending'})
    expect(await ops(mine.id)).toEqual(['groupRequest.send'])
    expect(await requestToJoin(s, ctx, snap).catch(code)).toBe('ALREADY_REQUESTED')
    await applyGroupRequestAccepted(s, them('acc-admin'), mine.id, 'me', {accountId: 'acc-admin', name: 'Ada Admin', contact: null})
    // The approver runs the group; I am a member of it, not its sole admin.
    const lis = (await s.get<Group>('group', 'lis'))!.data
    const ada = (await s.getAll<{name: string; accountId?: string}>('person')).find(p => p.data.accountId === 'acc-admin')!
    expect(lis.members.map(m => [m.personId, m.role])).toEqual([[ada.id, 'admin'], ['me', 'member']])
    expect(groupAdmins(lis)).toEqual([ada.id])
    const inviter = { accountId: 'acc-o', name: 'Olu', contact: null }
    const immediate = await joinGroupViaLink(s, ctx, {...snap, groupId: 'open', groupName: 'Open', inviter, code: 'openlink1'})
    expect(immediate.data.members.map(m => m.personId)).toContain('me')
    expect(await ops('open')).toEqual(['group.join'])
    // The group keeps the rule the link showed.
    const kept = await joinGroupViaLink(s, ctx, {...snap, groupId: 'open2', groupName: 'Open 2', groupJoinPolicy: 'link', inviter, code: 'openlink2'})
    expect(kept.data.joinPolicy).toBe('link')
  })

  test('only an admin changes the rule; invite only revokes every group link, the others keep them in step', async () => {
    await setup()
    const g = await group()
    const other = await group({name: 'Other'})
    const open = {kind: 'group' as const, maxUses: null, expiresInMs: null, approveJoins: false}
    const link = await createInviteLink(s, ctx, {...open, groupId: g.id})
    const otherLink = await createInviteLink(s, ctx, {...open, groupId: other.id})
    // The group's rule decides the link, whatever the caller passed.
    expect(link.data.approveJoins).toBe(true)
    const edit = (policy: Group['joinPolicy'], c = ctx) => updateGroup(s, c, g.id, {name: 'Goa', kind: 'trip', currency: 'INR', startDate: null, endDate: null, joinPolicy: policy})
    const bob = await createPerson(s, ctx, {name: 'Bob'})
    await addGroupMembers(s, ctx, g.id, [bob.id])
    expect(await edit('link', {...ctx, actor: bob.id}).catch(code)).toBe('NOT_ADMIN')
    await edit('link')
    expect((await s.get<InviteLink>('inviteLink', link.id))!.data).toMatchObject({approveJoins: false, revoked: false})
    await edit('approve')
    expect((await s.get<InviteLink>('inviteLink', link.id))!.data).toMatchObject({approveJoins: true, revoked: false})
    const saved = await edit('invite')
    expect(saved.data.joinPolicy).toBe('invite')
    expect((await s.get<InviteLink>('inviteLink', link.id))!.data.revoked).toBe(true)
    expect((await s.get<InviteLink>('inviteLink', otherLink.id))!.data.revoked).toBe(false)
    expect(await ops(link.id)).toEqual(['inviteLink.create', 'inviteLink.update', 'inviteLink.update', 'inviteLink.revoke'])
    expect(await createInviteLink(s, ctx, {...open, groupId: g.id}).catch(code)).toBe('LINK_DISABLED')
    // Saving the same rule again is only an edit, open to a non-admin who changes nothing else... except it still writes the group.
    expect((await edit('invite')).version).toBe(saved.version + 1)
    // The rule has history.
    const history = await s.history('group', g.id)
    expect(history.map(h => (h.data as Group).joinPolicy)).toContain('invite')
  })

  test('group requests reach Activity: invited and join requested show as news, answers do not', async () => {
    await setup()
    const g = await group()
    await receiveGroupInvite(s, them('acc-riya'), {id: 'gi1', groupId: 'goa-remote', groupName: 'Goa', groupKind: 'trip', groupCurrency: 'INR', inviter: {accountId: 'acc-riya', name: 'Riya', contact: null}})
    await receiveJoinRequest(s, them('acc-sam'), {id: 'jr1', groupId: g.id, joiner: {accountId: 'acc-sam', name: 'Sam', contact: null}})
    const mineJoin = await requestToJoin(s, ctx, {groupId: 'lis', groupName: 'Lisbon', groupKind: 'trip', groupCurrency: 'EUR'})
    const riya = await linked('Riya2', 'acc-r2')
    await addGroupMembers(s, ctx, g.id, [riya.id])
    await joinGroup(s, ctx, 'gi1')
    await declineGroupRequest(s, ctx, 'jr1')
    const dump = await s.dump()
    const kinds = activityFromHistory(dump.history).filter(e => e.entityType === 'groupRequest').map(e => e.kind).sort()
    expect(kinds).toEqual(['groupRequest.accepted', 'groupRequest.invited', 'groupRequest.joinRequested', 'groupRequest.joinSent', 'groupRequest.sent'])
    expect(mineJoin.data.groupId).toBe('lis')
  })

  test('unlinked friends are added at once; only account-linked friends are asked', async () => {
    await setup()
    const sam = await createPerson(s, ctx, {name: 'Sam'})
    const lea = await createPerson(s, ctx, {name: 'Lea'})
    const riya = await linked('Riya', 'acc-riya')
    const g = await group({memberIds: [sam.id]})
    expect(g.data.members.map(m => m.personId).sort()).toEqual(['me', sam.id].sort())
    expect(await s.getAll('groupRequest')).toEqual([])
    const out = await addGroupMembers(s, ctx, g.id, [lea.id, riya.id, sam.id])
    expect(out.added).toEqual([lea.id])
    expect(out.asked).toEqual([riya.id])
    expect(out.group.data.members.map(m => m.personId)).toContain(lea.id)
    expect((await s.getAll<GroupRequest>('groupRequest')).map(r => r.data.personId)).toEqual([riya.id])
  })

  test('a request that lapsed does not block asking again (invite and join)', async () => {
    await setup()
    const riya = await linked('Riya', 'acc-riya')
    const g = await group()
    await addGroupMembers(s, ctx, g.id, [riya.id])
    const later: MutationCtx = {...ctx, now: () => ctx.now() + 31 * 86_400_000}
    const out = await addGroupMembers(s, later, g.id, [riya.id])
    expect(out.asked).toEqual([riya.id])
    const pending = invitedPeople(await s.getAll<GroupRequest>('groupRequest'), g.id, later.now())
    expect(pending.length).toBe(1)
    const snap = {groupId: 'lis', groupName: 'Lisbon', groupKind: 'trip' as const, groupCurrency: 'EUR'}
    await requestToJoin(s, ctx, snap)
    expect(await requestToJoin(s, later, snap).then(r => r.data.status)).toBe('pending')
  })

  test('getting in by a request or a link is the request\'s row in Activity, not "created" or "edited"', async () => {
    await setup()
    const snap = {groupId: 'goa-remote', groupName: 'Goa', groupKind: 'trip' as const, groupCurrency: 'INR'}
    const riya = {accountId: 'acc-riya', name: 'Riya', contact: null}
    await receiveGroupInvite(s, them('acc-riya'), {id: 'gi1', ...snap, inviter: riya})
    await joinGroup(s, ctx, 'gi1')
    await joinGroupViaLink(s, ctx, {...snap, groupId: 'open', groupName: 'Open', inviter: riya, code: 'openlink1'})
    const mine = await group()
    await receiveJoinRequest(s, them('acc-sam'), {id: 'jr1', groupId: mine.id, joiner: {accountId: 'acc-sam', name: 'Sam', contact: null}})
    await approveJoinRequest(s, ctx, 'jr1')
    const mineJoin = await requestToJoin(s, ctx, {...snap, groupId: 'lis', groupName: 'Lisbon'})
    await applyGroupRequestAccepted(s, them('acc-ada'), mineJoin.id, 'me', {accountId: 'acc-ada', name: 'Ada', contact: null})
    const events = activityFromHistory((await s.dump()).history)
    const groupEvents = events.filter(e => e.entityType === 'group').map(e => [e.entityId === mine.id ? 'mine' : e.entityId, e.kind])
    expect(groupEvents).toEqual([['mine', 'group.created']])
    expect(events.filter(e => e.kind === 'groupRequest.accepted').length).toBe(3)
    // A later edit of a joined group is a normal event again.
    await updateGroup(s, ctx, mine.id, {name: 'Goa 2', kind: 'trip', currency: 'INR', startDate: null, endDate: null})
    const after = activityFromHistory((await s.dump()).history).filter(e => e.entityType === 'group' && e.entityId === mine.id)
    expect(after.map(e => e.kind).sort()).toEqual(['group.created', 'group.edited'])
  })

  test('only an admin changes the rule, whichever way it is called', async () => {
    await setup()
    const g = await group()
    const bob = await createPerson(s, ctx, {name: 'Bob'})
    await addGroupMembers(s, ctx, g.id, [bob.id])
    expect(await setJoinPolicy(s, {...ctx, actor: bob.id}, g.id, 'invite').catch(code)).toBe('NOT_ADMIN')
    expect(joinPolicyOf((await s.get<Group>('group', g.id))!.data)).toBe('approve')
    expect((await setJoinPolicy(s, ctx, g.id, 'link')).data.joinPolicy).toBe('link')
    // The same rule again is nothing to change, even for a member.
    expect((await setJoinPolicy(s, {...ctx, actor: bob.id}, g.id, 'link')).data.joinPolicy).toBe('link')
  })

  test('a group I hold takes me in without a second op; a group I deleted is not brought back', async () => {
    await setup()
    const held = await group()
    const inviter = {accountId: 'acc-o', name: 'Olu', contact: null}
    const snap = {groupId: held.id, groupName: held.data.name, groupKind: held.data.kind, groupCurrency: held.data.currency, inviter, code: 'heldlink1'}
    const out = await joinGroupViaLink(s, ctx, snap)
    expect(out.data.members.filter(m => m.leftAt === null && m.personId === 'me').length).toBe(1)
    // One op for the join (the link code), not one for the group row as well.
    expect((await s.outbox()).filter(o => o.entityId === held.id).map(o => o.opType)).toEqual(['group.create', 'group.join'])
    const gone = await group({name: 'Gone'})
    await deleteGroup(s, ctx, gone.id)
    expect(await joinGroupViaLink(s, ctx, {...snap, groupId: gone.id, code: 'gonelink1'}).catch(code)).toBe('GROUP_DELETED')
    expect((await s.get<Group>('group', gone.id))!.deleted).toBe(true)
    await receiveGroupInvite(s, them('acc-riya'), {id: 'gi9', groupId: gone.id, groupName: 'Gone', groupKind: 'trip', groupCurrency: 'INR', inviter})
    expect(await joinGroup(s, ctx, 'gi9').catch(code)).toBe('GROUP_DELETED')
  })

  test('nobody is invited to a deleted group', async () => {
    await setup()
    const riya = await linked('Riya', 'acc-riya')
    const g = await group()
    await deleteGroup(s, ctx, g.id)
    expect(await addGroupMembers(s, ctx, g.id, [riya.id]).catch(code)).toBe('NOT_FOUND')
    expect(await s.getAll('groupRequest')).toEqual([])
  })
})
