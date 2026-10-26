import {useEffect, useState} from 'react'
import {type Entity, type Expense, type HistoryRow} from '@splito/sync'

import {useStore} from '#/data/hooks'

/**
 * One expense, live: undefined while loading, null when no such expense,
 * otherwise the entity (tombstoned ones too, flagged `deleted`), plus its
 * stored versions, oldest first.
 */
export function useExpense(id: string): {
  expense: Entity<Expense> | null | undefined
  history: HistoryRow[]
} {
  const store = useStore()
  const [state, setState] = useState<{
    expense: Entity<Expense> | null | undefined
    history: HistoryRow[]
  }>({expense: undefined, history: []})
  useEffect(() => {
    let isCancelled = false
    const load = () =>
      void Promise.all([
        store.getAll<Expense>('expense'),
        store.history('expense', id),
      ]).then(([all, history]) => {
        if (isCancelled) return
        setState({
          expense: all.find(e => e.id === id) ?? null,
          history: [...history].sort((x, y) => x.version - y.version),
        })
      })
    load()
    const off = store.subscribe(load)
    return () => {
      isCancelled = true
      off()
    }
  }, [store, id])
  return state
}
