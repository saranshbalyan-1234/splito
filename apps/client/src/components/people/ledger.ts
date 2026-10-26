import {
  decimalMark,
  DomainError,
  evaluateAmount,
  getCurrency,
  groupMemberNet,
  type LocalDate,
  pairBalance,
  toDecimalString,
} from '@splito/domain'
import {
  type Entity,
  type Expense,
  type Repayment,
  toExpenseRecord,
  toRepaymentRecord,
  toWriteOffRecord,
  type WriteOff,
} from '@splito/sync'

/** One dated entry of a person's or a group's history. */
export type HistoryEntry =
  | {kind: 'expense'; entity: Entity<Expense>}
  | {kind: 'repayment'; entity: Entity<Repayment>}
  | {kind: 'writeoff'; entity: Entity<WriteOff>}

/** History rows with a month heading before each new month. */
export type HistoryItem =
  | {type: 'month'; key: string; month: string}
  | {type: 'entry'; key: string; entry: HistoryEntry}

/** Live expenses, repayments and write-offs as one list, newest first. */
export function toHistory(
  expenses: Entity<Expense>[],
  repayments: Entity<Repayment>[],
  writeOffs: Entity<WriteOff>[] = [],
): HistoryEntry[] {
  return [
    ...expenses.map(entity => ({kind: 'expense' as const, entity})),
    ...repayments.map(entity => ({kind: 'repayment' as const, entity})),
    ...writeOffs.map(entity => ({kind: 'writeoff' as const, entity})),
  ].sort(
    (x, y) =>
      y.entity.data.date.localeCompare(x.entity.data.date) ||
      y.entity.updatedAt - x.entity.updatedAt,
  )
}

/** Inserts a month heading (`YYYY-MM`) before each month's first entry. */
export function withMonths(entries: HistoryEntry[]): HistoryItem[] {
  const items: HistoryItem[] = []
  let month = ''
  for (const entry of entries) {
    const m = entry.entity.data.date.slice(0, 7)
    if (m !== month) {
      month = m
      items.push({type: 'month', key: `month-${m}`, month: m})
    }
    items.push({type: 'entry', key: entry.entity.id, entry})
  }
  return items
}

export function toRecord(entry: HistoryEntry) {
  return entry.kind === 'expense'
    ? toExpenseRecord(entry.entity)
    : entry.kind === 'writeoff'
      ? toWriteOffRecord(entry.entity)
      : toRepaymentRecord(entry.entity)
}

/** Whether an entry moves money between me and `personId`. */
export function involvesPair(
  entry: HistoryEntry,
  me: string,
  personId: string,
) {
  if (entry.kind !== 'expense') {
    const {from, to} = entry.entity.data
    return (from === me && to === personId) || (from === personId && to === me)
  }
  const {payers, shares} = entry.entity.data
  const people = new Set([...Object.keys(payers), ...Object.keys(shares)])
  return people.has(me) && people.has(personId)
}

/** Effect of one entry on my balance with a person (> 0: they owe me more). */
export function effectWithPerson(
  entry: HistoryEntry,
  me: string,
  personId: string,
) {
  return pairBalance([toRecord(entry)], me, personId)
}

/** Effect of one group entry on my net in that group (> 0: I lent). */
export function effectInGroup(
  entry: HistoryEntry,
  me: string,
  groupId: string,
) {
  return groupMemberNet(
    [toRecord(entry)],
    groupId,
    entry.entity.data.currency,
    me,
  )
}

export {balanceParts, partsOwedBy} from '@splito/domain'

/** A local `YYYY-MM-DD` (or `YYYY-MM`) at UTC midnight, so formatting never shifts the day. */
export function utcDate(d: string) {
  return new Date(`${d.length === 7 ? `${d}-01` : d}T00:00:00Z`)
}

/** Today's calendar date where the user is, plus that IANA zone. */
export function todayLocal(): {date: LocalDate; tz: string} {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  // en-CA formats as YYYY-MM-DD.
  const date = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
  return {date, tz}
}

/**
 * Typed amount -> minor units, read exactly as the expense composer reads
 * it (`evaluateAmount` with the locale's decimal mark): spaces and grouping
 * marks are ignored, "1,200" is 1200 and "12,50" is 12.50. Only digits and
 * marks - no sums, no sign.
 */
export function parseTypedAmount(
  text: string,
  currency: string,
  locale: string,
) {
  if (!/^[\d.,\s\u00a0\u202f']+$/.test(text) || !/\d/.test(text))
    throw new DomainError('INVALID_AMOUNT')
  // A lone "1.234" in the locale's own mark reads as decimals here, as it always has; only the composer asks (F-310).
  return evaluateAmount(text, currency, decimalMark(locale), {
    reading: 'decimal',
  })
}

/** `upi://pay` deep link (NPCI UPI linking spec): payee VPA, name, amount in rupees, INR. */
export function upiPayUrl({
  upiId,
  name,
  amount,
}: {
  upiId: string
  name: string
  amount: bigint
}) {
  const q = [
    ['pa', upiId],
    ['pn', name],
    ['am', toDecimalString(amount, 2)],
    ['cu', 'INR'],
    ['tn', 'Splito'],
  ]
    .map(([k, v]) => `${k}=${encodeURIComponent(v!)}`)
    .join('&')
  return `upi://pay?${q}`
}

/** A currency's name in the UI language (Intl), or the catalog's English name where Intl lacks it. */
export function currencyName(code: string, locale: string): string {
  try {
    return (
      new Intl.DisplayNames([locale], {type: 'currency'}).of(code) ??
      getCurrency(code).name
    )
  } catch {
    return getCurrency(code).name
  }
}
