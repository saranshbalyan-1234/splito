/*
 * ARCHITECTURE 9.8: the balance projection equals a full recomputation after
 * any sequence of money writes. Random operation sequences (add, edit,
 * delete, restore for expenses; add, delete, restore for payments and
 * write-offs; members and groups; moving an expense between groups and
 * between a group and direct; "delete forever"; erasing rows outright, the
 * demo set's removal among them; many currencies, three of them with
 * non-two-decimal scales) run through the real mutations on both engines;
 * after each sequence the stored sums, the monthly aggregates, the search
 * terms and the activity times of groups and people are compared with a
 * recomputation (`projectionCheck.ts`), and `rebuildProjections` must
 * reproduce every one of them exactly.
 */
import 'fake-indexeddb/auto'
import {IDBFactory} from 'fake-indexeddb'

import {describe, expect, test} from 'bun:test'
import {DomainError} from '@splito/domain'
import fc from 'fast-check'

import {encode} from '../src/codec'
import {openIdbStore} from '../src/idbStore'
import {
  addGroupMembers,
  createExpense,
  createGroup,
  createPerson,
  createRepayment,
  createWriteOffs,
  deleteExpense,
  deleteRepayment,
  deleteWriteOff,
  type ExpenseDraft,
  type Group,
  ensureMe,
  purgeDeleted,
  restoreExpense,
  restoreRepayment,
  restoreWriteOff,
  updateExpense,
  updateGroup,
  updatePerson,
  deletePerson,
} from '../src/mutations'
import {deleteGroup, makeGroupActive, makeGroupInactive, purgeDeletedGroup, removeGroupMember, restoreGroup} from '../src/groupLifecycle'
import {openSqlStore} from '../src/sqlStore'
import {type Store} from '../src/store'
import {bunExecutor} from './bunExecutor'
import {expectProjectionsMatchLedger, storedAggregates, storedTerms} from './projectionCheck'
import {makeCtx} from './storeV2Contract'

const CURRENCIES = ['INR', 'EUR', 'USD', 'GBP', 'JPY', 'BHD']

/** mulberry32: a seed fully decides one run, so a failing seed replays. */
function rng(seed: number) {
  let a = seed >>> 0
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const int = (lo: number, hi: number) => lo + Math.floor(next() * (hi - lo + 1))
  const pick = <T>(xs: readonly T[]) => xs[int(0, xs.length - 1)]!
  const some = <T>(xs: readonly T[], min: number, max: number) => {
    const pool = [...xs]
    const out: T[] = []
    for (let n = Math.min(int(min, max), pool.length); n > 0; n--) out.push(pool.splice(int(0, pool.length - 1), 1)[0]!)
    return out
  }
  return {next, int, pick, some}
}

async function run(s: Store, seed: number, steps: number, {erases = true}: {erases?: boolean} = {}) {
  const r = rng(seed)
  const ctx = makeCtx()
  /* Some rows get the demo set's id tag, so "remove demo data" has something to erase. */
  let tagged = 0
  const demoCtx = {...ctx, newId: () => `demo-large-${String(++tagged).padStart(5, '0')}`}
  const mint = () => (r.next() < 0.3 ? demoCtx : ctx)
  await ensureMe(s, ctx, 'Me')
  const people = ['me']
  for (let i = 0; i < 5; i++) people.push((await createPerson(s, mint(), {name: `P${i}`})).id)
  const groups: Array<{id: string; members: string[]}> = []
  const expenses: string[] = []
  const repayments: string[] = []
  const writeOffs: string[] = []
  const stats = {erased: 0, demoRemoved: 0}
  const date = () => `2026-0${r.int(1, 9)}-${String(r.int(10, 28))}`

  const WORDS = ['dinner', 'cab', 'rent', 'Pastéis', 'trip', 'beer', 'coffee', 'ticket', 'Zürich', 'snacks']
  const CATEGORIES = ['food', 'transport', 'rent', 'fun', 'unlisted-category']
  const words = (min: number, max: number) => Array.from({length: r.int(min, max)}, () => r.pick(WORDS)).join(' ')
  const draft = (members: string[], groupId: string | null): ExpenseDraft => {
    const currency = r.pick(CURRENCIES)
    const total = BigInt(r.int(1, 2_000_000))
    const payers = r.some(members, 1, 2)
    // Now and then a bill of items (named, split between some of the members); its total is what the items add up to.
    if (r.next() < 0.15) {
      const items = Array.from({length: r.int(1, 3)}, (_, i) => ({id: `i${i}`, name: words(1, 2), amount: BigInt(r.int(1, 90_000)), participants: r.some(members, 1, members.length)}))
      const sum = items.reduce((a, i) => a + i.amount, 0n)
      return {
        title: words(1, 3), groupId, currency, total: sum, payers: {[payers[0]!]: sum},
        split: {mode: 'items', items, tax: 0n, tip: 0n, discount: 0n},
        date: date(), tz: 'UTC', category: r.pick(CATEGORIES), notes: r.next() < 0.5 ? words(0, 4) : '',
      }
    }
    const each = total / BigInt(payers.length)
    const paid: Record<string, bigint> = {}
    payers.forEach((p, i) => (paid[p] = i === payers.length - 1 ? total - each * BigInt(i) : each))
    return {
      title: words(1, 3), groupId, currency, total, payers: paid,
      split: {mode: 'equal', participants: r.some(members, 1, members.length)},
      date: date(), tz: 'UTC', category: r.pick(CATEGORIES), notes: r.next() < 0.5 ? words(0, 4) : '',
    }
  }

  for (let step = 0; step < steps; step++) {
    try {
      switch (r.int(0, 24)) {
        case 0: {
          const members = r.some(people.filter(p => p !== 'me'), 2, 4)
          const g = await createGroup(s, mint(), {name: `G${groups.length}`, kind: 'trip', currency: r.pick(CURRENCIES), memberIds: members, startDate: null, endDate: null})
          groups.push({id: g.id, members: ['me', ...members]})
          break
        }
        case 1: {
          if (!groups.length) break
          const g = r.pick(groups)
          const add = r.some(people.filter(p => !g.members.includes(p)), 1, 1)
          if (add.length) await addGroupMembers(s, ctx, g.id, add)
          g.members.push(...add)
          break
        }
        case 2:
        case 3:
        case 4: {
          const g = groups.length && r.next() < 0.6 ? r.pick(groups) : undefined
          expenses.push((await createExpense(s, mint(), draft(g ? g.members : people, g?.id ?? null))).id)
          break
        }
        case 5: {
          if (!expenses.length) break
          const id = r.pick(expenses)
          const e = await s.get<ExpenseDraft>('expense', id)
          if (!e) break
          const g = groups.find(x => x.id === e.data.groupId)
          await updateExpense(s, ctx, id, draft(g ? g.members : people, g?.id ?? null))
          break
        }
        case 6:
          if (expenses.length) await deleteExpense(s, ctx, r.pick(expenses))
          break
        case 7:
          if (expenses.length) await restoreExpense(s, ctx, r.pick(expenses))
          break
        case 8:
        case 9: {
          const g = groups.length && r.next() < 0.5 ? r.pick(groups) : undefined
          const [from, to] = r.some(g ? g.members : people, 2, 2)
          const input = {groupId: g?.id ?? null, currency: r.pick(CURRENCIES), from: from!, to: to!, amount: BigInt(r.int(1, 500_000)), date: date(), tz: 'UTC', note: ''}
          if (r.next() < 0.6) repayments.push((await createRepayment(s, ctx, input)).id)
          else writeOffs.push((await createWriteOffs(s, ctx, [input]))[0]!.id)
          break
        }
        case 10:
          if (r.next() < 0.5 && repayments.length) await deleteRepayment(s, ctx, r.pick(repayments))
          else if (writeOffs.length) await deleteWriteOff(s, ctx, r.pick(writeOffs))
          break
        case 11:
          if (r.next() < 0.5 && repayments.length) await restoreRepayment(s, ctx, r.pick(repayments))
          else if (writeOffs.length) await restoreWriteOff(s, ctx, r.pick(writeOffs))
          break
        case 12:
        case 16:
        case 17: {
          // Moves an expense to another group, out of its group, or into one: activity for both ends.
          if (!expenses.length) break
          const target = r.next() < 0.3 ? undefined : groups.length ? r.pick(groups) : undefined
          await updateExpense(s, ctx, r.pick(expenses), draft(target ? target.members : people, target?.id ?? null))
          break
        }
        case 13: {
          // "Delete forever" of something already deleted.
          const types = [['expense', expenses], ['repayment', repayments], ['writeoff', writeOffs]] as const
          const [type, ids] = r.pick(types)
          if (ids.length) await purgeDeleted(s, ctx, type, r.pick(ids))
          break
        }
        case 14: {
          // Erases a few rows outright (any type), with their history and ops.
          const { entities } = await s.dump()
          if (erases && r.next() < 0.5 && entities.length) {
            const refs = r.some(entities, 1, 4).map(e => ({type: e.type, id: e.id}))
            await s.erase(refs)
            stats.erased += refs.length
          }
          break
        }
        case 18: {
          // A person renamed: their own search terms change, the expenses' do not.
          const id = r.pick(people.filter(p => p !== 'me'))
          await updatePerson(s, ctx, id, {name: `${words(1, 2)} ${r.int(0, 9)}`})
          break
        }
        case 19: {
          // A group renamed.
          if (!groups.length) break
          const g = await s.get<Group>('group', r.pick(groups).id)
          if (!g || g.deleted) break
          await updateGroup(s, ctx, g.id, {...g.data, name: `${words(1, 2)} ${r.int(0, 9)}`})
          break
        }
        case 20: {
          // A person nobody is on is deleted (the rules refuse the others).
          await deletePerson(s, ctx, r.pick(people.filter(p => p !== 'me')))
          break
        }
        case 21: {
          // A group deleted (a tombstone; there is no screen for it yet, the projections must still follow).
          if (!groups.length) break
          const g = await s.get<Group>('group', r.pick(groups).id)
          if (g && !g.deleted) await s.transaction(tx => tx.put({...g, version: g.version + 1, updatedAt: g.updatedAt + 1, deleted: true}))
          break
        }
        case 22: {
          // A member leaves, settling, forgiving or keeping a balance (F-615, F-613).
          if (!groups.length) break
          const g = r.pick(groups)
          const who = r.pick(g.members.filter(p => p !== 'me'))
          await removeGroupMember(s, ctx, {groupId: g.id, personId: who, choice: r.pick(['settle', 'forgive', 'keep'] as const), date: date(), tz: 'UTC'})
          break
        }
        case 23: {
          // A group is made inactive or active, or deleted with its records and brought back (F-604, F-615).
          if (!groups.length) break
          const g = r.pick(groups)
          const roll = r.next()
          if (roll < 0.3) await makeGroupInactive(s, ctx, g.id)
          else if (roll < 0.5) await makeGroupActive(s, ctx, g.id)
          else if (roll < 0.8) await deleteGroup(s, ctx, g.id)
          else await restoreGroup(s, ctx, g.id)
          break
        }
        case 24: {
          // Delete forever of a deleted group.
          if (groups.length) await purgeDeletedGroup(s, ctx, r.pick(groups).id)
          break
        }
        case 15: {
          // "Remove demo data": everything carrying the demo tag, in one go.
          const { entities } = await s.dump()
          const tagged = entities.filter(e => e.id.startsWith('demo-large-')).map(e => ({type: e.type, id: e.id}))
          if (erases && r.next() < 0.4 && tagged.length) {
            await s.erase(tagged)
            stats.demoRemoved += tagged.length
          }
          break
        }
      }
    } catch (e) {
      // Operations the rules refuse (restore of a live row, a pair of one) are part of the sequence.
      if (!(e instanceof DomainError)) throw e
    }
  }
  return stats
}

async function check(open: () => Promise<Store>, seed: number, steps: number) {
  const s = await open()
  await run(s, seed, steps)
  await expectProjectionsMatchLedger(s)
  const keep = async () => ({
    balances: (await s.balances()).sort((x, y) => (encode(x) < encode(y) ? -1 : 1)),
    pairs: (await Promise.all(['me', ...(await s.getAll('person')).map(p => p.id)].map(id => s.pairBalances(id)))).flat(),
    aggregates: await storedAggregates(s),
    terms: await storedTerms(s),
    groupActivity: [...(await s.groupActivity())].sort(),
    lastActivity: [...(await s.lastActivity())].sort(),
  })
  const before = await keep()
  await s.rebuildProjections()
  expect(await keep()).toEqual(before)
  await s.close()
}

describe('projection == recomputation over random operation sequences', () => {
  test('SQLite', async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer(), fc.integer({min: 15, max: 70}), (seed, steps) => check(() => openSqlStore(bunExecutor(':memory:')), seed, steps)),
      {numRuns: 25},
    )
  }, 120_000)

  test('IndexedDB', async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer(), fc.integer({min: 15, max: 50}), (seed, steps) => check(() => openIdbStore('prop', new IDBFactory()), seed, steps)),
      {numRuns: 6},
    )
  }, 120_000)

  test('the generator reaches real states: live and deleted expenses, payments, write-offs, balances in many currencies', async () => {
    const s = await openSqlStore(bunExecutor(':memory:'))
    await run(s, 12345, 260, {erases: false})
    await expectProjectionsMatchLedger(s)
    const { entities } = await s.dump()
    const of = (type: string, deleted: boolean) => entities.filter(e => e.type === type && e.deleted === deleted).length
    expect(of('expense', false)).toBeGreaterThan(5)
    expect(of('expense', true)).toBeGreaterThan(0)
    expect(of('repayment', false) + of('writeoff', false)).toBeGreaterThan(2)
    expect(new Set((await s.balances()).map(b => b.currency)).size).toBeGreaterThan(2)
    await s.close()
  })

  test('the generator moves expenses between groups and direct, and deletes forever', async () => {
    const s = await openSqlStore(bunExecutor(':memory:'))
    await run(s, 777, 300, {erases: false})
    await expectProjectionsMatchLedger(s)
    const { entities, history } = await s.dump()
    const places = new Map<string, Set<string | null>>()
    for (const h of history.filter(h => h.entityType === 'expense')) places.set(h.entityId, (places.get(h.entityId) ?? new Set()).add((h.data as {groupId: string | null}).groupId))
    expect([...places.values()].filter(p => p.size > 1).length).toBeGreaterThan(0)
    expect([...places.values()].some(p => p.has(null) && p.size > 1)).toBe(true)
    expect(entities.filter(e => (e.data as {purgedAt?: number}).purgedAt !== undefined).length).toBeGreaterThan(0)

    await s.close()
  })

  test('erasing rows outright (the demo set among them) leaves every derived table exact', async () => {
    const total = {erased: 0, demoRemoved: 0}
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const s = await openSqlStore(bunExecutor(':memory:'))
      const stats = await run(s, seed, 120)
      await expectProjectionsMatchLedger(s)
      total.erased += stats.erased
      total.demoRemoved += stats.demoRemoved
      await s.close()
    }
    expect(total.erased).toBeGreaterThan(0)
    expect(total.demoRemoved).toBeGreaterThan(0)
  })

  test('the generator reaches the group life cycle: a member left, a group went with its records, one was made inactive', async () => {
    const seen = {left: false, inactive: false, withGroup: false, restored: false}
    for (const seed of [11, 12, 13, 14, 15, 16, 17, 18]) {
      const s = await openSqlStore(bunExecutor(':memory:'))
      await run(s, seed, 200, {erases: false})
      await expectProjectionsMatchLedger(s)
      const {entities, history} = await s.dump()
      const groupsNow = entities.filter(e => e.type === 'group').map(e => e.data as Group)
      seen.left ||= groupsNow.some(g => g.members.some(m => m.leftAt !== null))
      seen.inactive ||= groupsNow.some(g => g.inactive === true)
      seen.withGroup ||= entities.some(e => (e.data as {deletedWithGroup?: string}).deletedWithGroup !== undefined)
      seen.restored ||= history.some(h => h.entityType === 'group' && !h.deleted && history.some(p => p.entityType === 'group' && p.entityId === h.entityId && p.deleted && p.version < h.version))
      await s.close()
    }
    expect(seen).toEqual({left: true, inactive: true, withGroup: true, restored: true})
  })
})
