import {expect} from 'bun:test'
import {allocate, expenseDebts, groupNet, type LedgerRecord, pairwiseBalances, participantId, participantWeight, recordCells} from '@splito/domain'

import {type Dispute} from '../src/disputes'
import {type Expense, type Repayment} from '../src/mutations'
import {TERM_KINDS, termKey, termRows} from '../src/searchTerms'
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
  await expectDisputedMatch(s)
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

/**
 * The disputed sums recomputed from the rows: every live record with an open dispute or hold counts in full, or (when only
 * items of a bill are disputed) as those items' portions, and nets and debts are folded per person / group / currency.
 * Written from the records' own fields, not by the code that maintains `disputed_balances` and `disputed_pairs`.
 */
async function expectedDisputed(s: Store) {
  const {entities} = await s.dump()
  const open = new Map<string, Dispute[]>()
  for (const e of entities) {
    const d = e.data as Dispute
    if (e.type === 'dispute' && !e.deleted && d.status === 'open') open.set(`${d.targetType}:${d.targetId}`, [...(open.get(`${d.targetType}:${d.targetId}`) ?? []), d])
  }
  const nets = new Map<string, bigint>()
  const pairs = new Map<string, bigint>()
  const add = (m: Map<string, bigint>, key: unknown[], v: bigint) => m.set(JSON.stringify(key), (m.get(JSON.stringify(key)) ?? 0n) + v)
  for (const e of entities) {
    const disputes = open.get(`${e.type}:${e.id}`)
    if (!disputes || e.deleted || !MONEY.includes(e.type)) continue
    const d = e.data as Expense & Repayment
    const group = d.groupId ?? ''
    if (e.type !== 'expense') {
      add(nets, [d.from, group, d.currency], d.amount)
      add(nets, [d.to, group, d.currency], -d.amount)
      add(pairs, [d.from, d.to, group, d.currency], d.amount)
      add(pairs, [d.to, d.from, group, d.currency], -d.amount)
      continue
    }
    let payers = d.payers
    let shares = d.shares
    if (d.split.mode === 'items' && disputes.every(x => x.itemId !== null)) {
      const ids = new Set(disputes.map(x => x.itemId))
      shares = {}
      let total = 0n
      const picked = d.split.items.filter(i => ids.has(i.id))
      // An item no edit left in the bill counts for nothing (its dispute is closed as Gone).
      if (picked.length === 0) continue
      for (const item of picked) {
        total += item.amount
        for (const [id, v] of Object.entries(allocate(item.amount, item.participants.map(p => ({id: participantId(p), weight: BigInt(participantWeight(p))}))))) shares[id] = (shares[id] ?? 0n) + v
      }
      const paid = Object.entries(d.payers).filter(([, v]) => v > 0n)
      payers = paid.length ? allocate(total, paid.map(([id, weight]) => ({id, weight}))) : {}
    }
    for (const [p, v] of Object.entries(payers)) add(nets, [p, group, d.currency], v)
    for (const [p, v] of Object.entries(shares)) add(nets, [p, group, d.currency], -v)
    for (const t of expenseDebts({payers, shares})) {
      add(pairs, [t.creditor, t.debtor, group, d.currency], t.amount)
      add(pairs, [t.debtor, t.creditor, group, d.currency], -t.amount)
    }
  }
  const clean = (m: Map<string, bigint>) => Object.fromEntries([...m].filter(([, v]) => v !== 0n).sort(([a], [b]) => (a < b ? -1 : 1)))
  return {nets: clean(nets), pairs: clean(pairs)}
}

/** `disputed_balances` and `disputed_pairs` equal the recomputation (F-1210). */
export async function expectDisputedMatch(s: Store) {
  const want = await expectedDisputed(s)
  const nets: Record<string, bigint> = {}
  for (const b of await s.disputedBalances()) if (b.amount !== 0n) nets[JSON.stringify([b.personId, b.groupId ?? '', b.currency])] = b.amount
  expect(Object.fromEntries(Object.entries(nets).sort(([a], [b]) => (a < b ? -1 : 1)))).toEqual(want.nets)
  // Everyone who can hold a pair: the people rows, and whoever the expected keys name (a person may have been erased outright).
  const people = [...new Set([...(await s.getAll('person')).map(p => p.id), ...Object.keys(want.pairs).map(k => (JSON.parse(k) as string[])[0]!)])]
  const pairs: Record<string, bigint> = {}
  for (const p of people) for (const r of await s.disputedPairs(p)) pairs[JSON.stringify([r.personId, r.otherId, r.groupId ?? '', r.currency])] = r.amount
  expect(Object.fromEntries(Object.entries(pairs).sort(([a], [b]) => (a < b ? -1 : 1)))).toEqual(want.pairs)
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
  for (const kind of TERM_KINDS) for (const t of await s.terms({kind})) out.push(JSON.stringify([t.kind, t.term, t.entityType, t.entityId]))
  return out.sort()
}

/**
 * The newest change per group and per person, from the history: every
 * version of a money record bumps the groups and people it and the version
 * before it name, at that version's time (plus a group's own change).
 */
export async function expectedActivity(s: Store) {
  const {entities, history} = await s.dump()
  const meIds = new Set(entities.filter(e => e.type === 'person' && (e.data as {isMe?: boolean}).isMe).map(e => e.id))
  const groupAt = new Map<string, number>()
  const personAt = new Map<string, number>()
  const names = (type: string, d: Record<string, unknown>) =>
    type === 'expense' ? [...Object.keys((d.payers ?? {}) as object), ...Object.keys((d.shares ?? {}) as object)] : [d.from as string, d.to as string]
  const bump = (type: string, d: Record<string, unknown> | undefined, at: number) => {
    if (!d) return
    const g = d.groupId as string | null
    if (g) groupAt.set(g, Math.max(groupAt.get(g) ?? 0, at))
    // Only a record I am on makes a friend active (audit m20).
    const on = names(type, d)
    if (on.some(p => meIds.has(p))) for (const p of on) personAt.set(p, Math.max(personAt.get(p) ?? 0, at))
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
  // A comment (or its edit or delete) makes the record it is about active at its last change (owner 199).
  const records = new Map(entities.filter(e => MONEY.includes(e.type)).map(e => [`${e.type}:${e.id}`, e]))
  for (const c of entities.filter(e => e.type === 'comment')) {
    const d = c.data as {targetType?: string; targetId?: string}
    const target = records.get(`${d.targetType}:${d.targetId}`)
    if (target) bump(target.type, target.data as Record<string, unknown>, c.updatedAt)
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
