/*
 * ARCHITECTURE 9.8: the balance projection equals a full recomputation after
 * any sequence of money writes. Random operation sequences (add, edit,
 * delete, restore for expenses; add, delete, restore for payments and
 * write-offs; members and groups; many currencies, three of them with
 * non-two-decimal scales) run through the real mutations on both engines;
 * after each sequence the stored sums are compared with the domain's own
 * recomputation (`projectionCheck.ts`), and `rebuildProjections` must
 * reproduce them exactly.
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
  ensureMe,
  restoreExpense,
  restoreRepayment,
  restoreWriteOff,
  updateExpense,
} from '../src/mutations'
import {openSqlStore} from '../src/sqlStore'
import type {Store} from '../src/store'
import {bunExecutor} from './bunExecutor'
import {expectProjectionsMatchLedger} from './projectionCheck'
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

async function run(s: Store, seed: number, steps: number) {
  const r = rng(seed)
  const ctx = makeCtx()
  await ensureMe(s, ctx, 'Me')
  const people = ['me']
  for (let i = 0; i < 5; i++) people.push((await createPerson(s, ctx, {name: `P${i}`})).id)
  const groups: Array<{id: string; members: string[]}> = []
  const expenses: string[] = []
  const repayments: string[] = []
  const writeOffs: string[] = []
  const date = () => `2026-0${r.int(1, 9)}-${String(r.int(10, 28))}`

  const draft = (members: string[], groupId: string | null): ExpenseDraft => {
    const currency = r.pick(CURRENCIES)
    const total = BigInt(r.int(1, 2_000_000))
    const payers = r.some(members, 1, 2)
    const each = total / BigInt(payers.length)
    const paid: Record<string, bigint> = {}
    payers.forEach((p, i) => (paid[p] = i === payers.length - 1 ? total - each * BigInt(i) : each))
    return {
      title: 'Spend', groupId, currency, total, payers: paid,
      split: {mode: 'equal', participants: r.some(members, 1, members.length)},
      date: date(), tz: 'UTC', category: 'food', notes: '',
    }
  }

  for (let step = 0; step < steps; step++) {
    try {
      switch (r.int(0, 11)) {
        case 0: {
          const members = r.some(people.filter(p => p !== 'me'), 2, 4)
          const g = await createGroup(s, ctx, {name: `G${groups.length}`, kind: 'trip', currency: r.pick(CURRENCIES), memberIds: members, startDate: null, endDate: null})
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
          expenses.push((await createExpense(s, ctx, draft(g ? g.members : people, g?.id ?? null))).id)
          break
        }
        case 5: {
          if (!expenses.length) break
          const id = r.pick(expenses)
          const e = await s.get<ExpenseDraft>('expense', id)
          const g = groups.find(x => x.id === e!.data.groupId)
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
      }
    } catch (e) {
      // Operations the rules refuse (restore of a live row, a pair of one) are part of the sequence.
      if (!(e instanceof DomainError)) throw e
    }
  }
}

async function check(open: () => Promise<Store>, seed: number, steps: number) {
  const s = await open()
  await run(s, seed, steps)
  await expectProjectionsMatchLedger(s)
  const keep = async () => ({
    balances: (await s.balances()).sort((x, y) => (encode(x) < encode(y) ? -1 : 1)),
    pairs: (await Promise.all(['me', ...(await s.getAll('person')).map(p => p.id)].map(id => s.pairBalances(id)))).flat(),
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
    await run(s, 12345, 120)
    await expectProjectionsMatchLedger(s)
    const { entities } = await s.dump()
    const of = (type: string, deleted: boolean) => entities.filter(e => e.type === type && e.deleted === deleted).length
    expect(of('expense', false)).toBeGreaterThan(5)
    expect(of('expense', true)).toBeGreaterThan(0)
    expect(of('repayment', false) + of('writeoff', false)).toBeGreaterThan(2)
    expect(new Set((await s.balances()).map(b => b.currency)).size).toBeGreaterThan(2)
    await s.close()
  })
})
