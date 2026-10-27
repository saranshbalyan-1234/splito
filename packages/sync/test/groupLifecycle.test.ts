/* F-604 archive, F-615 leave and delete a group, F-613 part 1 remove a member. */
import {beforeEach, expect, test} from 'bun:test'
import {DomainError} from '@splito/domain'

import {activityFromHistory, loadActivity} from '../src/activity'
import {
  archiveGroup,
  deleteGroup,
  groupContents,
  leaveGroup,
  previewMemberExit,
  purgeDeletedGroup,
  removeGroupMember,
  restoreGroup,
  unarchiveGroup,
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
  ensureMe,
  type ExpenseDraft,
  type Group,
  groupAdmins,
} from '../src/mutations'
import {loadBin} from '../src/selectors'
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

/* ------------------------------- F-604 archive ------------------------------- */

test('archive hides a group by flag, keeps its balances, and unarchive brings it back', async () => {
  const {g, bob} = await flat()
  const before = await s.balances({groupId: g.id})
  const a = await archiveGroup(s, ctx, g.id)
  expect(a.data.archived).toBe(true)
  expect(await s.balances({groupId: g.id})).toEqual(before)
  expect((await s.get<Group>('group', g.id))!.data.archived).toBe(true)
  // The Archived index finds it.
  expect((await s.page('group', {index: 'byArchived', eq: [1]})).items.map(x => x.id)).toEqual([g.id])
  // Expenses can still be added to an archived group.
  await createExpense(s, ctx, {title: 'More', groupId: g.id, currency: 'EUR', total: 100n, payers: {me: 100n}, split: {mode: 'equal', participants: ['me', bob.id]}, date: '2026-10-27', tz: 'UTC', category: 'x', notes: ''})
  const u = await unarchiveGroup(s, ctx, g.id)
  expect(u.data.archived).toBe(false)
  expect((await s.page('group', {index: 'byArchived', eq: [1]})).items).toEqual([])
  const kinds = (await loadActivity(s)).filter(x => x.entityType === 'group').map(x => x.kind)
  expect(kinds).toEqual(['group.unarchived', 'group.archived', 'group.created'])
})

test('archiving an archived group writes nothing', async () => {
  const {g} = await flat()
  await archiveGroup(s, ctx, g.id)
  const v = (await s.get('group', g.id))!.version
  await archiveGroup(s, ctx, g.id)
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
  const back = await addGroupMembers(s, ctx, g.id, [bob.id])
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
  // A record deleted earlier stays its own bin entry and is not brought back with the group.
  await deleteExpense(s, ctx, second.id)
  expect(await groupContents(s, g.id)).toEqual({expenses: 1, repayments: 1, writeoffs: 1})

  const removed = await deleteGroup(s, ctx, g.id)
  expect(removed).toEqual({expenses: 1, repayments: 1, writeoffs: 1})
  expect((await s.get('group', g.id))!.deleted).toBe(true)
  expect((await s.get('expense', e.id))!.deleted).toBe(true)
  expect(await s.balances({groupId: g.id})).toEqual([])
  expect(await groupContents(s, g.id)).toEqual({expenses: 0, repayments: 0, writeoffs: 0})
  await expectProjectionsMatchLedger(s)

  // Recently deleted: the group is one entry, with the earlier delete as its own; the records it took are not listed.
  const bin = await loadBin(s, clock, 30)
  expect(bin.map(b => `${b.type}:${b.entity.id}`).sort()).toEqual([`expense:${second.id}`, `group:${g.id}`].sort())
  expect((bin.find(b => b.type === 'group')!.entity.data as Group).removed).toEqual({expenses: 1, repayments: 1, writeoffs: 1})

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

test('a person in a deleted group cannot be deleted until the group is purged', async () => {
  const { g, bob } = await flat()
  await deleteGroup(s, ctx, g.id)
  expect(await codeOf(deletePerson(s, ctx, bob.id))).toBe('PERSON_IN_USE')
  await purgeDeletedGroup(s, ctx, g.id)
  await deletePerson(s, ctx, bob.id)
})

test('delete forever takes the group and its records out of the bin for good, history kept', async () => {
  const { g, e } = await flat()
  await deleteGroup(s, ctx, g.id)
  await purgeDeletedGroup(s, ctx, g.id)
  expect(await loadBin(s, clock, 30)).toEqual([])
  expect(await codeOf(restoreGroup(s, ctx, g.id))).toBe('NOT_FOUND')
  expect((await s.history('expense', e.id)).length).toBeGreaterThan(1)
  expect(((await s.get('expense', e.id))!.data as {purgedAt?: number}).purgedAt).toBeGreaterThan(0)
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
