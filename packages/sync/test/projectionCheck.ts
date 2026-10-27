import {expect} from 'bun:test'
import {groupNet, type LedgerRecord, pairwiseBalances, recordCells} from '@splito/domain'

import {type Expense, type Repayment} from '../src/mutations'
import {termKey, termRows} from '../src/searchTerms'
import {toExpenseRecord, toRepaymentRecord, toWriteOffRecord} from '../src/selectors'
import {type Store} from '../src/store'
import {type Entity} from '../src/types'

const DIRECT = '__direct__'
const MONEY = ['expense', 'repayment', 'writeoff']

/** The whole ledger from the entity rows (tombstones flagged), exactly as the store holds it. */
export async function ledgerOf(s: Store): Promise<LedgerRecord[]> {
  const { entities } = await s.dump()
  return entities.flatMap((e): LedgerRecord[] =>
    e.type === 'expense'
      ? [toExpenseRecord(e as Entity<Expense>)]
      : e.type === 'repayment'
        ? [toRepaymentRecord(e as Entity<Repayment>)]
        : e.type === 'writeoff'
          ? [toWriteOffRecord(e as Entity<Repayment>)]
          : [],
  )
}

/**
 * The reference the property test checks the projections against: balances
 * recomputed from the ledger with the domain's own `groupNet` and
 * `pairwiseBalances` (not the code that maintains the tables), compared with
 * what `balances` and `pair_balances` hold.
 */
export async function expectProjectionsMatchLedger(s: Store) {
  await expectDerivedTablesMatch(s)
  const records = await ledgerOf(s)
  const keyed = records.map(r => ({...r, groupId: r.groupId ?? DIRECT}))
  const groups = [...new Set(keyed.filter(r => !r.deleted).map(r => r.groupId))].sort()

  const expectedNets: Record<string, bigint> = {}
  for (const groupId of groups)
    for (const [currency, net] of Object.entries(groupNet(keyed, groupId)))
      for (const [person, amount] of Object.entries(net)) expectedNets[JSON.stringify([person, groupId === DIRECT ? '' : groupId, currency])] = amount
  const storedNets: Record<string, bigint> = {}
  for (const b of await s.balances()) storedNets[JSON.stringify([b.personId, b.groupId ?? '', b.currency])] = b.amount
  expect(storedNets).toEqual(expectedNets)

  const people = [...new Set(records.flatMap(r => (r.kind === 'expense' ? [...Object.keys(r.payers), ...Object.keys(r.shares)] : [r.from, r.to])))]
  const direct = records.filter(r => r.groupId === null)
  for (const me of people) {
    const expected = pairwiseBalances(direct, me).map(r => [r.person, r.currency, r.amount] as const)
    const stored = (await s.pairBalances(me)).map(r => [r.otherId, r.currency, r.amount] as const)
    const sort = (rows: ReadonlyArray<readonly [string, string, bigint]>) => [...rows].sort((x, y) => (x[0] + x[1] < y[0] + y[1] ? -1 : 1))
    expect(sort(stored)).toEqual(sort(expected))
  }
}

/** Aggregates folded by key from the ledger, computed here from the records (not by the code that maintains the table). */
async function expectedAggregates(s: Store) {
  const {entities} = await s.dump()
  const folded = new Map<string, [string, string, string, string, string, string, string, string, string, string, number]>()
  for (const e of entities) {
    if (!MONEY.includes(e.type) || e.deleted) continue
    const r = e.type === 'expense' ? {...toExpenseRecord(e as Entity<Expense>), category: (e.data as Expense).category} : e.type === 'repayment' ? toRepaymentRecord(e as Entity<Repayment>) : toWriteOffRecord(e as Entity<Repayment>)
    for (const c of recordCells(r)) {
      const key = [c.currency, c.date.slice(0, 7), c.groupId, c.category, c.person, c.kind]
      const id = JSON.stringify(key)
      const f = folded.get(id) ?? ([...key, '0', '0', '0', '0', 0] as [string, string, string, string, string, string, string, string, string, string, number])
      f[6] = String(BigInt(f[6]) + c.total)
      f[7] = String(BigInt(f[7]) + c.paid)
      f[8] = String(BigInt(f[8]) + c.share)
      f[9] = String(BigInt(f[9]) + c.net)
      f[10] += c.count
      folded.set(id, f)
    }
  }
  return [...folded.values()].filter(f => f[10] !== 0 || f.slice(6, 10).some(v => v !== '0')).sort((x, y) => (JSON.stringify(x) < JSON.stringify(y) ? -1 : 1))
}

/** The stored aggregates, in the same shape. */
export async function storedAggregates(s: Store) {
  return (await s.aggregates())
    .map(c => [c.currency, c.date.slice(0, 7), c.groupId, c.category, c.person, c.kind, String(c.total), String(c.paid), String(c.share), String(c.net), c.count])
    .sort((x, y) => (JSON.stringify(x) < JSON.stringify(y) ? -1 : 1))
}

/** Every stored search term, as keys. */
export async function storedTerms(s: Store) {
  const out: string[] = []
  for (const kind of ['w', 'p', 'g', 'a', 'm', 'c'] as const) for (const t of await s.terms({kind})) out.push(JSON.stringify([t.kind, t.term, t.entityType, t.entityId]))
  return out.sort()
}

/**
 * The newest change per group and per person, from the history: every
 * version of a money record bumps the groups and people it and the version
 * before it name, at that version's time (plus a group's own change).
 */
export async function expectedActivity(s: Store) {
  const {entities, history} = await s.dump()
  const groupAt = new Map<string, number>()
  const personAt = new Map<string, number>()
  const names = (type: string, d: Record<string, unknown>) =>
    type === 'expense' ? [...Object.keys((d.payers ?? {}) as object), ...Object.keys((d.shares ?? {}) as object)] : [d.from as string, d.to as string]
  const bump = (type: string, d: Record<string, unknown> | undefined, at: number) => {
    if (!d) return
    const g = d.groupId as string | null
    if (g) groupAt.set(g, Math.max(groupAt.get(g) ?? 0, at))
    for (const p of names(type, d)) personAt.set(p, Math.max(personAt.get(p) ?? 0, at))
  }
  const byEntity = new Map<string, typeof history>()
  for (const h of history) if (MONEY.includes(h.entityType)) byEntity.set(`${h.entityType}:${h.entityId}`, [...(byEntity.get(`${h.entityType}:${h.entityId}`) ?? []), h])
  for (const rows of byEntity.values()) {
    rows.sort((x, y) => x.version - y.version)
    rows.forEach((h, i) => {
      bump(h.entityType, h.data as Record<string, unknown>, h.at)
      bump(h.entityType, rows[i - 1]?.data as Record<string, unknown> | undefined, h.at)
    })
  }
  const groups = new Map(entities.filter(e => e.type === 'group').map(g => [g.id, Math.max(g.updatedAt, groupAt.get(g.id) ?? 0)]))
  const people = new Map(entities.filter(e => e.type === 'person' && (personAt.get(e.id) ?? 0) > 0).map(p => [p.id, personAt.get(p.id)!]))
  return {groups, people}
}

/** Every derived table equals what the entity rows and history imply. */
export async function expectDerivedTablesMatch(s: Store) {
  expect(await storedAggregates(s)).toEqual(await expectedAggregates(s))
  const {entities} = await s.dump()
  expect(await storedTerms(s)).toEqual(entities.flatMap(e => termRows(e).map(r => JSON.stringify(termKey(r)))).sort())
  const want = await expectedActivity(s)
  expect(new Map([...(await s.groupActivity())].sort())).toEqual(new Map([...want.groups].sort()))
  expect(new Map([...(await s.lastActivity())].sort())).toEqual(new Map([...want.people].sort()))
}
