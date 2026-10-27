import {type Purged} from './mutations'
import {type Entity} from './types'

export const DAY_MS = 86_400_000

/** The longest `history.binDays` choice: no tombstone can outlive it, so it bounds every bin read. */
export const MAX_BIN_DAYS = 365

/**
 * When a tombstone leaves Recently deleted (decision 102): its own `purgeAfter`, stamped when it was deleted
 * from the setting of that day. A row deleted before the rule has none; it reads as `days` (the setting now)
 * after its deletion, and `loadBin` writes that down the first time it sees it.
 */
export function purgeAfterOf(e: Pick<Entity<Purged>, 'data' | 'updatedAt'>, days: number): number {
  return e.data.purgeAfter ?? e.updatedAt + days * DAY_MS
}
