import {useMemo} from 'react'
import {type Group, type Person} from '@splito/sync'

import {useAllEntities} from '#/data/hooks'

/**
 * The names a result row draws (people and groups are small stores, read
 * whole): the expenses themselves come from `useSearch`, which loads only
 * the rows a query matches. Undefined entries until the store has loaded.
 */
export function useSearchNames() {
  const people = useAllEntities<Person>('person')
  const groups = useAllEntities<Group>('group')
  const names = useMemo(
    () => new Map(people?.map(p => [p.id, p.data.name])),
    [people],
  )
  const groupNames = useMemo(
    () => new Map(groups?.map(g => [g.id, g.data.name])),
    [groups],
  )
  return {names, groupNames}
}
