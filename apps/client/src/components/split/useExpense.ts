import {type Entity, type Expense, type HistoryRow} from '@splito/sync'

import {useAllEntities, useHistory} from '#/data/hooks'

const NO_HISTORY: HistoryRow[] = []

/**
 * One expense, live: undefined while loading, null when no such expense,
 * otherwise the entity (tombstoned ones too, flagged `deleted`), plus its
 * stored versions, oldest first. Shares the expense list with every other
 * reader; the history re-reads only when this expense changes.
 */
export function useExpense(id: string): {
  expense: Entity<Expense> | null | undefined
  history: HistoryRow[]
} {
  const all = useAllEntities<Expense>('expense')
  const history = useHistory('expense', id)
  // As before, nothing shows until both reads are in.
  if (!all || !history) return {expense: undefined, history: NO_HISTORY}
  return {expense: all.find(e => e.id === id) ?? null, history}
}
