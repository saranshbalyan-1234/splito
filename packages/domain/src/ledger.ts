import {allocate} from './allocate'
import type {CurrencyCode} from './currency'
import type {LocalDate} from './date'

export interface ExpenseRecord {
  kind: 'expense'
  id: string
  groupId: string | null
  currency: CurrencyCode
  total: bigint
  payers: Record<string, bigint>
  shares: Record<string, bigint>
  date: LocalDate
  deleted: boolean
}

export interface RepaymentRecord {
  kind: 'repayment'
  id: string
  groupId: string | null
  currency: CurrencyCode
  from: string
  to: string
  amount: bigint
  date: LocalDate
  deleted: boolean
}

export type LedgerRecord = ExpenseRecord | RepaymentRecord

/** amount > 0: person owes me. amount < 0: I owe person. */
export interface BalanceRow {
  person: string
  groupId: string | null
  currency: CurrencyCode
  amount: bigint
}

export interface PersonSummary {
  person: string
  byCurrency: Record<CurrencyCode, {total: bigint; direct: bigint; groups: Record<string, bigint>}>
}

export function pairwiseBalances(records: LedgerRecord[], me: string): BalanceRow[] {
  const rows = new Map<string, BalanceRow>()
  const add = (person: string, groupId: string | null, currency: string, amount: bigint) => {
    const key = JSON.stringify([person, groupId, currency])
    const row = rows.get(key) ?? {person, groupId, currency, amount: 0n}
    row.amount += amount
    rows.set(key, row)
  }

  for (const r of records) {
    if (r.deleted) continue
    if (r.kind === 'repayment') {
      if (r.to === me) add(r.from, r.groupId, r.currency, -r.amount)
      else if (r.from === me) add(r.to, r.groupId, r.currency, r.amount)
      continue
    }
    // Each participant owes the payers in proportion to what each payer paid.
    const payerWeights = Object.entries(r.payers)
      .filter(([, v]) => v !== 0n)
      .map(([id, v]) => ({id, weight: v < 0n ? -v : v}))
    for (const [p, share] of Object.entries(r.shares)) {
      if (share === 0n) continue
      for (const [q, debt] of Object.entries(allocate(share, payerWeights))) {
        if (p === q) continue
        if (q === me) add(p, r.groupId, r.currency, debt)
        else if (p === me) add(q, r.groupId, r.currency, -debt)
      }
    }
  }

  return [...rows.values()]
    .filter(r => r.amount !== 0n)
    .sort((a, b) => cmp(a.person, b.person) || cmp(a.groupId ?? '', b.groupId ?? '') || cmp(a.currency, b.currency))
}

const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

export function personSummary(rows: BalanceRow[], opts: {includeGroups: boolean}): PersonSummary[] {
  const people = new Map<string, PersonSummary>()
  for (const r of rows) {
    if (r.groupId !== null && !opts.includeGroups) continue
    const s = people.get(r.person) ?? {person: r.person, byCurrency: {}}
    const c = (s.byCurrency[r.currency] ??= {total: 0n, direct: 0n, groups: {}})
    c.total += r.amount
    if (r.groupId === null) c.direct += r.amount
    else c.groups[r.groupId] = (c.groups[r.groupId] ?? 0n) + r.amount
    people.set(r.person, s)
  }
  return [...people.values()].sort((a, b) => cmp(a.person, b.person))
}

/** Per currency, each member's paid minus owed (plus repayments sent, minus received). Sums to 0. */
export function groupNet(records: LedgerRecord[], groupId: string): Record<CurrencyCode, Record<string, bigint>> {
  const net: Record<CurrencyCode, Record<string, bigint>> = {}
  const add = (cur: string, who: string, v: bigint) => {
    const m = (net[cur] ??= {})
    m[who] = (m[who] ?? 0n) + v
  }
  for (const r of records) {
    if (r.deleted || r.groupId !== groupId) continue
    if (r.kind === 'repayment') {
      add(r.currency, r.from, r.amount)
      add(r.currency, r.to, -r.amount)
    } else {
      for (const [who, v] of Object.entries(r.payers)) add(r.currency, who, v)
      for (const [who, v] of Object.entries(r.shares)) add(r.currency, who, -v)
    }
  }
  return net
}
