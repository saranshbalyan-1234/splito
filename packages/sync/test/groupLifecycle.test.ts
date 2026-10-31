/* F-604 active / inactive and show / hide, F-615 leave and delete a group, F-613 part 1 remove a member. */
import {beforeEach, expect, test} from 'bun:test'
import {DomainError} from '@splito/domain'

import {activityFromHistory, loadActivity} from '../src/activity'
import {
  makeGroupInactive,
  deleteGroup,
  groupContents,
  leaveGroup,
  previewMemberExit,
  removeGroupMember,
  setGroupHidden,
  restoreGroup,
  makeGroupActive,
} from '../src/groupLifecycle'
import {
  addGroupMembers,
  createExpense,
  createGroup,
  createPerson,
  createRepayment,
  createWriteOffs,
  deleteExpense,
  deletePerson,
  restorePerson,
  updateExpense,
  ensureMe,
  type ExpenseDraft,
  type Group,
  groupAdmins,
  isGroupInactive,
  restoreExpense,
} from '../src/mutations'
import {getPref} from '../src/preferences'
import {openSqlStore} from '../src/sqlStore'
import {type Store} from '../src/store'
import {type MutationCtx} from '../src/types'
import {bunExecutor} from './bunExecutor'
import {expectDerivedTablesMatch, expectProjectionsMatchLedger} from './projectionCheck'

let s: Store
let ctx: MutationCtx
let n = 0
let clock = 0
beforeEach(async () => {
  clock = 1_000_000
  s = await openSqlStore(bunExecutor(':memory:'))
  ctx = {deviceId: 'dev1', actor: 'me', now: () => ++clock, newId: () => 'id' + ++n}
  await ensureMe(s, ctx, 'Me')
})

const codeOf = async (p: Promise<unknown>) => {
  try {
    await p
  } catch (e) {
    if (e instanceof DomainError) return e.code
    throw e
  }
  return undefined
}

/** me + bob + cara in "Flat"; me paid 3000 EUR split three ways, so bob and cara owe me 1000 each. */
async function flat() {
  const bob = await createPerson(s, ctx, {name: 'Bob'})
  const cara = await createPerson(s, ctx, {name: 'Cara'})
  const g = await createGroup(s, ctx, {name: 'Flat', kind: 'home', currency: 'EUR', startDate: null, endDate: null, memberIds: [bob.id, cara.id]})
  const draft = (over: Partial<ExpenseDraft> = {}): ExpenseDraft => ({
    title: 'Rent',
    groupId: g.id,
    currency: 'EUR',
    total: 3000n,
    payers: {me: 3000n},
    split: {mode: 'equal', participants: ['me', bob.id, cara.id]},
    date: '2026-10-26',
    tz: 'Asia/Kolkata',
    category: 'stay',
    notes: '',
    ...over,
  })
  const e = await createExpense(s, ctx, draft())
  return {bob, cara, g, e, draft}
}
const net = async (groupId: string, personId: string) => (await s.balances({groupId})).filter(b => b.personId === personId && b.amount !== 0n).map(b => [b.currency, b.amount])
const exit = {date: '2026-10-27', tz: 'Asia/Kolkata'}

/* ------------------------------- F-604 active / inactive and show / hide ------------------------------- */

test('inactive keeps a group\'s balances and records; active brings it back', async () => {
  const {g} = await flat()
  const before = await s.balances({groupId: g.id})
  const a = await makeGroupInactive(s, ctx, g.id)
  expect(a.data.inactive).toBe(true)
  expect(await s.balances({groupId: g.id})).toEqual(before)
  expect(isGroupInactive(a.data)).toBe(true)
  const u = await makeGroupActive(s, ctx, g.id)
  expect(isGroupInactive(u.data)).toBe(false)
  const kinds = (await loadActivity(s)).filter(x => x.entityType === 'group').map(x => x.kind)
  expect(kinds).toEqual(['group.active', 'group.inactive', 'group.created'])
  // One outbox op per change, in history.
  expect((await s.outbox()).filter(o => o.entityId === g.id).map(o => o.opType)).toEqual(['group.create', 'group.inactive', 'group.active'])
})

test('an inactive group rejects add, edit, move-into and restore-into with GROUP_INACTIVE, but settling still works', async () => {
  const {g, bob, e, draft} = await flat()
  const other = await createExpense(s, ctx, draft({groupId: null, split: {mode: 'equal', participants: ['me', bob.id]}}))
  const inGroup = await createExpense(s, ctx, draft({title: 'Wi-Fi'}))
  await deleteExpense(s, ctx, inGroup.id)
  await makeGroupInactive(s, ctx, g.id)
  expect(await codeOf(createExpense(s, ctx, draft()))).toBe('GROUP_INACTIVE')
  expect(await codeOf(updateExpense(s, ctx, e.id, draft({title: 'Edited'})))).toBe('GROUP_INACTIVE')
  expect(await codeOf(updateExpense(s, ctx, other.id, draft()))).toBe('GROUP_INACTIVE')
  expect(await codeOf(restoreExpense(s, ctx, inGroup.id))).toBe('GROUP_INACTIVE')
  expect((await s.get('expense', inGroup.id))!.deleted).toBe(true)
  // Records outside the inactive group, and deleting inside it, are untouched.
  await updateExpense(s, ctx, other.id, draft({groupId: null, title: 'Still fine', split: {mode: 'equal', participants: ['me', bob.id]}}))
  await deleteExpense(s, ctx, e.id)
  // Payments, write-offs and exits still close the money.
  await createRepayment(s, ctx, {groupId: g.id, currency: 'EUR', from: bob.id, to: 'me', amount: 100n, date: '2026-10-28', tz: 'UTC', note: ''})
  await createWriteOffs(s, ctx, [{groupId: g.id, currency: 'EUR', from: bob.id, to: 'me', amount: 50n, date: '2026-10-28', tz: 'UTC', note: ''}])
  await makeGroupActive(s, ctx, g.id)
  await restoreExpense(s, ctx, inGroup.id)
  await createExpense(s, ctx, draft())
})

test('making an inactive group inactive again writes nothing', async () => {
  const {g} = await flat()
  await makeGroupInactive(s, ctx, g.id)
  const v = (await s.get('group', g.id))!.version
  await makeGroupInactive(s, ctx, g.id)
  expect((await s.get('group', g.id))!.version).toBe(v)
})

/* -------------------------- F-615 leave, F-613 remove ----------------------- */

test('creating a group makes its creator the admin', async () => {
  const {g} = await flat()
  expect(groupAdmins((await s.get<Group>('group', g.id))!.data)).toEqual(['me'])
  expect((await s.members({groupId: g.id})).find(m => m.personId === 'me')!.role).toBe('admin')
})

test('leaving with a balance and no choice made is not silent: keep records "kept" and the balance stays', async () => {
  const {g, bob} = await flat()
  const left = await removeGroupMember(s, ctx, {groupId: g.id, personId: bob.id, choice: 'keep', ...exit})
  const m = left.data.members.find(x => x.personId === bob.id)!
  expect(m.leftAt).not.toBeNull()
  expect(m.exit).toBe('kept')
  expect(await net(g.id, bob.id)).toEqual([['EUR', -1000n]])
  // The choice is in history.
  const history = await s.history('group', g.id)
  expect((history.at(-1)!.data as Group).members.find(x => x.personId === bob.id)!.exit).toBe('kept')
  const event = (await loadActivity(s)).find(x => x.kind === 'group.memberLeft')!
  expect(event.entityType).toBe('group')
})

test('settle records the payments that clear the member, in the same transaction as the exit', async () => {
  const {g, bob} = await flat()
  const preview = await previewMemberExit(s, g.id, bob.id)
  expect(preview.owed).toEqual({EUR: -1000n})
  expect(preview.transfers).toEqual([{currency: 'EUR', from: bob.id, to: 'me', amount: 1000n}])
  expect(preview.changes).toEqual([
    {currency: 'EUR', personId: bob.id, before: -1000n, after: 0n},
    {currency: 'EUR', personId: 'me', before: 2000n, after: 1000n},
  ])
  const left = await removeGroupMember(s, ctx, {groupId: g.id, personId: bob.id, choice: 'settle', ...exit})
  expect(left.data.members.find(x => x.personId === bob.id)!.exit).toBe('settled')
  expect(await net(g.id, bob.id)).toEqual([])
  expect(await net(g.id, 'me')).toEqual([['EUR', 1000n]])
  expect((await s.count('repayment', {index: 'byGroup', eq: [g.id]}))).toBe(1)
  await expectProjectionsMatchLedger(s)
})

test('forgive records write-offs, not payments, with the same balance effect', async () => {
  const {g, bob} = await flat()
  await removeGroupMember(s, ctx, {groupId: g.id, personId: bob.id, choice: 'forgive', ...exit})
  expect(await s.count('writeoff', {index: 'byGroup', eq: [g.id]})).toBe(1)
  expect(await s.count('repayment', {index: 'byGroup', eq: [g.id]})).toBe(0)
  expect(await net(g.id, bob.id)).toEqual([])
  expect((await s.get<Group>('group', g.id))!.data.members.find(x => x.personId === bob.id)!.exit).toBe('forgiven')
})

test('a member with a balance in two currencies is cleared per currency, never summed', async () => {
  const {g, bob, draft} = await flat()
  await createExpense(s, ctx, draft({currency: 'INR', total: 600n, payers: {[bob.id]: 600n}, split: {mode: 'equal', participants: ['me', bob.id]}}))
  const preview = await previewMemberExit(s, g.id, bob.id)
  expect(Object.keys(preview.owed).sort()).toEqual(['EUR', 'INR'])
  await removeGroupMember(s, ctx, {groupId: g.id, personId: bob.id, choice: 'settle', ...exit})
  expect(await net(g.id, bob.id)).toEqual([])
})

test('a member who owes nothing leaves with exit "none" and nothing is recorded', async () => {
  const {g, cara, e} = await flat()
  await deleteExpense(s, ctx, e.id)
  const left = await removeGroupMember(s, ctx, {groupId: g.id, personId: cara.id, choice: 'settle', ...exit})
  expect(left.data.members.find(x => x.personId === cara.id)!.exit).toBe('none')
  expect(await s.count('repayment', {index: 'byGroup', eq: [g.id]})).toBe(0)
})

test('a failed exit writes nothing: payments and the exit are one transaction', async () => {
  const {g, bob} = await flat()
  const before = (await s.dump()).history.length
  expect(await codeOf(removeGroupMember(s, ctx, {groupId: g.id, personId: bob.id, choice: 'settle', date: 'not-a-date', tz: 'UTC'}))).toBeDefined()
  expect((await s.dump()).history.length).toBe(before)
  // And one that fails inside the transaction: a stranger.
  const dan = await createPerson(s, ctx, {name: 'Dan'})
  const after = (await s.dump()).history.length
  expect(await codeOf(removeGroupMember(s, ctx, {groupId: g.id, personId: dan.id, choice: 'keep', ...exit}))).toBe('NOT_A_MEMBER')
  expect((await s.dump()).history.length).toBe(after)
})

test('the last admin cannot leave until admin is handed on', async () => {
  const {g, bob} = await flat()
  expect(await codeOf(leaveGroup(s, ctx, {groupId: g.id, choice: 'keep', ...exit}))).toBe('LAST_ADMIN')
  expect(await codeOf(leaveGroup(s, ctx, {groupId: g.id, choice: 'keep', handAdminTo: 'nobody', ...exit}))).toBe('LAST_ADMIN')
  const left = await leaveGroup(s, ctx, {groupId: g.id, choice: 'keep', handAdminTo: bob.id, ...exit})
  expect(groupAdmins(left.data)).toEqual([bob.id])
  expect((await s.members({groupId: g.id})).find(m => m.personId === bob.id)!.role).toBe('admin')
  // The leaver is no longer an admin, and cannot take part in new expenses.
  expect(left.data.members.find(m => m.personId === 'me')!.leftAt).not.toBeNull()
})

test('another admin makes the hand-over unnecessary', async () => {
  const {g, bob} = await flat()
  await leaveGroup(s, ctx, {groupId: g.id, choice: 'keep', handAdminTo: bob.id, ...exit})
  // Bob is admin now; he can take Cara out without handing over anything.
  const members = (await s.get<Group>('group', g.id))!.data.members
  expect(members.filter(m => m.role === 'admin').map(m => m.personId)).toEqual([bob.id])
})

test('a group made before roles existed treats its first member as the admin', async () => {
  const {g, bob} = await flat()
  await s.transaction(async tx => {
    const row = (await tx.get<Group>('group', g.id))!
    const members = row.data.members.map(({role: _r, ...m}) => m)
    await tx.put({...row, data: {...row.data, members}, version: row.version + 1, updatedAt: ++clock})
  })
  expect(groupAdmins((await s.get<Group>('group', g.id))!.data)).toEqual(['me'])
  expect(await codeOf(leaveGroup(s, ctx, {groupId: g.id, choice: 'keep', ...exit}))).toBe('LAST_ADMIN')
  await leaveGroup(s, ctx, {groupId: g.id, choice: 'keep', handAdminTo: bob.id, ...exit})
})

test('a former member cannot be on new expenses, but can be added back', async () => {
  const {g, bob, draft} = await flat()
  await removeGroupMember(s, ctx, {groupId: g.id, personId: bob.id, choice: 'keep', ...exit})
  expect(await codeOf(createExpense(s, ctx, draft()))).toBe('NOT_A_MEMBER')
  const back = (await addGroupMembers(s, ctx, g.id, [bob.id])).group
  const m = back.data.members.find(x => x.personId === bob.id)!
  expect(m.leftAt).toBeNull()
  expect(m.exit).toBeUndefined()
})

test('a person who left a group can still be settled with outside it', async () => {
  const { g, bob } = await flat()
  await removeGroupMember(s, ctx, {groupId: g.id, personId: bob.id, choice: 'keep', ...exit})
  await createRepayment(s, ctx, {groupId: g.id, currency: 'EUR', from: bob.id, to: 'me', amount: 1000n, date: '2026-10-28', tz: 'UTC', note: ''})
  expect(await net(g.id, bob.id)).toEqual([])
})

/* -------------------------------- delete group ------------------------------- */

test('delete lists what goes, tombstones everything in one transaction, and restore brings back exactly those', async () => {
  const {g, bob, e, draft} = await flat()
  const second = await createExpense(s, ctx, draft({title: 'Wi-Fi', total: 600n, payers: {me: 600n}}))
  await createRepayment(s, ctx, {groupId: g.id, currency: 'EUR', from: bob.id, to: 'me', amount: 100n, date: '2026-10-27', tz: 'UTC', note: ''})
  await createWriteOffs(s, ctx, [{groupId: g.id, currency: 'EUR', from: bob.id, to: 'me', amount: 50n, date: '2026-10-27', tz: 'UTC', note: ''}])
  // A record deleted earlier stays deleted on its own and is not brought back with the group.
  await deleteExpense(s, ctx, second.id)
  expect(await groupContents(s, g.id)).toEqual({expenses: 1, repayments: 1, writeoffs: 1})

  const removed = await deleteGroup(s, ctx, g.id)
  expect(removed).toEqual({expenses: 1, repayments: 1, writeoffs: 1})
  expect((await s.get('group', g.id))!.deleted).toBe(true)
  expect((await s.get('expense', e.id))!.deleted).toBe(true)
  expect(await s.balances({groupId: g.id})).toEqual([])
  expect(await groupContents(s, g.id)).toEqual({expenses: 0, repayments: 0, writeoffs: 0})
  await expectProjectionsMatchLedger(s)

  // The group's tombstone says what went with it.
  expect((await s.get<Group>('group', g.id))!.data.removed).toEqual({expenses: 1, repayments: 1, writeoffs: 1})

  await restoreGroup(s, ctx, g.id)
  expect((await s.get('group', g.id))!.deleted).toBe(false)
  expect((await s.get<Group>('group', g.id))!.data.removed).toBeUndefined()
  expect((await s.get('expense', e.id))!.deleted).toBe(false)
  expect((await s.get('expense', second.id))!.deleted).toBe(true)
  expect(await groupContents(s, g.id)).toEqual({expenses: 1, repayments: 1, writeoffs: 1})
  // The balances are what they were before the delete.
  expect(await net(g.id, bob.id)).toEqual([['EUR', -1000n + 100n + 50n]])
  expect((await s.page('group', {index: 'byArchived', eq: [0]})).items.map(x => x.id)).toEqual([g.id])
  expect((await s.members({groupId: g.id})).length).toBe(3)
  await expectProjectionsMatchLedger(s)
  await expectDerivedTablesMatch(s)
})

test('records a group delete took stay out of Activity; the group has its own delete and restore events', async () => {
  const { g } = await flat()
  await deleteGroup(s, ctx, g.id)
  await restoreGroup(s, ctx, g.id)
  const kinds = (await loadActivity(s)).map(x => x.kind)
  expect(kinds).toEqual(['group.restored', 'group.deleted', 'expense.created', 'group.created', 'person.added', 'person.added'])
  expect(activityFromHistory((await s.dump()).history).length).toBe(kinds.length)
})

test('deleted-with-group outbox ops carry the mark so another device restores the same set', async () => {
  const { g, e } = await flat()
  await deleteGroup(s, ctx, g.id)
  const op = (await s.outbox()).find(o => o.entityId === e.id && o.opType === 'expense.delete')!
  expect(op.payload).toEqual({deleted: true, deletedWithGroup: g.id})
})

test('a friend in a deleted group can be deleted; restoring the group then waits for the friend', async () => {
  const { g, bob } = await flat()
  await deleteGroup(s, ctx, g.id)
  await deletePerson(s, ctx, bob.id)
  expect((await s.get('person', bob.id))!.deleted).toBe(true)
  expect(await codeOf(restoreGroup(s, ctx, g.id))).toBe('UNKNOWN_PERSON')
  await restorePerson(s, ctx, bob.id)
  await restoreGroup(s, ctx, g.id)
  expect((await s.get('group', g.id))!.deleted).toBe(false)
})

test('restoring a group whose member has gone for good is refused whole', async () => {
  const { g, bob } = await flat()
  await deleteGroup(s, ctx, g.id)
  await s.transaction(async tx => {
    const p = (await tx.get('person', bob.id))!
    await tx.put({...p, deleted: true, version: p.version + 1, updatedAt: ++clock})
  })
  expect(await codeOf(restoreGroup(s, ctx, g.id))).toBe('UNKNOWN_PERSON')
  expect((await s.get('group', g.id))!.deleted).toBe(true)
  expect((await s.get('expense', (await s.page('expense', {index: 'byDeleted', eq: [1]})).items[0]!.id))!.deleted).toBe(true)
})

test('a group that is not deleted cannot be restored, and a deleted one cannot be deleted again', async () => {
  const { g } = await flat()
  expect(await codeOf(restoreGroup(s, ctx, g.id))).toBe('NOT_FOUND')
  await deleteGroup(s, ctx, g.id)
  expect(await codeOf(deleteGroup(s, ctx, g.id))).toBe('NOT_FOUND')
})

test('the old archived flag reads as inactive: it blocks expenses, shows in Activity as inactive, and Make active clears it (adapter)', async () => {
  const {g, bob, draft} = await flat()
  await s.transaction(async tx => {
    const row = (await tx.get<Group>('group', g.id))!
    const data = {...row.data, archived: true}
    await tx.put({...row, data, version: row.version + 1, updatedAt: ++clock})
    await tx.appendHistory({entityType: 'group', entityId: g.id, version: row.version + 1, data, deleted: false, at: clock, actor: 'me'})
  })
  const legacy = (await s.get<Group>('group', g.id))!.data
  expect(legacy.inactive).toBeUndefined()
  expect(isGroupInactive(legacy)).toBe(true)
  expect(await codeOf(createExpense(s, ctx, draft()))).toBe('GROUP_INACTIVE')
  expect((await loadActivity(s)).find(x => x.entityType === 'group')!.kind).toBe('group.inactive')
  // Settling still works.
  await createRepayment(s, ctx, {groupId: g.id, currency: 'EUR', from: bob.id, to: 'me', amount: 100n, date: '2026-10-28', tz: 'UTC', note: ''})
  const active = await makeGroupActive(s, ctx, g.id)
  expect(active.data.archived).toBe(false)
  expect(isGroupInactive(active.data)).toBe(false)
  await createExpense(s, ctx, draft())
})

test('hide and show write only the account preference: the group, its history and its outbox are untouched', async () => {
  const {g} = await flat()
  const before = {row: await s.get('group', g.id), ops: (await s.outbox()).length}
  await setGroupHidden(s, ctx, g.id, true)
  expect(await getPref(s, 'groups.hidden')).toEqual([g.id])
  expect(await s.get('group', g.id)).toEqual(before.row)
  expect((await s.history('group', g.id)).length).toBe(before.row!.version)
  const ops = (await s.outbox()).slice(before.ops)
  expect(ops.map(o => [o.entityType, o.opType])).toEqual([['preference', 'preference.set']])
  // Hiding twice, or showing what is not hidden, writes nothing.
  await setGroupHidden(s, ctx, g.id, true)
  expect((await s.outbox()).length).toBe(before.ops + 1)
  await setGroupHidden(s, ctx, g.id, false)
  expect(await getPref(s, 'groups.hidden')).toEqual([])
  // A hidden group still takes expenses if it is active.
  await setGroupHidden(s, ctx, g.id, true)
  const { draft } = await (async () => ({draft: (over: Partial<ExpenseDraft>) => ({title: 'x', groupId: g.id, currency: 'EUR', total: 100n, payers: {me: 100n}, split: {mode: 'equal' as const, participants: ['me']}, date: '2026-10-28', tz: 'UTC', category: 'x', notes: '', ...over})}))()
  await createExpense(s, ctx, draft({}))
})

/* ------------------- review fixes: roles, admin-only actions, move-out ------------------- */

test('adding a member to a group made before roles existed keeps the creator admin, and leaving still needs a handover', async () => {
  const {g, bob} = await flat()
  await s.transaction(async tx => {
    const row = (await tx.get<Group>('group', g.id))!
    const members = row.data.members.map(({role: _r, ...m}) => m)
    await tx.put({...row, data: {...row.data, members}, version: row.version + 1, updatedAt: ++clock})
  })
  const dan = await createPerson(s, ctx, {name: 'Dan'})
  const added = (await addGroupMembers(s, ctx, g.id, [dan.id])).group
  expect(groupAdmins(added.data)).toEqual(['me'])
  expect(added.data.members.find(m => m.personId === dan.id)!.role).toBe('member')
  expect(await codeOf(leaveGroup(s, ctx, {groupId: g.id, choice: 'keep', ...exit}))).toBe('LAST_ADMIN')
  await leaveGroup(s, ctx, {groupId: g.id, choice: 'keep', handAdminTo: bob.id, ...exit})
})

/** The same group seen by Bob, who is a member but not an admin. */
const asBob = (bobId: string): MutationCtx => ({...ctx, actor: bobId})

test('only an admin may restore a deleted group (NOT_ADMIN); a deleted group stays readable and its records stay deleted until then', async () => {
  const {g, bob, e} = await flat()
  await deleteGroup(s, ctx, g.id)
  expect(await codeOf(restoreGroup(s, asBob(bob.id), g.id))).toBe('NOT_ADMIN')
  expect((await s.get('group', g.id))!.deleted).toBe(true)
  expect((await s.get('expense', e.id))!.deleted).toBe(true)
  await restoreGroup(s, ctx, g.id)
  expect((await s.get('group', g.id))!.deleted).toBe(false)
})

test('only an admin may remove another member or delete the group (NOT_ADMIN); any member may leave, hide and change the state', async () => {
  const {g, bob, cara} = await flat()
  const b = asBob(bob.id)
  expect(await codeOf(removeGroupMember(s, b, {groupId: g.id, personId: cara.id, choice: 'keep', ...exit}))).toBe('NOT_ADMIN')
  expect(await codeOf(deleteGroup(s, b, g.id))).toBe('NOT_ADMIN')
  expect((await s.get('group', g.id))!.deleted).toBe(false)
  expect((await s.get<Group>('group', g.id))!.data.members.find(m => m.personId === cara.id)!.leftAt).toBeNull()
  // Any member may make it inactive and active, and may leave.
  await makeGroupInactive(s, b, g.id)
  await makeGroupActive(s, b, g.id)
  await leaveGroup(s, b, {groupId: g.id, choice: 'keep', ...exit})
  // The admin may do both.
  await removeGroupMember(s, ctx, {groupId: g.id, personId: cara.id, choice: 'keep', ...exit})
  await deleteGroup(s, ctx, g.id)
})

test('a member who has left is no admin: they cannot remove anyone either', async () => {
  const {g, bob, cara} = await flat()
  await leaveGroup(s, ctx, {groupId: g.id, choice: 'keep', handAdminTo: bob.id, ...exit})
  expect(await codeOf(removeGroupMember(s, ctx, {groupId: g.id, personId: cara.id, choice: 'keep', ...exit}))).toBe('NOT_ADMIN')
  expect(await codeOf(deleteGroup(s, ctx, g.id))).toBe('NOT_ADMIN')
})

test('Make inactive writes the legacy archived flag too, so the byArchived index means inactive', async () => {
  const {g} = await flat()
  await makeGroupInactive(s, ctx, g.id)
  expect((await s.page('group', {index: 'byArchived', eq: [1]})).items.map(x => x.id)).toEqual([g.id])
  await makeGroupActive(s, ctx, g.id)
  expect((await s.page('group', {index: 'byArchived', eq: [1]})).items).toEqual([])
})
