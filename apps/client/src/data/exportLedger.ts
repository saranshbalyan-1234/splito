import {
  buildStatement,
  type CurrencyCode,
  reconcileStatement,
  type Statement,
  type StatementFilter,
  type StatementInput,
} from '@splito/domain'
import {
  type Entity,
  friendOpenBalances,
  listOpenDisputes,
  type Expense,
  type Key,
  type Repayment,
  type Store,
  toExpenseRecord,
  toRepaymentRecord,
  toWriteOffRecord,
  type WriteOff,
} from '@splito/sync'

/** How many rows one index read takes. */
const PAGE = 400

/** Every row of one money store up to `to`, in index order, by cursor (an export is the one place that reads a ledger through). */
async function* ledgerRows<T>(
  store: Store,
  type: 'expense' | 'repayment' | 'writeoff',
  groupId: string | null | undefined,
  to: string | null | undefined,
): AsyncGenerator<Entity<T>> {
  const index = groupId ? (type === 'expense' ? 'byGroupDate' : 'byGroup') : 'byDate'
  let after: Key | null = null
  do {
    // full-read-ok: export reads the ledger on purpose, through the group/date index and bounded above by the end date, a page at a time
    const page: Awaited<ReturnType<Store['page']>> = await store.page<T>(type, {
      index,
      eq: groupId ? [groupId] : undefined,
      max: to ?? undefined,
      after,
      limit: PAGE,
    })
    yield* page.items as Entity<T>[]
    after = page.next
  } while (after)
}

/**
 * The statement behind an export: the records that match the filter, read by
 * index from the group (or all dates) up to the end date, then built by the
 * domain. A friend's statement is reconciled with the balance the app shows,
 * so its closing line is exactly that. `today` is the person's own today.
 */
export async function loadStatement(store: Store, me: string, filter: StatementFilter, today: string): Promise<Statement> {
  const inputs: StatementInput[] = []
  const {groupId, to} = filter
  for await (const e of ledgerRows<Expense>(store, 'expense', groupId, to))
    if (!e.deleted) inputs.push({record: toExpenseRecord(e), title: e.data.title, note: e.data.notes, createdAt: e.createdAt})
  for await (const e of ledgerRows<Repayment>(store, 'repayment', groupId, to))
    if (!e.deleted) inputs.push({record: toRepaymentRecord(e), title: '', note: e.data.note, createdAt: e.createdAt})
  for await (const e of ledgerRows<WriteOff>(store, 'writeoff', groupId, to))
    if (!e.deleted) inputs.push({record: toWriteOffRecord(e), title: '', note: e.data.note, createdAt: e.createdAt})
  const statement = buildStatement(inputs, me, filter)
  // A friend's statement that runs up to now closes on the figure their page shows (an earlier end date is that day's balance, not today's).
  if (!filter.personId || filter.groupId || (filter.to && filter.to < today)) return statement
  const open = await friendOpenBalances(store, me, filter.personId)
  const onScreen: Record<CurrencyCode, bigint> = Object.fromEntries(Object.entries(open).map(([c, b]) => [c, b.total]))
  return reconcileStatement(statement, filter.currency ? pick(onScreen, filter.currency) : onScreen)
}

const pick = (o: Record<CurrencyCode, bigint>, c: CurrencyCode) => (c in o ? {[c]: o[c]!} : {})

/** The records with an open dispute or hold, by id: `dispute` wins over `hold` (the CSV's dispute column, F-1210). */
export async function loadDisputeMarks(store: Store): Promise<Map<string, 'dispute' | 'hold'>> {
  const marks = new Map<string, 'dispute' | 'hold'>()
  let after: Key | null = null
  do {
    const page: Awaited<ReturnType<typeof listOpenDisputes>> = await listOpenDisputes(store, {after})
    for (const d of page.items) if (marks.get(d.data.targetId) !== 'dispute') marks.set(d.data.targetId, d.data.kind)
    after = page.next
  } while (after)
  return marks
}
