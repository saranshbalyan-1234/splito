import {allocate} from './allocate'
import type {CurrencyCode} from './currency'
import type {LocalDate} from './date'
import {planSettlement, type SettlementRules} from './settlement'

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

const NO_RULES: SettlementRules = {allowListOnly: false, edges: {}}

/**
 * My balance with each person, per group and currency: the one source every
 * screen shows. Direct records count pair by pair (`pairwiseBalances`).
 * Inside a group, my rows are the transfers of the group's settle-up plan
 * (`planSettlement` over `groupNet`, direct, the group's rules - or no rules
 * when those leave no plan), so my group rows add up to my group net and
 * recording the plan clears People, the group and Settle up together.
 */
export function balanceRows(
  records: LedgerRecord[],
  me: string,
  rules: Record<string, SettlementRules | undefined> = {},
): BalanceRow[] {
  const rows = pairwiseBalances(
    records.filter(r => r.groupId === null),
    me,
  )
  const groupIds = new Set(records.flatMap(r => (r.groupId === null || r.deleted ? [] : [r.groupId])))
  for (const groupId of [...groupIds].sort()) {
    for (const [currency, net] of Object.entries(groupNet(records, groupId)).sort(([x], [y]) => cmp(x, y))) {
      if (!net[me]) continue
      let plan = planSettlement(net, rules[groupId] ?? NO_RULES, 'direct')
      if (plan.status !== 'ok') plan = planSettlement(net, NO_RULES, 'direct')
      if (plan.status !== 'ok') continue
      for (const t of plan.transfers) {
        if (t.from === me) rows.push({person: t.to, groupId, currency, amount: -t.amount})
        else if (t.to === me) rows.push({person: t.from, groupId, currency, amount: t.amount})
      }
    }
  }
  return rows.sort((a, b) => cmp(a.person, b.person) || cmp(a.groupId ?? '', b.groupId ?? '') || cmp(a.currency, b.currency))
}

/** One part of a balance between two people: direct (`groupId` null) or one group's. */
export interface BalancePart {
  groupId: string | null
  amount: bigint
}

/**
 * Splits one payment across the parts of a balance it settles: direct
 * first, then each group in turn, each up to what is owed there in the
 * payment's direction (`owed`, amounts > 0). Anything over goes to direct.
 * Parts owed the other way are left alone, so debts are never netted
 * across groups (spec non-goal).
 */
export function splitPayment(amount: bigint, owed: BalancePart[]): BalancePart[] {
  const parts: BalancePart[] = []
  let left = amount
  for (const p of [...owed.filter(p => p.groupId === null), ...owed.filter(p => p.groupId !== null)]) {
    if (left <= 0n || p.amount <= 0n) continue
    const take = p.amount < left ? p.amount : left
    parts.push({groupId: p.groupId, amount: take})
    left -= take
  }
  if (left > 0n) {
    const direct = parts.find(p => p.groupId === null)
    if (direct) direct.amount += left
    else parts.unshift({groupId: null, amount: left})
  }
  return parts
}

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

/** What one expense does to one person's balance: paid minus share (> 0: they lent, < 0: they borrowed). */
export function expenseNet(e: Pick<ExpenseRecord, 'payers' | 'shares'>, person: string): bigint {
  return (e.payers[person] ?? 0n) - (e.shares[person] ?? 0n)
}

/** Absolute value of a minor-unit amount; screens show direction in words, not signs. */
export function magnitude(v: bigint): bigint {
  return v < 0n ? -v : v
}

export interface CurrencyTotal {
  currency: CurrencyCode
  /** What friends owe me (>= 0). */
  owed: bigint
  /** What I owe friends (>= 0). */
  owe: bigint
  /** owed - owe. */
  net: bigint
}

/** Per currency, sorted by code: totals across every person's balance. Currencies are never mixed. */
export function balanceTotals(people: PersonSummary[]): CurrencyTotal[] {
  const totals = new Map<CurrencyCode, CurrencyTotal>()
  for (const p of people) {
    for (const [currency, {total}] of Object.entries(p.byCurrency)) {
      const t = totals.get(currency) ?? {currency, owed: 0n, owe: 0n, net: 0n}
      if (total > 0n) t.owed += total
      else t.owe -= total
      t.net += total
      totals.set(currency, t)
    }
  }
  return [...totals.values()].sort((a, b) => cmp(a.currency, b.currency))
}

/** My net balance in each group, per currency (> 0: the group owes me). Direct rows are ignored. */
export function groupBalances(rows: BalanceRow[]): Record<string, Record<CurrencyCode, bigint>> {
  const out: Record<string, Record<CurrencyCode, bigint>> = {}
  for (const r of rows) {
    if (r.groupId === null) continue
    const g = (out[r.groupId] ??= {})
    g[r.currency] = (g[r.currency] ?? 0n) + r.amount
  }
  return out
}
