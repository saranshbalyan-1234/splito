import {type Entity, type Expense, type HistoryRow} from '@splito/sync'

import {useEntity, useHistory} from '#/data/hooks'

const NO_HISTORY: HistoryRow[] = []

/**
 * One expense, live: undefined while loading, null when no such expense,
 * otherwise the entity (tombstoned ones too, flagged `deleted`), plus its
 * stored versions, oldest first. Reads that one row by id (never the expense
 * list); both re-read only when this expense changes.
 */
export function useExpense(id: string): {
  expense: Entity<Expense> | null | undefined
  history: HistoryRow[]
} {
  const expense = useEntity<Expense>('expense', id)
  const history = useHistory('expense', id)
  // As before, nothing shows until both reads are in.
  if (expense === undefined || !history) return {expense: undefined, history: NO_HISTORY}
  return {expense, history}
}
