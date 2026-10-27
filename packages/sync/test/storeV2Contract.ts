import {describe, expect, test} from 'bun:test'

import {deleteGroup, makeGroupActive, makeGroupInactive, restoreGroup} from '../src/groupLifecycle'
import {setPref} from '../src/preferences'
import {loadBin} from '../src/selectors'
import {
  createExpense,
  createGroup,
  createPerson,
  createRepayment,
  createWriteOffs,
  deleteExpense,
  deleteRepayment,
  type ExpenseDraft,
  ensureMe,
  restoreExpense,
  updateExpense,
} from '../src/mutations'
import {type Key} from '../src/schema'
import {type Store, type StoreChange, touches} from '../src/store'
import {type Entity, type MutationCtx} from '../src/types'
import {expectProjectionsMatchLedger} from './projectionCheck'

export function makeCtx(): MutationCtx {
  let n = 0
  return {deviceId: 'dev1', actor: 'me', now: () => 1_700_000_000_000 + n * 1000, newId: () => `id${String(++n).padStart(6, '0')}`}
}

const draft = (over: Partial<ExpenseDraft> & {with: string[]}): ExpenseDraft => {
  const {with: people, ...rest} = over
  return {
    title: 'Dinner',
    groupId: null,
    currency: 'INR',
    total: 900n,
    payers: {me: 900n},
    split: {mode: 'equal', participants: ['me', ...people]},
    date: '2026-10-01',
    tz: 'Asia/Kolkata',
    category: 'food',
    notes: '',
    ...rest,
  }
}

/** The behaviour of the v2 schema (ARCHITECTURE 9.8) every engine must share: indexes, paging, projections, sync state. */
export function runV2Contract(name: string, open: () => Promise<Store>) {
  describe(`${name} schema v2`, () => {
    async function seeded() {
      const s = await open()
      const ctx = makeCtx()
      await ensureMe(s, ctx, 'Me')
      const a = await createPerson(s, ctx, {name: 'Asha'})
      const b = await createPerson(s, ctx, {name: 'Bilal'})
      const g = await createGroup(s, ctx, {name: 'Goa', kind: 'trip', currency: 'INR', memberIds: [a.id, b.id], startDate: null, endDate: null})
      return {s, ctx, a, b, g}
    }

    test('has one store per entity type, relation and projection of 9.8, each with a bySyncStatus count', async () => {
      const s = await open()
      const counts = await s.syncCounts()
      for (const store of [
        'people', 'groups', 'group_members', 'expenses', 'expense_parties', 'repayments', 'writeoffs',
        'comments', 'friend_requests', 'invite_links', 'feedback', 'preferences',
      ] as const)
        expect(counts[store]).toEqual({local: 0, pending: 0, syncing: 0, synced: 0, failed: 0})
      await s.close()
    })

    test('index pages are exact, ordered and cursor-continuous in both directions', async () => {
      const { s, ctx, a, g } = await seeded()
      const dates = ['2026-10-03', '2026-10-01', '2026-10-03', '2026-10-02', '2026-10-03', '2026-09-30', '2026-10-01']
      const ids: string[] = []
      for (const date of dates) ids.push((await createExpense(s, ctx, draft({with: [a.id], groupId: g.id, date}))).id)
      await createExpense(s, ctx, draft({with: [a.id], date: '2026-10-02'})) // outside the group

      const newestFirst: string[] = []
      let after: Key | null = null
      let pages = 0
      do {
        const page: Awaited<ReturnType<Store['page']>> = await s.page('expense', {index: 'byGroupDate', eq: [g.id], dir: 'prev', limit: 3, after})
        newestFirst.push(...page.items.map(e => e.id))
        after = page.next
        pages++
      } while (after)
      const expected = ids
        .map((id, i) => ({id, date: dates[i]!}))
        .sort((x, y) => (x.date === y.date ? (x.id < y.id ? 1 : -1) : x.date < y.date ? 1 : -1))
        .map(x => x.id)
      expect(newestFirst).toEqual(expected)
      expect(pages).toBe(3)

      const oldestFirst = (await s.page('expense', {index: 'byGroupDate', eq: [g.id], limit: 100})).items.map(e => e.id)
      expect(oldestFirst).toEqual([...expected].reverse())

      const october2 = await s.page('expense', {index: 'byGroupDate', eq: [g.id], min: '2026-10-02', max: '2026-10-02', limit: 100})
      expect(october2.items.map(e => e.data)).toHaveLength(1)
      expect(october2.next).toBeNull()
      // `byDate` spans groups.
      expect((await s.page('expense', {index: 'byDate', min: '2026-10-02', max: '2026-10-02', limit: 100})).items).toHaveLength(2)
      await s.close()
    })

    test('an unknown index name is an error on every engine', async () => {
      const s = await open()
      await expect(s.page('expense', {index: 'byNothing'})).rejects.toThrow()
      await s.close()
    })

    test('group members and expense parties follow every write, in the same transaction', async () => {
      const { s, ctx, a, b, g } = await seeded()
      expect((await s.members({groupId: g.id})).map(m => m.personId).sort()).toEqual(['me', a.id, b.id].sort())
      expect((await s.members({personId: a.id})).map(m => m.groupId)).toEqual([g.id])

      const e = await createExpense(s, ctx, draft({with: [a.id], groupId: g.id}))
      const parties = await s.parties({index: 'byPersonDate', eq: [a.id]})
      expect(parties.items).toMatchObject([{expenseId: e.id, personId: a.id, paid: 0n, share: 450n, groupId: g.id, currency: 'INR', date: '2026-10-01'}])
      const mine = await s.parties({index: 'byGroupPerson', eq: [g.id, 'me']})
      expect(mine.items).toMatchObject([{paid: 900n, share: 450n}])

      // Edit: a leaves the split, b joins.
      await updateExpense(s, ctx, e.id, draft({with: [b.id], groupId: g.id}))
      expect((await s.parties({index: 'byPersonDate', eq: [a.id]})).items).toEqual([])
      expect((await s.parties({index: 'byPersonDate', eq: [b.id]})).items).toHaveLength(1)

      // Delete and restore.
      await deleteExpense(s, ctx, e.id)
      expect((await s.parties({index: 'byPersonDate', eq: [b.id]})).items).toEqual([])
      expect(await s.balances({groupId: g.id})).toEqual([])
      await restoreExpense(s, ctx, e.id)
      expect((await s.parties({index: 'byPersonDate', eq: [b.id]})).items).toHaveLength(1)
      await expectProjectionsMatchLedger(s)
      await s.close()
    })

    test('balances are net per person, group and currency; pairs mirror outside groups', async () => {
      const { s, ctx, a, g } = await seeded()
      await createExpense(s, ctx, draft({with: [a.id], groupId: g.id}))
      await createExpense(s, ctx, draft({with: [a.id], total: 5000n, currency: 'JPY', payers: {[a.id]: 5000n}}))
      await createRepayment(s, ctx, {groupId: null, currency: 'JPY', from: 'me', to: a.id, amount: 1000n, date: '2026-10-02', tz: 'Asia/Tokyo', note: ''})
      const mineInGroup = await s.balances({personId: 'me', groupId: g.id})
      expect(mineInGroup).toMatchObject([{amount: 450n, currency: 'INR', groupId: g.id}])
      const direct = await s.balances({personId: 'me', groupId: null})
      expect(direct).toMatchObject([{amount: -1500n, currency: 'JPY', groupId: null}])
      // I owed Asha 2500, paid her 1000: I owe 1500.
      expect(await s.pairBalances('me')).toMatchObject([{otherId: a.id, currency: 'JPY', amount: -1500n}])
      expect(await s.pairBalances(a.id)).toMatchObject([{otherId: 'me', currency: 'JPY', amount: 1500n}])
      await s.close()
    })

    test('a write-off moves balances like a payment: the pair settles to nothing', async () => {
      const { s, ctx, a } = await seeded()
      await createExpense(s, ctx, draft({with: [a.id]}))
      await createWriteOffs(s, ctx, [{groupId: null, currency: 'INR', from: a.id, to: 'me', amount: 450n, date: '2026-10-02', tz: 'Asia/Kolkata', note: ''}])
      expect(await s.pairBalances('me')).toEqual([])
      // The net row stays (a record still names the person) but is zero.
      expect((await s.balances({personId: 'me'})).map(b => b.amount)).toEqual([0n])
      await s.close()
    })

    test('a row is pending from the transaction that queues its op, and a rolled-back write leaves no trace', async () => {
      const { s, ctx, a } = await seeded()
      const before = await s.syncCounts()
      await expect(
        s.transaction(async tx => {
          await tx.put({type: 'person', id: 'ghost', data: {name: 'G', isMe: false}, version: 1, deleted: false, updatedAt: 5})
          await tx.enqueue({
            opId: 'ghost-op', deviceId: 'd', actor: 'me', entityType: 'person', entityId: 'ghost', opType: 'person.create', baseVersion: 0,
            payload: {}, schemaVersion: 1, deps: [], attempts: 0, nextAttemptAt: null, lastError: null,
          })
          throw new Error('boom')
        }),
      ).rejects.toThrow('boom')
      expect(await s.syncCounts()).toEqual(before)
      expect(await s.get('person', 'ghost')).toBeUndefined()

      const e = await createExpense(s, ctx, draft({with: [a.id]}))
      expect(e.syncStatus).toBe('pending')
      expect((await s.get('expense', e.id))?.syncStatus).toBe('pending')
      expect((await s.parties({index: 'byPersonDate', eq: [a.id]})).items[0]!.syncStatus).toBe('pending')
      expect((await s.syncCounts()).expenses!.pending).toBe(1)
      await s.close()
    })

    test('setOpStatus moves the op and its row forward, only on real answers', async () => {
      const { s, ctx, a } = await seeded()
      const e = await createExpense(s, ctx, draft({with: [a.id]}))
      const op1 = (await s.outbox()).find(o => o.entityId === e.id)!
      expect(op1.status).toBe('queued')

      const seen: StoreChange[] = []
      s.subscribe(c => seen.push(c))
      await s.setOpStatus(op1.opId, 'sending')
      // Readers of the row hear about its new state like any other write to it.
      expect(touches(seen.at(-1)!, 'expense', e.id)).toBe(true)
      expect((await s.get('expense', e.id))?.syncStatus).toBe('syncing')
      expect((await s.outbox()).find(o => o.opId === op1.opId)).toMatchObject({status: 'sending', attempts: 1})

      await s.setOpStatus(op1.opId, 'failed', {error: 'Refused'})
      expect(await s.get('expense', e.id)).toMatchObject({syncStatus: 'failed', syncError: 'Refused'})
      expect((await s.syncCounts()).expenses!.failed).toBe(1)

      await s.setOpStatus(op1.opId, 'queued')
      await s.setOpStatus(op1.opId, 'sending')
      await s.setOpStatus(op1.opId, 'acked', {serverVersion: 7, at: 99})
      expect(await s.get('expense', e.id)).toMatchObject({syncStatus: 'synced', serverVersion: 7, syncedAt: 99, syncError: null})
      expect((await s.parties({index: 'byPersonDate', eq: [a.id]})).items[0]!.syncStatus).toBe('synced')
      expect((await s.outboxByStatus('acked')).map(o => o.opId)).toEqual([op1.opId])

      // A later local edit is pending again, and keeps what the server last said.
      await updateExpense(s, ctx, e.id, draft({with: [a.id], title: 'Dinner 2'}))
      expect(await s.get('expense', e.id)).toMatchObject({syncStatus: 'pending', serverVersion: 7})

      // Two ops waiting: the first ack leaves the row pending.
      await updateExpense(s, ctx, e.id, draft({with: [a.id], title: 'Dinner 3'}))
      const ops = (await s.outbox()).filter(o => o.entityId === e.id && o.status === 'queued')
      expect(ops).toHaveLength(2)
      await s.setOpStatus(ops[0]!.opId, 'acked')
      expect((await s.get('expense', e.id))?.syncStatus).toBe('pending')
      await s.setOpStatus(ops[1]!.opId, 'acked')
      expect((await s.get('expense', e.id))?.syncStatus).toBe('synced')
      await s.close()
    })

    test('a row written as already synced (a pull) is synced and queues nothing', async () => {
      const s = await open()
      await s.transaction(async tx =>
        tx.put({type: 'person', id: 'p', data: {name: 'P', isMe: false}, version: 3, deleted: false, updatedAt: 9, syncStatus: 'synced', serverVersion: 3, syncedAt: 9}),
      )
      expect(await s.get('person', 'p')).toMatchObject({syncStatus: 'synced', serverVersion: 3, createdAt: 9})
      expect(await s.outbox()).toEqual([])
      await s.close()
    })

    test('rebuildProjections reproduces exactly what the transactions kept', async () => {
      const { s, ctx, a, b, g } = await seeded()
      for (let i = 0; i < 6; i++) await createExpense(s, ctx, draft({with: [a.id, b.id], groupId: i % 2 ? g.id : null, date: `2026-10-0${i + 1}`, total: BigInt(1000 + i * 7), payers: {me: BigInt(1000 + i * 7)}}))
      const rep = await createRepayment(s, ctx, {groupId: null, currency: 'INR', from: a.id, to: 'me', amount: 100n, date: '2026-10-09', tz: 'Asia/Kolkata', note: ''})
      await deleteRepayment(s, ctx, rep.id)
      const keep = async () => ({
        balances: (await s.balances()).sort((x, y) => (x.personId + x.groupId + x.currency < y.personId + y.groupId + y.currency ? -1 : 1)),
        pairs: (await s.pairBalances('me')).concat(await s.pairBalances(a.id)),
        parties: (await s.parties({index: 'byPersonDate', eq: [a.id], limit: 100})).items,
        members: (await s.members({groupId: g.id})).sort((x, y) => (x.personId < y.personId ? -1 : 1)),
      })
      const before = await keep()
      await s.rebuildProjections()
      expect(await keep()).toEqual(before)
      await expectProjectionsMatchLedger(s)
      await s.close()
    })

    test('erase takes the projections with the rows', async () => {
      const { s, ctx, a } = await seeded()
      const e = await createExpense(s, ctx, draft({with: [a.id]}))
      await s.erase([{type: 'expense', id: e.id}])
      expect(await s.parties({index: 'byPersonDate', eq: [a.id]})).toEqual({items: [], next: null})
      expect(await s.balances({personId: 'me'})).toEqual([])
      expect(await s.pairBalances('me')).toEqual([])
      expect((await s.outbox()).filter(o => o.entityId === e.id)).toEqual([])
      await s.close()
    })

    test('history pages newest change first; lastActivity reads indexes only', async () => {
      const { s, ctx, a, b } = await seeded()
      await createExpense(s, ctx, draft({with: [a.id], date: '2026-10-05'}))
      const lent = await createRepayment(s, ctx, {groupId: null, currency: 'INR', from: b.id, to: 'me', amount: 10n, date: '2026-10-08', tz: 'Asia/Kolkata', note: ''})
      await deleteRepayment(s, ctx, lent.id)
      const first = await s.historyPage({limit: 2})
      expect(first.items).toHaveLength(2)
      expect(first.items[0]!.at >= first.items[1]!.at).toBe(true)
      expect(first.next).not.toBeNull()
      const rest = await s.historyPage({limit: 100, after: first.next})
      expect(first.items.length + rest.items.length).toBe((await s.dump()).history.length)
      const last = await s.lastActivity()
      // Newest change to anything they are on; a delete is activity too.
      expect(last.get(a.id)).toBeGreaterThan(0)
      expect(last.get('me')).toBe(last.get(b.id)!)
      expect(last.get(b.id)).toBeGreaterThan(last.get(a.id)!)
      expect([...last.keys()][0]).toBe('me') // newest first
      expect(last.size).toBe(3)
      await s.close()
    })

    test('a group is active when it or anything recorded in it changes, a delete included', async () => {
      const { s, ctx, a, g } = await seeded()
      const g2 = await createGroup(s, ctx, {name: 'Later', kind: 'home', currency: 'INR', memberIds: [a.id], startDate: null, endDate: null})
      const born = await s.groupActivity()
      expect([...born.keys()]).toEqual([g2.id, g.id]) // newest first
      const e = await createExpense(s, ctx, draft({with: [a.id], groupId: g.id}))
      const afterExpense = await s.groupActivity()
      expect([...afterExpense.keys()]).toEqual([g.id, g2.id])
      expect(afterExpense.get(g.id)).toBe(e.updatedAt)
      await deleteExpense(s, ctx, e.id)
      const afterDelete = (await s.groupActivity()).get(g.id)!
      expect(afterDelete).toBeGreaterThan(e.updatedAt)
      await s.rebuildProjections()
      expect((await s.groupActivity()).get(g.id)).toBe(afterDelete)
      // Moving an expense to another group is activity for both.
      const m = await createExpense(s, ctx, draft({with: [a.id], groupId: g.id}))
      await updateExpense(s, ctx, m.id, draft({with: [a.id], groupId: g2.id}))
      const moved = await s.groupActivity()
      expect(moved.get(g2.id)).toBe(moved.get(g.id))
      await s.close()
    })

    test('an inactive group rejects add, edit, move-into and restore-into with GROUP_INACTIVE (decision 89); payments still record', async () => {
      const { s, ctx, a, g } = await seeded()
      const inGroup = await createExpense(s, ctx, draft({with: [a.id], groupId: g.id}))
      const gone = await createExpense(s, ctx, draft({with: [a.id], groupId: g.id}))
      const direct = await createExpense(s, ctx, draft({with: [a.id]}))
      await deleteExpense(s, ctx, gone.id)
      await makeGroupInactive(s, ctx, g.id)
      const code = async (p: Promise<unknown>) => p.then(() => 'ok', (e: { code?: string }) => e.code)
      expect(await code(createExpense(s, ctx, draft({with: [a.id], groupId: g.id})))).toBe('GROUP_INACTIVE')
      expect(await code(updateExpense(s, ctx, inGroup.id, draft({with: [a.id], groupId: g.id, title: 'x'})))).toBe('GROUP_INACTIVE')
      expect(await code(updateExpense(s, ctx, direct.id, draft({with: [a.id], groupId: g.id})))).toBe('GROUP_INACTIVE')
      expect(await code(restoreExpense(s, ctx, gone.id))).toBe('GROUP_INACTIVE')
      const paid = await code(createRepayment(s, ctx, {groupId: g.id, currency: 'INR', from: a.id, to: 'me', amount: 10n, date: '2026-10-08', tz: 'Asia/Kolkata', note: ''}))
      expect(paid).toBe('ok')
      // An expense that sits in the inactive group cannot be moved out of it either: that would change its balances.
      expect(await code(updateExpense(s, ctx, inGroup.id, draft({with: [a.id], groupId: null})))).toBe('GROUP_INACTIVE')
      expect((await s.get<ExpenseDraft>('expense', inGroup.id))!.data.groupId).toBe(g.id)
      await makeGroupActive(s, ctx, g.id)
      expect(await code(updateExpense(s, ctx, inGroup.id, draft({with: [a.id], groupId: null})))).toBe('ok')
      expect(await code(createExpense(s, ctx, draft({with: [a.id], groupId: g.id})))).toBe('ok')
      await s.close()
    })

    test('a deleted item follows the bin window of the day it was deleted, not the current setting (decision 102)', async () => {
      const { s, a, g } = await seeded()
      const DAY = 86_400_000
      let at = 1_700_000_000_000
      const ctx: MutationCtx = {deviceId: 'dev1', actor: 'me', now: () => at, newId: (() => { let n = 0; return () => `t${++n}` })()}
      await setPref(s, ctx, 'history.binDays', 90)
      const old = await createExpense(s, ctx, draft({with: [a.id], date: '2026-10-01'}))
      await deleteExpense(s, ctx, old.id)
      const t0 = at
      expect(((await s.get<{purgeAfter?: number}>('expense', old.id))!.data).purgeAfter).toBe(t0 + 90 * DAY)
      // The setting drops to 7 days; the old item keeps its own date, and what is deleted now gets 7.
      at = t0 + DAY
      await setPref(s, ctx, 'history.binDays', 7)
      const fresh = await createExpense(s, ctx, draft({with: [a.id], date: '2026-10-02'}))
      await deleteExpense(s, ctx, fresh.id)
      expect(((await s.get<{purgeAfter?: number}>('expense', fresh.id))!.data).purgeAfter).toBe(at + 7 * DAY)
      const listed = async (when: number) => (await loadBin(s, when, 7)).map(i => i.entity.id).sort()
      expect(await listed(t0 + 2 * DAY)).toEqual([fresh.id, old.id].sort())
      expect(await listed(t0 + 9 * DAY)).toEqual([old.id])
      expect(await listed(t0 + 89 * DAY)).toEqual([old.id])
      expect((await loadBin(s, t0 + 89 * DAY, 7))[0]!.purgeAfter).toBe(t0 + 90 * DAY)
      expect(await listed(t0 + 91 * DAY)).toEqual([])
      // Once it is past its own date it can no longer be restored.
      at = t0 + 91 * DAY
      expect(await restoreExpense(s, ctx, old.id).then(() => 'ok', (e: { code?: string }) => e.code)).toBe('NOT_FOUND')
      // A group's deletion stamps the group and every record it takes, and a restore clears the stamp.
      at = t0 + 100 * DAY
      await setPref(s, ctx, 'history.binDays', 30)
      const inGroup = await createExpense(s, ctx, draft({with: [a.id], groupId: g.id}))
      await deleteGroup(s, ctx, g.id)
      expect(((await s.get<{purgeAfter?: number}>('group', g.id))!.data).purgeAfter).toBe(at + 30 * DAY)
      expect(((await s.get<{purgeAfter?: number}>('expense', inGroup.id))!.data).purgeAfter).toBe(at + 30 * DAY)
      await restoreGroup(s, ctx, g.id)
      expect('purgeAfter' in ((await s.get('expense', inGroup.id))!.data as object)).toBe(false)
      expect('purgeAfter' in ((await s.get('group', g.id))!.data as object)).toBe(false)
      await s.close()
    })

    test('a row deleted before the rule gets its purgeAfter once, from the setting at that read (decision 102)', async () => {
      const { s, ctx, a } = await seeded()
      const DAY = 86_400_000
      const e = await createExpense(s, ctx, draft({with: [a.id]}))
      await deleteExpense(s, ctx, e.id)
      // Make it a legacy tombstone: strip the stamp the delete wrote.
      await s.transaction(async tx => {
        const row = (await tx.get<{purgeAfter?: number}>('expense', e.id))!
        const {purgeAfter: _p, ...data} = row.data
        await tx.put({...row, data})
      })
      const before = (await s.get('expense', e.id))!
      const stamped = (await loadBin(s, before.updatedAt + DAY, 30))[0]!
      expect(stamped.purgeAfter).toBe(before.updatedAt + 30 * DAY)
      const after = (await s.get<{purgeAfter?: number}>('expense', e.id))!
      expect(after.data.purgeAfter).toBe(before.updatedAt + 30 * DAY)
      // Stamped quietly: same version and time, no new history or op.
      expect(after.version).toBe(before.version)
      expect(after.updatedAt).toBe(before.updatedAt)
      expect((await s.history('expense', e.id)).length).toBe(before.version)
      // Later reads, under any setting, keep it.
      expect((await loadBin(s, before.updatedAt + DAY, 7))[0]!.purgeAfter).toBe(before.updatedAt + 30 * DAY)
      await s.close()
    })

    test('count reads an index range without reading rows; historyMany reads several entities at once', async () => {
      const { s, ctx, a, g } = await seeded()
      const e1 = await createExpense(s, ctx, draft({with: [a.id], groupId: g.id, date: '2026-10-01'}))
      const e2 = await createExpense(s, ctx, draft({with: [a.id], groupId: g.id, date: '2026-10-05'}))
      await deleteExpense(s, ctx, e2.id)
      expect(await s.count('expense', {index: 'byDeleted', eq: [0]})).toBe(1)
      expect(await s.count('expense', {index: 'byDeleted', eq: [1]})).toBe(1)
      expect(await s.count('expense', {index: 'byDate', min: '2026-10-02'})).toBe(1)
      expect(await s.count('expense', {})).toBe(2)
      expect(await s.count('expense', {min: e1.id, max: e1.id})).toBe(1)
      const rows = await s.historyMany([{type: 'expense', id: e1.id}, {type: 'expense', id: e2.id}])
      expect(rows.map(r => `${r.entityId}:${r.version}`)).toEqual([`${e1.id}:1`, `${e2.id}:1`, `${e2.id}:2`])
      await s.close()
    })

    test('dump returns every entity, history row and op', async () => {
      const { s, ctx, a } = await seeded()
      await createExpense(s, ctx, draft({with: [a.id]}))
      const dump = await s.dump()
      expect(dump.entities.map((e: Entity) => e.type).sort()).toEqual(['expense', 'group', 'person', 'person', 'person'])
      expect(dump.history.length).toBe(5)
      expect(dump.outbox.length).toBe(5)
      await s.close()
    })
  })
}
