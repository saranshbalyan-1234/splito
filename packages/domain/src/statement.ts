import {type CurrencyCode} from './currency'
import {type LocalDate} from './date'
import {type LedgerRecord, pairBalance, recordEffects} from './ledger'

/*
 * Statements (F-2007): the expenses, payments and write-offs behind an
 * export, oldest first, each with its effect on my balance and a running
 * balance per currency. Currencies are never mixed. The running balance uses
 * the same per-record effects the stored balances are built from, so it ends
 * where the screens do.
 */

/** A ledger record with the text a statement shows. */
export interface StatementInput {
  record: LedgerRecord
  title: string
  note: string
  /** Epoch ms; orders records of the same day. */
  createdAt: number
}

export interface StatementFilter {
  /** Inclusive; the balance before it becomes the opening balance. */
  from?: LocalDate | null
  to?: LocalDate | null
  /** Only this group's records. */
  groupId?: string | null
  /** Only what is between me and this person. */
  personId?: string | null
  /** Only this currency. */
  currency?: CurrencyCode | null
}

export interface StatementRow {
  id: string
  kind: LedgerRecord['kind']
  date: LocalDate
  title: string
  note: string
  groupId: string | null
  currency: CurrencyCode
  record: LedgerRecord
  /** The expense total, or the amount that was paid or forgiven. */
  amount: bigint
  /** What I paid in it (an expense's payer share, or a payment I made). */
  paid: bigint
  /** My share of an expense (0 for payments). */
  share: bigint
  /** Its effect on my balance (> 0: I am owed more). */
  effect: bigint
  /** My balance in this currency after it. */
  balance: bigint
}

export interface Statement {
  me: string
  filter: StatementFilter
  rows: StatementRow[]
  /** Balance per currency before the first row (zero without a start date). */
  opening: Record<CurrencyCode, bigint>
  /** Balance per currency after the last row. */
  closing: Record<CurrencyCode, bigint>
  /** Per currency, what `reconcileStatement` had to add to match the app. */
  adjustments: Record<CurrencyCode, bigint>
  /** Currencies that appear, sorted. */
  currencies: CurrencyCode[]
}

const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

function involves(r: LedgerRecord, who: string): boolean {
  return r.kind === 'expense' ? who in r.payers || who in r.shares : r.from === who || r.to === who
}

function effectOf(r: LedgerRecord, me: string, personId: string | null | undefined): bigint {
  return personId ? pairBalance([r], me, personId) : recordEffects(r).net.reduce((sum, n) => (n.person === me ? sum + n.amount : sum), 0n)
}

/**
 * The statement for `me` over the records that match `filter`. A person
 * statement keeps only records between the two of them; a group statement
 * keeps every record of the group, mine or not; otherwise only records I am in.
 */
export function buildStatement(inputs: readonly StatementInput[], me: string, filter: StatementFilter): Statement {
  const keep = inputs.filter(({record: r}) => {
    if (r.deleted) return false
    if (filter.currency && r.currency !== filter.currency) return false
    if (filter.groupId && r.groupId !== filter.groupId) return false
    if (filter.personId) return involves(r, me) && involves(r, filter.personId) && effectOf(r, me, filter.personId) !== 0n
    return filter.groupId ? true : involves(r, me)
  })
  keep.sort((a, b) => cmp(a.record.date, b.record.date) || a.createdAt - b.createdAt || cmp(a.record.id, b.record.id))

  const balance: Record<CurrencyCode, bigint> = {}
  const opening: Record<CurrencyCode, bigint> = {}
  const rows: StatementRow[] = []
  const seen = new Set<CurrencyCode>()
  for (const {record: r, title, note} of keep) {
    const effect = effectOf(r, me, filter.personId)
    balance[r.currency] = (balance[r.currency] ?? 0n) + effect
    if (filter.from && r.date < filter.from) {
      opening[r.currency] = balance[r.currency]!
      continue
    }
    if (filter.to && r.date > filter.to) continue
    // The balance of a currency just before its first row in range.
    if (!seen.has(r.currency)) {
      seen.add(r.currency)
      opening[r.currency] = balance[r.currency]! - effect
    }
    const isExpense = r.kind === 'expense'
    rows.push({
      id: r.id,
      kind: r.kind,
      date: r.date,
      title,
      note,
      groupId: r.groupId,
      currency: r.currency,
      record: r,
      amount: isExpense ? r.total : r.amount,
      paid: isExpense ? (r.payers[me] ?? 0n) : r.from === me ? r.amount : 0n,
      share: isExpense ? (r.shares[me] ?? 0n) : 0n,
      effect,
      balance: balance[r.currency]!,
    })
  }
  // Currencies with rows close at their last row; a currency that only has earlier records closes at its opening balance.
  const closing: Record<CurrencyCode, bigint> = {}
  for (const row of rows) closing[row.currency] = row.balance
  for (const [c, b] of Object.entries(opening)) closing[c] ??= b
  return {me, filter, rows, opening, closing, adjustments: {}, currencies: Object.keys(closing).sort()}
}

/**
 * Makes the closing balance equal what the app shows: where a group settles
 * through its own plan, a friend's balance can differ from the sum of the
 * records, and one adjustment per currency says so instead of hiding it.
 */
export function reconcileStatement(st: Statement, onScreen: Record<CurrencyCode, bigint>): Statement {
  const adjustments: Record<CurrencyCode, bigint> = {}
  const closing = {...st.closing}
  for (const c of new Set([...Object.keys(st.closing), ...Object.keys(onScreen)])) {
    const diff = (onScreen[c] ?? 0n) - (st.closing[c] ?? 0n)
    if (diff === 0n) continue
    adjustments[c] = diff
    closing[c] = onScreen[c] ?? 0n
  }
  return {...st, closing, adjustments, currencies: Object.keys(closing).sort()}
}
