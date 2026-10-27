import {type ExpenseRecord, type LedgerRecord, type RepaymentRecord, type WriteOffRecord} from '@splito/domain'

import {BIN_TYPES, type BinType, type Expense, type Group, type Purged, type Repayment, type WriteOff} from './mutations'
import {DAY_MS, MAX_BIN_DAYS, purgeAfterOf} from './bin'
import {type Key} from './schema'
import {type Page, type Store} from './store'
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

/** One item in Recently deleted. A deleted group is one item; the records it took with it are not listed apart. */
export type BinItem = {deletedAt: number; deletedBy: string; purgeAfter: number} & (
  | {type: 'expense'; entity: Entity<Expense>}
  | {type: 'repayment'; entity: Entity<Repayment>}
  | {type: 'writeoff'; entity: Entity<WriteOff>}
  | {type: 'group'; entity: Entity<Group>}
)


/**
 * Recently deleted: tombstoned expenses, payments, write-offs and groups not yet past their own `purgeAfter`
 * (decision 102: stamped when they were deleted, so changing `history.binDays` later never moves them) and not
 * deleted forever, newest first, each with who deleted it (from its history). `days` is the setting now: it
 * only dates a tombstone from before the rule that has no `purgeAfter`, and that date is written down here,
 * quietly (same version and time, no history or op), the first time such a row is read. Older tombstones are
 * only out of the list: they stay in the store and its audit trail.
 */
export async function loadBin(store: Store, now: number, days: number): Promise<BinItem[]> {
  // No tombstone outlives the longest choice, so a year back reads every item that can still be listed.
  const since = now - MAX_BIN_DAYS * DAY_MS
  const items: BinItem[] = []
  const legacy: Array<{type: BinType | 'group'; id: string}> = []
  const consider = async (type: BinType | 'group', entity: Entity<Purged>) => {
    // A record a group's deletion took is part of the group's entry (F-615).
    if (entity.data.purgedAt !== undefined || entity.data.deletedWithGroup !== undefined) return
    if (entity.data.purgeAfter === undefined) legacy.push({type, id: entity.id})
    const purgeAfter = purgeAfterOf(entity, days)
    if (purgeAfter <= now) return
    const last = (await store.history(type, entity.id)).at(-1)
    items.push({type, entity, deletedAt: entity.updatedAt, deletedBy: last?.actor ?? '', purgeAfter} as BinItem)
  }
  for (const type of BIN_TYPES) {
    // `byDeleted` is [deleted, updatedAt, id]: this reads only tombstones from the last year.
    let after: Key | null = null
    do {
      const page: Page<Entity<Purged>> = await store.page<Purged>(type, {index: 'byDeleted', eq: [1], min: since, after, limit: 100})
      for (const entity of page.items) await consider(type, entity)
      after = page.next
    } while (after)
  }
  // ponytail: groups have no tombstone index; the store is small (about 100 rows), so one read.
  for (const entity of await store.getAll<Group & Purged>('group')) if (entity.deleted && entity.updatedAt >= since) await consider('group', entity)
  if (legacy.length > 0) {
    await store.transaction(async tx => {
      for (const {type, id} of legacy) {
        const row = await tx.get<Purged>(type, id)
        if (!row?.deleted || row.data.purgeAfter !== undefined) continue
        await tx.put({...row, data: {...row.data, purgeAfter: purgeAfterOf(row, days)}})
      }
    })
  }
  return items.sort((x, y) => y.deletedAt - x.deletedAt || (x.entity.id < y.entity.id ? -1 : 1))
}

export type SyncStatus = 'Saved on this device' | 'Waiting for connection' | 'Syncing' | 'Synced' | 'Needs attention'

/** M1 has no server, so anything with a pending op is only saved locally. */
export async function syncStatus(store: Store, entityId: string): Promise<SyncStatus> {
  return (await store.outbox()).some(o => o.entityId === entityId) ? 'Saved on this device' : 'Synced'
}
