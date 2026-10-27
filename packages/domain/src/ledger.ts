import {type CurrencyCode} from './currency'
import {type LocalDate} from './date'
import {DomainError} from './errors'
import {directPlan, NO_RULES, planSettlement, type SettlementRules} from './settlement'

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

/**
 * A debt let go ("Call it even"): `from` owed `to` and `to` forgave it. It
 * moves balances exactly like a repayment but is its own kind, so it is never
 * shown or counted as a payment, and never as spending.
 */
export interface WriteOffRecord {
  kind: 'writeoff'
  id: string
  groupId: string | null
  currency: CurrencyCode
  /** Who owed (and is forgiven). */
  from: string
  /** Who was owed (and forgives). */
  to: string
  amount: bigint
  date: LocalDate
  deleted: boolean
}

export type LedgerRecord = ExpenseRecord | RepaymentRecord | WriteOffRecord

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

/** One debt: `debtor` owes `creditor` `amount` (> 0) in the record's currency. */
export interface Debt {
  debtor: string
  creditor: string
  amount: bigint
}

/**
 * The direct debts one expense creates. Pairs come from each person's net in
 * the expense (paid - share), so someone who paid exactly their share owes
 * nobody and no per-payer rounding leaves 1-minor-unit residues. One creditor
 * (the usual single payer) needs no plan; several use the exact direct
 * settle-up plan.
 */
export function expenseDebts(r: Pick<ExpenseRecord, 'payers' | 'shares'>): Debt[] {
  const net: Record<string, bigint> = {}
  for (const [id, v] of Object.entries(r.payers)) net[id] = (net[id] ?? 0n) + v
  for (const [id, v] of Object.entries(r.shares)) net[id] = (net[id] ?? 0n) - v
  const creditors = Object.keys(net).filter(id => net[id]! > 0n)
  const transfers =
    creditors.length === 1
      ? Object.keys(net)
          .filter(id => net[id]! < 0n)
          .map(id => ({from: id, to: creditors[0]!, amount: -net[id]!}))
      : creditors.length === 0
        ? []
        : directTransfers(net)
  return transfers.map(t => ({debtor: t.from, creditor: t.to, amount: t.amount}))
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
    if (r.kind !== 'expense') {
      if (r.to === me) add(r.from, r.groupId, r.currency, -r.amount)
      else if (r.from === me) add(r.to, r.groupId, r.currency, r.amount)
      continue
    }
    for (const t of expenseDebts(r)) {
      if (t.creditor === me) add(t.debtor, r.groupId, r.currency, t.amount)
      else if (t.debtor === me) add(t.creditor, r.groupId, r.currency, -t.amount)
    }
  }

  return [...rows.values()]
    .filter(r => r.amount !== 0n)
    .sort((a, b) => cmp(a.person, b.person) || cmp(a.groupId ?? '', b.groupId ?? '') || cmp(a.currency, b.currency))
}

/**
 * What one live record does to the stored balances (the local database's
 * `balances` and `pair_balances` projections, ARCHITECTURE 9.8). `net` lists
 * one entry per payer, sharer, sender and receiver, as `groupNet` adds them;
 * `debts` is the pairwise view, kept for records outside groups only (inside
 * a group the plan over the group's net is the pairwise view).
 */
export interface RecordEffects {
  net: Array<{person: string; amount: bigint}>
  debts: Debt[]
}

export function recordEffects(r: LedgerRecord): RecordEffects {
  if (r.kind !== 'expense')
    return {
      net: [
        {person: r.from, amount: r.amount},
        {person: r.to, amount: -r.amount},
      ],
      // A payment from -> to lowers what `from` owes `to`: as a debt, `to` owes `from`.
      debts: r.groupId === null ? [{debtor: r.to, creditor: r.from, amount: r.amount}] : [],
    }
  return {
    net: [
      ...Object.entries(r.payers).map(([person, amount]) => ({person, amount})),
      ...Object.entries(r.shares).map(([person, amount]) => ({person, amount: -amount})),
    ],
    debts: r.groupId === null ? expenseDebts(r) : [],
  }
}

const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

function directTransfers(net: Record<string, bigint>) {
  const plan = planSettlement(net, NO_RULES, 'direct')
  return plan.status === 'ok' ? plan.transfers : []
}

/**
 * My balance with each person, per group and currency: the one source every
 * screen shows. Direct records count pair by pair (`pairwiseBalances`).
 * Inside a group, my rows are the transfers of the group's settle-up plan
 * (`directPlan` over `groupNet`: the group's rules, or no rules when those
 * leave no plan), so my group rows add up to my group net and recording the
 * plan clears People, the group and Settle up together.
 */
export function balanceRows(
  records: LedgerRecord[],
  me: string,
  rules: Record<string, SettlementRules | undefined> = {},
): BalanceRow[] {
  const direct = pairwiseBalances(
    records.filter(r => r.groupId === null),
    me,
  )
  const groupIds = new Set(records.flatMap(r => (r.groupId === null || r.deleted ? [] : [r.groupId])))
  const groupNets: Record<string, Record<CurrencyCode, Record<string, bigint>>> = {}
  for (const groupId of groupIds) groupNets[groupId] = groupNet(records, groupId)
  return balanceRowsFromNets(me, direct, groupNets, rules)
}

/**
 * `balanceRows` from stored sums instead of the ledger: `direct` is my rows
 * with each person outside groups (what the `pair_balances` projection
 * holds, > 0 they owe me) and `groupNets` each group's `groupNet` (what the
 * `balances` projection holds). Equal to `balanceRows` over the same records
 * (tested), so a screen reads O(rows shown), not the whole ledger.
 */
export function balanceRowsFromNets(
  me: string,
  direct: ReadonlyArray<BalanceRow>,
  groupNets: Record<string, Record<CurrencyCode, Record<string, bigint>>>,
  rules: Record<string, SettlementRules | undefined> = {},
): BalanceRow[] {
  const rows: BalanceRow[] = direct.filter(r => r.amount !== 0n).map(r => ({...r, groupId: null}))
  for (const groupId of Object.keys(groupNets).sort()) {
    for (const [currency, net] of Object.entries(groupNets[groupId]!).sort(([x], [y]) => cmp(x, y))) {
      if (!net[me]) continue
      for (const t of directPlan(net, rules[groupId] ?? NO_RULES).transfers) {
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

/**
 * The parts of a pair's balance in one currency that a write-off of `amount`
 * forgives (`parts` and the result are signed: > 0 they owe me, < 0 I owe
 * them). The whole balance (`amount` = |net|) clears every part, each in its
 * own direction, so the pair ends at zero in that currency. Less forgives
 * only in the net's direction, direct first, then each group, up to what is
 * owed there. When the parts net to zero (owed one way directly, the other
 * way in a group), the whole balance is 0 and clears every part (audit m7).
 * More than |net|, a negative amount, or nothing open is `INVALID_AMOUNT`.
 */
export function writeOffParts(parts: BalancePart[], amount: bigint): BalancePart[] {
  const live = [...parts.filter(p => p.groupId === null), ...parts.filter(p => p.groupId !== null)].filter(p => p.amount !== 0n)
  const net = live.reduce((s, p) => s + p.amount, 0n)
  const full = magnitude(net)
  if (live.length === 0 || amount < 0n || amount > full || (amount === 0n && full !== 0n)) throw new DomainError('INVALID_AMOUNT')
  if (amount === full) return live.map(p => ({...p}))
  const sign = net < 0n ? -1n : 1n
  const out: BalancePart[] = []
  let left = amount
  for (const p of live) {
    const owed = p.amount * sign
    if (left === 0n || owed <= 0n) continue
    const take = owed < left ? owed : left
    out.push({groupId: p.groupId, amount: take * sign})
    left -= take
  }
  return out
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
    if (r.kind !== 'expense') {
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

/** One person's balance in one currency: the net, and its direct and per-group parts. */
export type CurrencyBalance = PersonSummary['byCurrency'][CurrencyCode]

/**
 * What a balance's parts owe each way (both >= 0), never netted across
 * direct and groups (audit M10): owed directly 10 and owing 10 in a group is
 * owed 10, owe 10, not settled.
 */
export function balanceSides(c: Pick<CurrencyBalance, 'direct' | 'groups'>): {owed: bigint; owe: bigint} {
  let owed = 0n
  let owe = 0n
  for (const v of [c.direct, ...Object.values(c.groups)]) {
    if (v > 0n) owed += v
    else owe -= v
  }
  return {owed, owe}
}

/** Settled means every part is zero, not just the net (audit M10). */
export function isSettledBalance(c: Pick<CurrencyBalance, 'direct' | 'groups'>): boolean {
  const {owed, owe} = balanceSides(c)
  return owed === 0n && owe === 0n
}

/**
 * Per currency, sorted by code: totals across every person's balance, each
 * part in its own direction (`balanceSides`), as `groupTotals` does for
 * groups. Currencies are never mixed.
 */
export function balanceTotals(people: PersonSummary[]): CurrencyTotal[] {
  const totals = new Map<CurrencyCode, CurrencyTotal>()
  for (const p of people) {
    for (const [currency, c] of Object.entries(p.byCurrency)) {
      const t = totals.get(currency) ?? {currency, owed: 0n, owe: 0n, net: 0n}
      const {owed, owe} = balanceSides(c)
      t.owed += owed
      t.owe += owe
      t.net += c.total
      totals.set(currency, t)
    }
  }
  return [...totals.values()].sort((a, b) => cmp(a.currency, b.currency))
}

/**
 * Overview totals across groups (each `Record` is my net in one group, per
 * currency). Groups that owe me and groups I owe are summed apart, so a
 * group owing me 100 and one I owe 100 read "owed 100, owe 100", as People
 * does, never "settled". Currencies with nothing either way drop out.
 */
export function groupTotals(groups: ReadonlyArray<Record<CurrencyCode, bigint>>): CurrencyTotal[] {
  const totals = new Map<CurrencyCode, CurrencyTotal>()
  for (const g of groups) {
    for (const [currency, v] of Object.entries(g)) {
      const t = totals.get(currency) ?? {currency, owed: 0n, owe: 0n, net: 0n}
      if (v > 0n) t.owed += v
      else t.owe -= v
      t.net += v
      totals.set(currency, t)
    }
  }
  return [...totals.values()].filter(t => t.owed !== 0n || t.owe !== 0n).sort((a, b) => cmp(a.currency, b.currency))
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

/** What one expense means for `person`: paid minus share (> 0 lent, < 0 borrowed). */
export function personNet(record: Pick<ExpenseRecord, 'payers' | 'shares'>, person: string): bigint {
  return (record.payers[person] ?? 0n) - (record.shares[person] ?? 0n)
}

/** My balance with `person` from these records (> 0: they owe me); zero when the records don't involve them. */
export function pairBalance(records: LedgerRecord[], me: string, person: string): bigint {
  return pairwiseBalances(records, me).find(r => r.person === person)?.amount ?? 0n
}

/** One member's net in one group and currency (> 0: they lent); zero when they have none. */
export function groupMemberNet(records: LedgerRecord[], groupId: string, currency: CurrencyCode, person: string): bigint {
  return groupNet(records, groupId)[currency]?.[person] ?? 0n
}

/**
 * `groupNet` per currency (sorted by code) with every member listed, zero when
 * they have no records yet, so a settlement plan can route through them.
 */
export function memberNets(records: LedgerRecord[], groupId: string, members: string[]): Record<CurrencyCode, Record<string, bigint>> {
  return zeroFillNets(groupNet(records, groupId), members)
}

/** Per-currency nets (sorted by code) with every member listed, zero when they have none (the stored nets, or `groupNet`). */
export function zeroFillNets(nets: Record<CurrencyCode, Record<string, bigint>>, members: string[]): Record<CurrencyCode, Record<string, bigint>> {
  const zero = Object.fromEntries(members.map(m => [m, 0n]))
  return Object.fromEntries(
    Object.entries(nets)
      .sort(([x], [y]) => x.localeCompare(y))
      .map(([currency, net]) => [currency, {...zero, ...net}]),
  )
}

/**
 * My balance with a friend in one currency, part by part: direct, then each
 * group (> 0: they owe me). Zero parts are left out.
 */
export function balanceParts(c: {direct: bigint; groups: Record<string, bigint>}): BalancePart[] {
  return [{groupId: null, amount: c.direct}, ...Object.entries(c.groups).map(([groupId, amount]) => ({groupId, amount}))].filter(
    p => p.amount !== 0n,
  )
}

/** The parts a payment by me (or to me) settles: what the payer owes there, as amounts > 0. */
export function partsOwedBy(parts: BalancePart[], isPayerMe: boolean): BalancePart[] {
  return parts.map(p => ({groupId: p.groupId, amount: isPayerMe ? -p.amount : p.amount})).filter(p => p.amount > 0n)
}
