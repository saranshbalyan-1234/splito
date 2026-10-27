import {useMemo} from 'react'
import {type MoneyType, setGroupHidden, setItemHidden} from '@splito/sync'

import {logger} from '#/logger'
import {useMutationCtx, usePref, useStore} from '#/data/hooks'

/**
 * Hiding deleted items (decisions 104 to 106): a deleted expense, payment, write-off or friend always shows, struck
 * through, until I hide it; groups hide at any time. Personal: only my account preferences change.
 */

/** The deleted items I have hidden, as one Set per change of the list (so memoised rows that take it are not redrawn every render). */
export function useHiddenItems(): ReadonlySet<string> {
  const [ids] = usePref('lists.hiddenItems')
  return useMemo(() => new Set(ids ?? []), [ids])
}

/** The one "Show hidden" switch of People, Groups, a group's Expenses and a person's history (default off, remembered). */
export function useShowHidden(): [boolean, (v: boolean) => Promise<void>] {
  const [value = false, set] = usePref('lists.showHidden')
  return [value, set]
}

/** Whether a row stays out of a list: hidden by me, and "Show hidden" is off. */
export const isOutOfList = (hidden: ReadonlySet<string>, id: string, showHidden: boolean) => !showHidden && hidden.has(id)

/** Hide / Unhide one deleted item (or a group), each with its error logged; the caller shows the Undo toast. */
export function useSetHidden() {
  const store = useStore()
  const ctx = useMutationCtx()
  return useMemo(
    () => ({
      async item(type: MoneyType | 'person', id: string, hidden: boolean) {
        try {
          await setItemHidden(store, ctx, type, id, hidden)
          return true
        } catch (e) {
          logger.error(e, {where: 'hiddenItems.item'})
          return false
        }
      },
      async group(id: string, hidden: boolean) {
        try {
          await setGroupHidden(store, ctx, id, hidden)
          return true
        } catch (e) {
          logger.error(e, {where: 'hiddenItems.group'})
          return false
        }
      },
    }),
    [store, ctx],
  )
}
