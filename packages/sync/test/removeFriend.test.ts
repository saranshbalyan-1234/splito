import {beforeEach, expect, test} from 'bun:test'
import {DomainError} from '@splito/domain'

import {
  acceptFriendRequest,
  applyFriendRequestAccepted,
  friendOpenBalances,
  isRemovedFriend,
  receiveFriendRequest,
  removeFriend,
  restoreFriend,
  selectablePeople,
  sendFriendRequest,
} from '../src/friends'
import {createExpense, createGroup, createPerson, createRepayment, createWriteOffs, ensureMe, type Person} from '../src/mutations'
import {openSqlStore} from '../src/sqlStore'
import {type Store} from '../src/store'
import {type MutationCtx} from '../src/types'
import {bunExecutor} from './bunExecutor'

let s: Store
let ctx: MutationCtx
let n = 0
beforeEach(async () => {
  s = await openSqlStore(bunExecutor(':memory:'))
  ctx = {deviceId: 'dev1', actor: 'me', now: () => 1_000_000 + n, newId: () => 'id' + ++n}
  await ensureMe(s, ctx, 'Me')
})

const code = (e: unknown) => (e instanceof DomainError ? e.code : String(e))
const dinner = (friend: string, over: Record<string, unknown> = {}) => ({
  title: 'Dinner',
  groupId: null as string | null,
  currency: 'INR',
  total: 1000n,
  payers: {me: 1000n},
  split: {mode: 'equal' as const, participants: ['me', friend]},
  date: '2026-10-26',
  tz: 'Asia/Kolkata',
  category: 'food',
  notes: '',
  ...over,
})
const repay = (from: string, to: string, amount: bigint, currency = 'INR') => ({groupId: null, currency, from, to, amount, date: '2026-10-27', tz: 'Asia/Kolkata', note: ''})

test('a friend with nothing open is removed softly: history stays, name stays, flagged removed', async () => {
  const f = await createPerson(s, ctx, {name: 'Asha'})
  await createExpense(s, ctx, dinner(f.id))
  await createRepayment(s, ctx, repay(f.id, 'me', 500n))
  const out = await removeFriend(s, ctx, f.id)
  expect(out.deleted).toBe(false)
  expect(out.data).toMatchObject({name: 'Asha', removedAt: expect.any(Number)})
  expect(isRemovedFriend(out.data)).toBe(true)
  // The expense, the payment and the person row all survive.
  expect((await s.getAll('expense')).filter(e => !e.deleted).length).toBe(1)
  expect((await s.getAll('repayment')).filter(e => !e.deleted).length).toBe(1)
  expect((await s.history('person', f.id)).map(h => h.version)).toEqual([1, 2])
  expect((await s.outbox()).filter(o => o.entityId === f.id).map(o => o.opType)).toEqual(['person.create', 'person.remove'])
})

test('an open balance in any currency blocks the removal and says how much', async () => {
  const f = await createPerson(s, ctx, {name: 'Asha'})
  await createExpense(s, ctx, dinner(f.id)) // Asha owes 500 INR
  await createExpense(s, ctx, dinner(f.id, {currency: 'AED', total: 200n, payers: {[f.id]: 200n}})) // I owe 100 AED
  expect(await removeFriend(s, ctx, f.id).catch(code)).toBe('BALANCE_OPEN')
  expect(isRemovedFriend((await s.get<Person>('person', f.id))!.data)).toBe(false)
  const open = await friendOpenBalances(s, 'me', f.id)
  expect(Object.keys(open).sort()).toEqual(['AED', 'INR'])
  expect(open.INR!.total).toBe(500n)
  expect(open.AED!.total).toBe(-100n)
  // Settling one currency is not enough.
  await createRepayment(s, ctx, repay(f.id, 'me', 500n))
  expect(await removeFriend(s, ctx, f.id).catch(code)).toBe('BALANCE_OPEN')
  await createWriteOffs(s, ctx, [repay('me', f.id, 100n, 'AED')])
  expect(Object.keys(await friendOpenBalances(s, 'me', f.id))).toEqual([])
  await removeFriend(s, ctx, f.id)
})

test('a balance inside a group blocks too', async () => {
  const f = await createPerson(s, ctx, {name: 'Asha'})
  const g = await createGroup(s, ctx, {name: 'Trip', kind: 'trip', currency: 'INR', startDate: null, endDate: null, memberIds: [f.id]})
  await createExpense(s, ctx, dinner(f.id, {groupId: g.id}))
  expect(Object.keys(await friendOpenBalances(s, 'me', f.id))).toEqual(['INR'])
  expect(await removeFriend(s, ctx, f.id).catch(code)).toBe('BALANCE_OPEN')
})

test('a removed friend leaves pickers and lists, and can be added back', async () => {
  const f = await createPerson(s, ctx, {name: 'Asha'})
  const keep = await createPerson(s, ctx, {name: 'Ben'})
  await removeFriend(s, ctx, f.id)
  const pick = selectablePeople(await s.getAll<Person>('person'), [], 0)
  expect(pick.selectable.map(p => p.id)).toEqual([keep.id])
  const back = await restoreFriend(s, ctx, f.id)
  expect(isRemovedFriend(back.data)).toBe(false)
  expect(back.data.name).toBe('Asha')
  expect(selectablePeople(await s.getAll<Person>('person'), [], 0).selectable.length).toBe(2)
  expect(await restoreFriend(s, ctx, f.id).catch(code)).toBe('NOT_REMOVED')
  expect(await removeFriend(s, ctx, 'me').catch(code)).not.toBe('')
})

test('you cannot remove yourself, a missing person, or someone twice', async () => {
  const f = await createPerson(s, ctx, {name: 'Asha'})
  expect(await removeFriend(s, ctx, 'me').catch(code)).toBe('PERSON_IN_USE')
  expect(await removeFriend(s, ctx, 'nobody').catch(code)).toBe('NOT_FOUND')
  await removeFriend(s, ctx, f.id)
  expect(await removeFriend(s, ctx, f.id).catch(code)).toBe('ALREADY_REMOVED')
})

test('a removed friend who accepts a new request comes back, not a duplicate', async () => {
  const email = {kind: 'email' as const, value: 'asha@example.com'}
  const r = await sendFriendRequest(s, ctx, {contact: email, name: 'Asha', reach: 'on-splito'})
  const {person} = await applyFriendRequestAccepted(s, {...ctx, actor: 'acc-a'}, r.id, {accountId: 'acc-a', name: 'Asha'})
  await removeFriend(s, ctx, person.id)
  // Not "already friends" any more: a new request is allowed.
  const again = await sendFriendRequest(s, ctx, {contact: email, name: 'Asha', reach: 'on-splito'})
  const back = await applyFriendRequestAccepted(s, {...ctx, actor: 'acc-a'}, again.id, {accountId: 'acc-a', name: 'Asha'})
  expect(back.person.id).toBe(person.id)
  expect(isRemovedFriend(back.person.data)).toBe(false)
  expect((await s.getAll<Person>('person')).length).toBe(2)
  // Same through an incoming request I accept.
  await removeFriend(s, ctx, person.id)
  await receiveFriendRequest(s, {...ctx, actor: 'acc-a'}, {id: 'req1', accountId: 'acc-a', name: 'Asha', contact: email})
  const acc = await acceptFriendRequest(s, ctx, 'req1')
  expect(isRemovedFriend(acc.person.data)).toBe(false)
})
