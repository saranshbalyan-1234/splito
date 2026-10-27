import {type Entity, lastNudgeAt, remindersAbout, type Reminder, selfReminders, touches} from '@splito/sync'

import {useProjection} from '#/data/hooks'
import {type Query, shareRows} from '#/data/projections'

/*
 * Reads of the `reminders` store (F-1118, F-1119): always through its indexes (`byDue`, `byPerson`), never
 * the whole store, since every shared reminder adds a row. Shared live projections like every other read.
 */

const selfQuery: Query<Entity<Reminder>[]> = {
  key: 'reminders:self',
  isTouchedBy: change => touches(change, 'reminder'),
  loader: store => async (_change, prev) => shareRows(prev, await selfReminders(store)),
}

const aboutQueries = new Map<string, Query<Entity<Reminder>[]>>()
const aboutQuery = (personId: string): Query<Entity<Reminder>[]> => {
  let q = aboutQueries.get(personId)
  if (!q) {
    q = {
      key: `reminders:about:${personId}`,
      isTouchedBy: change => touches(change, 'reminder'),
      loader: store => async (_change, prev) => shareRows(prev, await remindersAbout(store, personId)),
    }
    aboutQueries.set(personId, q)
  }
  return q
}

const nudgeQueries = new Map<string, Query<number | null>>()
const nudgeQuery = (personId: string): Query<number | null> => {
  let q = nudgeQueries.get(personId)
  if (!q) {
    q = {key: `reminders:nudge:${personId}`, isTouchedBy: change => touches(change, 'reminder'), loader: store => () => lastNudgeAt(store, personId)}
    nudgeQueries.set(personId, q)
  }
  return q
}

/** Every live reminder I scheduled for myself, soonest first. Undefined while loading. */
export function useSelfReminders() {
  return useProjection(selfQuery)
}

/** The live reminders I scheduled about one friend. Undefined while loading. */
export function useRemindersAbout(personId: string) {
  return useProjection(aboutQuery(personId))
}

/** When I last shared a reminder with this friend (null: never). Undefined while loading. */
export function useLastNudge(personId: string) {
  return useProjection(nudgeQuery(personId))
}
