import type {ExpenseRecord, LedgerRecord, RepaymentRecord} from '@splito/domain'

import type {Expense, Repayment} from './mutations'
import type {Store} from './store'
import type {Entity} from './types'

export const toExpenseRecord = (e: Entity<Expense>): ExpenseRecord => ({
  kind: 'expense',
  id: e.id,
  groupId: e.data.groupId,
  currency: e.data.currency,
  total: e.data.total,
  payers: e.data.payers,
  shares: e.data.shares,
  date: e.data.date,
  deleted: e.deleted,
})

export const toRepaymentRecord = (e: Entity<Repayment>): RepaymentRecord => ({
  kind: 'repayment',
  id: e.id,
  groupId: e.data.groupId,
  currency: e.data.currency,
  from: e.data.from,
  to: e.data.to,
  amount: e.data.amount,
  date: e.data.date,
  deleted: e.deleted,
})

/** Every expense and repayment, tombstones included (flagged `deleted`). */
export async function loadLedger(store: Store): Promise<LedgerRecord[]> {
  const expenses = await store.getAll<Expense>('expense')
  const repayments = await store.getAll<Repayment>('repayment')
  return [...expenses.map(toExpenseRecord), ...repayments.map(toRepaymentRecord)]
}

export type SyncStatus = 'Saved on this device' | 'Waiting for connection' | 'Syncing' | 'Synced' | 'Needs attention'

/** M1 has no server, so anything with a pending op is only saved locally. */
export async function syncStatus(store: Store, entityId: string): Promise<SyncStatus> {
  return (await store.outbox()).some(o => o.entityId === entityId) ? 'Saved on this device' : 'Synced'
}
