import {useMemo} from 'react'
import {
  buildSearchIndex,
  DEFAULT_CATEGORIES,
  type Expense,
  type Group,
  type Person,
} from '@splito/sync'

import {useEntities, usePref} from '#/data/hooks'

/**
 * The search index, rebuilt only when expenses, people, groups or category
 * names change (about 12 ms for 2,000 expenses), so a keystroke only looks
 * things up. Undefined until the store has loaded.
 */
export function useSearchIndex() {
  const expenses = useEntities<Expense>('expense')
  const people = useEntities<Person>('person')
  const groups = useEntities<Group>('group')
  const [categories = DEFAULT_CATEGORIES] = usePref('categories')

  /* Explicit: the index is the expensive part and must survive every keystroke's render. */
  const index = useMemo(
    () =>
      expenses && people && groups
        ? buildSearchIndex({expenses, people, groups, categories})
        : undefined,
    [expenses, people, groups, categories],
  )
  const names = useMemo(
    () => new Map(people?.map(p => [p.id, p.data.name])),
    [people],
  )
  const groupNames = useMemo(
    () => new Map(groups?.map(g => [g.id, g.data.name])),
    [groups],
  )
  return {index, names, groupNames}
}
