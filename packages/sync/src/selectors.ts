import type {ExpenseRecord, LedgerRecord} from '@splito/domain'

import type {Expense} from './mutations'
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

export async function loadLedger(store: Store): Promise<LedgerRecord[]> {
  return (await store.getAll<Expense>('expense')).map(toExpenseRecord)
}

export type SyncStatus = 'Saved on this device' | 'Waiting for connection' | 'Syncing' | 'Synced' | 'Needs attention'

/** M1 has no server, so anything with a pending op is only saved locally. */
export async function syncStatus(store: Store, entityId: string): Promise<SyncStatus> {
  return (await store.outbox()).some(o => o.entityId === entityId) ? 'Saved on this device' : 'Synced'
}
