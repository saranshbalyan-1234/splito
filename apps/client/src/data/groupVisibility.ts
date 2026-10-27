import {useLingui} from '@lingui/react/macro'
import {type Entity, type Group, isGroupInactive} from '@splito/sync'

import {usePref} from '#/data/hooks'

/** The groups I have hidden from my own lists (decision 89): personal, from the account preference `groups.hidden`. */
export function useHiddenGroups(): ReadonlySet<string> {
  const [ids = []] = usePref('groups.hidden')
  return new Set(ids)
}

/**
 * Group names for the chips behind a balance: "Goa · Inactive", "Goa · Hidden". Money is never hidden, so an
 * inactive or hidden group's balance still counts and its chip says why it is out of the lists.
 */
export function useGroupChipNames(groups: Entity<Group>[] | undefined): Map<string, string> {
  const {t: l} = useLingui()
  const hidden = useHiddenGroups()
  return new Map(
    (groups ?? []).map(g => [
      g.id,
      isGroupInactive(g.data)
        ? l`${g.data.name} · Inactive`
        : hidden.has(g.id)
          ? l`${g.data.name} · Hidden`
          : g.data.name,
    ]),
  )
}
