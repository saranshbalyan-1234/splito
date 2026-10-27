import {type HistoryEntry} from '@splito/sync'

export type {HistoryEntry}

/** How many rows one index read asks for, and how many entries "more" adds. */
export const PAGE = 30

/**
 * An ordered source of entries, newest date first, read a page at a time
 * (one index of one store). `items` holds what has been read so far.
 */
export type HistoryStream = {
  items: HistoryEntry[]
  /** True when the index has nothing further. */
  isDone: boolean
  /** Reads until `want` more entries were added or the stream is done. */
  read(want: number): Promise<void>
}

const dateOf = (e: HistoryEntry) => e.entity.data.date

/** The list order: date, then the time of the last change, newest first; the id settles ties. */
function newestFirst(x: HistoryEntry, y: HistoryEntry) {
  const dx = dateOf(x)
  const dy = dateOf(y)
  if (dx !== dy) return dx < dy ? 1 : -1
  if (x.entity.updatedAt !== y.entity.updatedAt) return y.entity.updatedAt - x.entity.updatedAt
  return x.entity.id < y.entity.id ? -1 : 1
}

/**
 * The first `want` entries of several streams merged newest first. An entry
 * is final only when its date is later than the last date any unfinished
 * stream has read (that stream may still hold more entries of that day), so
 * the merge reads the stream that limits it until it has enough or every
 * stream is done. Entries with the same index key are never duplicated: a
 * stream holds each entity once.
 */
export async function mergeHistory(
  streams: HistoryStream[],
  want: number,
): Promise<{entries: HistoryEntry[]; isDone: boolean}> {
  await Promise.all(streams.filter(s => s.items.length === 0 && !s.isDone).map(s => s.read(want)))
  for (;;) {
    const open = streams.filter(s => !s.isDone)
    /* The latest date still unread from some stream: nothing from that day on is final yet. */
    const reach = (s: HistoryStream) => (s.items.length ? dateOf(s.items[s.items.length - 1]!) : '￿')
    const boundary = open.length ? open.map(reach).reduce((m, d) => (d > m ? d : m)) : null
    const final = streams
      .flatMap(s => s.items)
      .filter(e => boundary === null || dateOf(e) > boundary)
      .sort(newestFirst)
    if (final.length >= want || open.length === 0)
      return {entries: final.slice(0, want), isDone: open.length === 0 && final.length <= want}
    const limiting = open.find(s => reach(s) === boundary)!
    const before = limiting.items.length
    await limiting.read(PAGE)
    // A stream that can neither add nor finish would loop forever: end it.
    if (limiting.items.length === before && !limiting.isDone) limiting.isDone = true
  }
}

/**
 * `next` with every unchanged entry replaced by its previous object (and the
 * previous array when nothing changed), so memoised rows stay put.
 */
export function shareEntries(prev: HistoryEntry[] | undefined, next: HistoryEntry[]): HistoryEntry[] {
  if (!prev) return next
  const old = new Map(prev.map(e => [e.entity.id, e]))
  let isSame = prev.length === next.length
  const out = next.map((e, i) => {
    const p = old.get(e.entity.id)
    const kept =
      p &&
      p.kind === e.kind &&
      p.entity.version === e.entity.version &&
      p.entity.syncStatus === e.entity.syncStatus &&
      p.entity.updatedAt === e.entity.updatedAt
        ? p
        : e
    if (kept !== prev[i]) isSame = false
    return kept
  })
  return isSame ? prev : out
}
