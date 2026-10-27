import 'fake-indexeddb/auto'

import {expect, test} from 'bun:test'
import {
  createExpense,
  createGroup,
  createPerson,
  createRepayment,
  createWriteOffs,
  type Entity,
  ensureMe,
  friendOpenBalances,
  type MutationCtx,
  openIdbStore,
  type Person,
  type Store,
} from '@splito/sync'
import {IDBFactory} from 'fake-indexeddb'

import {loadStatement} from './exportLedger'

let n = 0
const ctx: MutationCtx = {deviceId: 'd', actor: 'me', now: () => 1000 + ++n, newId: () => `id${++n}`}

const base = {tz: 'Asia/Kolkata', category: 'food', notes: ''}

async function seed(): Promise<{store: Store; asha: Entity<Person>; ben: Entity<Person>; trip: string}> {
  const store = await openIdbStore(`x${++n}`, new IDBFactory())
  await ensureMe(store, ctx, 'Me')
  const asha = await createPerson(store, ctx, {name: 'Asha'})
  const ben = await createPerson(store, ctx, {name: 'Ben'})
  const trip = (await createGroup(store, ctx, {name: 'Goa', kind: 'trip', currency: 'INR', startDate: null, endDate: null, memberIds: [asha.id, ben.id]})).id
  // Direct: Asha owes me 500 INR; I owe Asha 100 AED.
  await createExpense(store, ctx, {...base, title: 'Lunch', groupId: null, currency: 'INR', total: 1000n, payers: {me: 1000n}, split: {mode: 'equal', participants: ['me', asha.id]}, date: '2026-09-02'})
  await createExpense(store, ctx, {...base, title: 'Taxi', groupId: null, currency: 'AED', total: 200n, payers: {[asha.id]: 200n}, split: {mode: 'equal', participants: ['me', asha.id]}, date: '2026-10-05'})
  // In the trip: Ben pays for all three.
  await createExpense(store, ctx, {...base, title: 'Villa', groupId: trip, currency: 'INR', total: 9000n, payers: {[ben.id]: 9000n}, split: {mode: 'equal', participants: ['me', asha.id, ben.id]}, date: '2026-10-10'})
  await createRepayment(store, ctx, {groupId: null, currency: 'INR', from: asha.id, to: 'me', amount: 100n, date: '2026-10-12', tz: 'Asia/Kolkata', note: 'upi'})
  await createWriteOffs(store, ctx, [{groupId: null, currency: 'INR', from: asha.id, to: 'me', amount: 50n, date: '2026-10-13', tz: 'Asia/Kolkata', note: ''}])
  return {store, asha, ben, trip}
}

test('a group statement ends at my net in that group, as the group screen shows it', async () => {
  const {store, trip} = await seed()
  const st = await loadStatement(store, 'me', {groupId: trip})
  expect(st.rows.map(r => r.title)).toEqual(['Villa'])
  const mine = (await store.balances({personId: 'me', groupId: trip})).find(b => b.currency === 'INR')!
  expect(st.closing.INR).toBe(mine.amount)
})

test('the full statement ends at my total net per currency, and each currency stays apart', async () => {
  const {store} = await seed()
  const st = await loadStatement(store, 'me', {})
  expect(st.currencies).toEqual(['AED', 'INR'])
  const net: Record<string, bigint> = {}
  for (const b of await store.balances({personId: 'me'})) net[b.currency] = (net[b.currency] ?? 0n) + b.amount
  expect(st.closing).toEqual(net)
})

test('a friend statement closes exactly on the balance the friend page shows', async () => {
  const {store, asha} = await seed()
  const st = await loadStatement(store, 'me', {personId: asha.id})
  const open = await friendOpenBalances(store, 'me', asha.id)
  expect(st.closing).toEqual(Object.fromEntries(Object.entries(open).map(([c, b]) => [c, b.total])))
  // The trip's Villa is paid by Ben: nothing between me and Asha, so its routing may need no adjustment here.
  expect(st.rows.map(r => r.title)).toContain('Lunch')
})

test('a date range keeps the balance before it as the opening balance', async () => {
  const {store} = await seed()
  const full = await loadStatement(store, 'me', {})
  const part = await loadStatement(store, 'me', {from: '2026-10-01', to: '2026-10-31'})
  expect(part.opening.INR).toBe(500n)
  expect(part.rows.map(r => r.title)).not.toContain('Lunch')
  expect(part.closing).toEqual(full.closing)
})
