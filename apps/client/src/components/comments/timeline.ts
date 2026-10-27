import {type Comment, type Entity} from '@splito/sync'

/** A history line on an expense, as the timeline needs it: when, and a stable key. */
export interface TimelineLine {
  key: string
  at: number
}

export type TimelineItem<H extends TimelineLine> =
  | {kind: 'comment'; key: string; at: number; comment: Entity<Comment>}
  | {kind: 'history'; key: string; at: number; line: H}
  | {kind: 'divider'; key: string; at: number}

/**
 * One timeline of an expense page (F-1204 acceptance 5): comments and edit-history
 * lines in time order, oldest first. Both lists come from index reads, `byTarget`
 * and the history's `byEntity`, so nothing here scans a store.
 *
 * - `showHistory` off: only comments.
 * - `hasEarlier`: older comments are not loaded yet, so history lines older than the
 *   oldest loaded comment wait too (they would otherwise float above a gap).
 * - Ties put the history line first: an edit happened before the talk about it.
 */
export function mergeTimeline<H extends TimelineLine>(
  comments: readonly Entity<Comment>[],
  history: readonly H[],
  {showHistory, hasEarlier}: {showHistory: boolean; hasEarlier: boolean},
): Array<Exclude<TimelineItem<H>, {kind: 'divider'}>> {
  const floor =
    hasEarlier && comments.length > 0 ? comments[0]!.createdAt : -Infinity
  const items: Array<Exclude<TimelineItem<H>, {kind: 'divider'}>> =
    comments.map(comment => ({
      kind: 'comment',
      key: comment.id,
      at: comment.createdAt,
      comment,
    }))
  if (showHistory)
    for (const line of history)
      if (line.at >= floor)
        items.push({kind: 'history', key: line.key, at: line.at, line})
  return items.sort(
    (x, y) =>
      x.at - y.at ||
      (x.kind === y.kind ? 0 : x.kind === 'history' ? -1 : 1) ||
      (x.key < y.key ? -1 : x.key > y.key ? 1 : 0),
  )
}

/** The local calendar day of an instant in a time zone, e.g. `2026-10-27`. */
export function dayKey(at: number, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at)
}

/** Puts a Bluesky DM date divider before the first item of each local day. */
export function withDividers<H extends TimelineLine>(
  items: ReadonlyArray<Exclude<TimelineItem<H>, {kind: 'divider'}>>,
  timeZone: string,
): TimelineItem<H>[] {
  const out: TimelineItem<H>[] = []
  let day = ''
  for (const item of items) {
    const d = dayKey(item.at, timeZone)
    if (d !== day) out.push({kind: 'divider', key: `divider:${d}`, at: item.at})
    day = d
    out.push(item)
  }
  return out
}
