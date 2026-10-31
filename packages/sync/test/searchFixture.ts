import {type Expense} from '../src/mutations'
import {type Store} from '../src/store'
import {type Entity} from '../src/types'

/* Rows go in through the store's own transaction, so the search keys are the ones the app keeps. Later-created rows have later `createdAt`. */
let clock = 0
export const resetClock = () => {
  clock = 0
}

export const entity = <T>(type: Entity['type'], id: string, data: T, deleted = false): Entity<T> => ({
  type,
  id,
  data,
  version: 1,
  deleted,
  createdAt: ++clock,
  updatedAt: clock,
  syncStatus: 'local',
  serverVersion: null,
  syncedAt: null,
  syncError: null,
})

export async function put(store: Store, rows: Array<Entity<unknown>>) {
  await store.transaction(async tx => {
    for (const r of rows) await tx.put(r)
  })
}

export function expense(id: string, over: Partial<Expense>): Entity<Expense> {
  return entity<Expense>('expense', id, {
    title: 'Something',
    groupId: null,
    currency: 'INR',
    total: 10000n,
    payers: {me: 10000n},
    split: {mode: 'equal', participants: ['me', 'riya']},
    shares: {me: 5000n, riya: 5000n},
    date: '2026-01-01',
    tz: 'Asia/Kolkata',
    category: 'food',
    notes: '',
    ...over,
  })
}
