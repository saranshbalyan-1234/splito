import {type ExpenseRecord, type LedgerRecord, type RepaymentRecord, type WriteOffRecord} from '@splito/domain'

import {type Expense, type Repayment, type WriteOff} from './mutations'
import {type Store} from './store'
import {type Entity} from './types'

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

export const toWriteOffRecord = (e: Entity<WriteOff>): WriteOffRecord => ({...toRepaymentRecord(e), kind: 'writeoff'})

/**
 * Every expense, repayment and write-off, tombstones included (flagged `deleted`).
 * Reads the whole ledger: for export, maintenance and tests only, never a hot
 * path (the architecture rule test keeps it out of screens and hooks).
 */
// full-read-ok: export, maintenance and tests read the whole ledger by design
export async function loadLedger(store: Store): Promise<LedgerRecord[]> {
  // full-read-ok: the three reads below are that same whole-ledger read
  const expenses = await store.getAll<Expense>('expense')
  const repayments = await store.getAll<Repayment>('repayment')
  const writeOffs = await store.getAll<WriteOff>('writeoff')
  return [...expenses.map(toExpenseRecord), ...repayments.map(toRepaymentRecord), ...writeOffs.map(toWriteOffRecord)]
}

/** One dated entry of a person's or a group's history: an expense, a payment or a write-off. */
export type HistoryEntry =
  | {kind: 'expense'; entity: Entity<Expense>}
  | {kind: 'repayment'; entity: Entity<Repayment>}
  | {kind: 'writeoff'; entity: Entity<WriteOff>}

export type SyncStatus = 'Saved on this device' | 'Waiting for connection' | 'Syncing' | 'Synced' | 'Needs attention'

/** M1 has no server, so anything with a pending op is only saved locally. */
export async function syncStatus(store: Store, entityId: string): Promise<SyncStatus> {
  return (await store.outbox()).some(o => o.entityId === entityId) ? 'Saved on this device' : 'Synced'
}
