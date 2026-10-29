import {type FriendRequest} from './friends'
import {displayPerson, type Expense, type Group, isGroupInactive, type Person, type Tombstone, type Repayment, type WriteOff} from './mutations'
import {type Reminder} from './reminders'
import {type Key} from './schema'
import {type Store, type StoreChange, touches} from './store'
import {type Entity, type EntityType, type HistoryRow} from './types'

type Base = {
  /** `<entityType>:<entityId>:<version>`: one per history row, stable forever. */
  id: string
  entityId: string
  version: number
  /** Epoch ms of the change. */
  at: number
  /** Person id of whoever made the change. */
  actor: string
}

/**
 * What happened to a group. `memberLeft`: a member left or was removed (the member whose `leftAt` is newly
 * set, who made the choice about their balance in `exit`; a new `role: 'admin'` is the hand-over).
 */
export type GroupKind = 'group.created' | 'group.edited' | 'group.inactive' | 'group.active' | 'group.deleted' | 'group.restored' | 'group.memberLeft'

/** One change from the audit history, as the Activity feed shows it. */
export type ActivityEvent = Base &
  (
    | {entityType: 'expense'; kind: 'expense.created' | 'expense.edited' | 'expense.deleted' | 'expense.restored'; data: Expense; prev?: Expense}
    | {entityType: 'person'; kind: 'person.added' | 'person.removed'; data: Person; prev?: Person}
    | {entityType: 'group'; kind: GroupKind; data: Group; prev?: Group}
    | {entityType: 'repayment'; kind: 'repayment.recorded' | 'repayment.edited' | 'repayment.removed' | 'repayment.restored'; data: Repayment; prev?: Repayment}
    | {entityType: 'writeoff'; kind: 'writeoff.recorded' | 'writeoff.removed' | 'writeoff.restored'; data: WriteOff; prev?: WriteOff}
    | {
        entityType: 'friendRequest'
        kind: 'friendRequest.sent' | 'friendRequest.received' | 'friendRequest.accepted'
        data: FriendRequest
        prev?: FriendRequest
      }
    | {entityType: 'reminder'; kind: 'reminder.nudged' | 'reminder.set'; data: Reminder; prev?: Reminder}
  )

export type ActivityKind = ActivityEvent['kind']

const FEED_TYPES = ['person', 'group', 'expense', 'repayment', 'writeoff', 'friendRequest', 'reminder'] as const satisfies EntityType[]

/** What a history row means, given the version before it. Undefined rows stay out of the feed. */
function kindOf(row: HistoryRow, prev: HistoryRow | undefined): ActivityKind | undefined {
  const isNew = !prev || prev.deleted
  // An old build's "Delete forever" re-wrote a tombstone; the delete already showed.
  if (row.deleted && prev?.deleted) return undefined
  // A record a group's deletion took with it (and its restore with the group) is the group's event, not its own (F-615).
  if (row.deleted ? (row.data as Tombstone | null)?.deletedWithGroup : prev?.deleted && (prev.data as Tombstone | null)?.deletedWithGroup) return undefined
  switch (row.entityType) {
    case 'expense':
      return !prev ? 'expense.created' : row.deleted ? 'expense.deleted' : prev.deleted ? 'expense.restored' : 'expense.edited'
    case 'person':
      // Your own profile row is setup, not activity; renames aren't shown.
      if ((row.data as Person).isMe) return undefined
      // A friend who arrives by accepting is the request's "accepted" row, not a second one.
      if (!prev && (row.data as Person).accountId) return undefined
      return row.deleted ? 'person.removed' : isNew ? 'person.added' : undefined
    case 'group': {
      if (row.deleted) return 'group.deleted'
      if (!prev) return 'group.created'
      if (prev.deleted) return 'group.restored'
      const now = row.data as Group
      const before = prev.data as Group
      if (isGroupInactive(now) !== isGroupInactive(before)) return isGroupInactive(now) ? 'group.inactive' : 'group.active'
      const hasLeft = (m: Group['members'][number]) => !!before.members?.some(b => b.personId === m.personId && b.leftAt === null) && m.leftAt !== null
      return now.members?.some(hasLeft) ? 'group.memberLeft' : 'group.edited'
    }
    case 'repayment':
      // A restored payment is its own event: "recorded" twice would read as two payments (audit m1).
      return row.deleted ? 'repayment.removed' : !prev ? 'repayment.recorded' : prev.deleted ? 'repayment.restored' : 'repayment.edited'
    case 'writeoff':
      return row.deleted ? 'writeoff.removed' : prev?.deleted ? 'writeoff.restored' : 'writeoff.recorded'
    case 'friendRequest': {
      const r = row.data as FriendRequest
      if (!prev) return r.direction === 'incoming' ? 'friendRequest.received' : 'friendRequest.sent'
      // Resends, cancels and declines are housekeeping; only the moment you become friends is news.
      return r.status === 'accepted' && (prev.data as FriendRequest).status !== 'accepted' ? 'friendRequest.accepted' : undefined
    }
    case 'reminder':
      // A reminder shows once, when it is shared or set; moving or cancelling it is housekeeping.
      return !prev ? ((row.data as Reminder).kind === 'nudge' ? 'reminder.nudged' : 'reminder.set') : undefined
    default:
      // Preferences are settings, not activity.
      return undefined
  }
}

/**
 * The feed for a set of history rows, in any order: one event per meaningful
 * row, newest first. Pure; the audit history itself is never changed.
 */
export function activityFromHistory(rows: HistoryRow[]): ActivityEvent[] {
  const byEntity = new Map<string, HistoryRow[]>()
  for (const r of rows) {
    const key = `${r.entityType}:${r.entityId}`
    byEntity.set(key, [...(byEntity.get(key) ?? []), r])
  }
  const events: ActivityEvent[] = []
  for (const list of byEntity.values()) {
    list.sort((x, y) => x.version - y.version)
    list.forEach((row, i) => {
      const prev = list[i - 1]
      const kind = kindOf(row, prev)
      if (!kind) return
      events.push({
        id: `${row.entityType}:${row.entityId}:${row.version}`,
        entityType: row.entityType,
        entityId: row.entityId,
        version: row.version,
        at: row.at,
        actor: row.actor,
        kind,
        data: row.data,
        prev: prev?.data,
      } as ActivityEvent)
    })
  }
  return events.sort((x, y) => y.at - x.at || (x.id < y.id ? -1 : x.id > y.id ? 1 : 0))
}

/**
 * The whole feed from the local store, deleted entities included (their
 * deletes and restores are activity too). Reads every entity: for tests,
 * export and maintenance only; the app reads `activityTracker`.
 */
export async function loadActivity(store: Store): Promise<ActivityEvent[]> {
  const entities = (await Promise.all(FEED_TYPES.map(type => store.getAll(type)))).flat()
  const rows = (await Promise.all(entities.map(e => store.history(e.type, e.id)))).flat()
  return activityFromHistory(rows)
}

export type FeedType = (typeof FEED_TYPES)[number]

/** How many events the feed holds at first, and how many each "more" adds. */
export const ACTIVITY_PAGE = 100

/**
 * The newest events as of one load, and the entities they refer to. People
 * and groups are small and come whole; expenses and friend requests only
 * those the events name (deleted ones included). `isDone`: nothing older exists.
 */
export type ActivityState = {events: ActivityEvent[]; entities: Record<FeedType, Entity[]>; isDone: boolean}

const FEED_SET = new Set<EntityType>(FEED_TYPES)

/**
 * The newest `want()` events, read by cursor from the history's
 * `byChangedAt` index, kept current from store change notices: a change
 * re-reads only the histories of the entities it names; asking for more
 * (`want()` grew) or an unknown change rebuilds the window. A history is read
 * whole per entity, so every event can tell what it changed (it needs the
 * version before). Loads run one at a time, so a slow one never overwrites a
 * newer read. Equal to the top of `loadActivity` after every load (tested).
 *
 * A pooled entity brings its whole history, old events included, so an event
 * only counts once it is final: newer than the last history row read (every
 * unread row is at or before it), or the history is exhausted. Reading goes on
 * until `size` events are final, so old edits of recently touched entities and
 * rows that make no event (renames, housekeeping) never crowd out newer events.
 */
export function activityTracker(store: Store, want: () => number = () => ACTIVITY_PAGE): (change: StoreChange) => Promise<ActivityState> {
  const pool = new Map<string, HistoryRow[]>()
  let cursor: Key | null | undefined
  /** The `at` of the last history row read: unread rows are no newer. */
  let readUpTo = Infinity
  let isDone = false
  let held = 0
  let people: Entity[] | undefined
  let groups: Entity[] | undefined
  const known = new Map<string, Entity>()
  let queue: Promise<unknown> = Promise.resolve()
  const keyOf = (type: EntityType, id: string) => `${type}:${id}`

  const readHistories = async (refs: Array<{type: EntityType; id: string}>) => {
    const rows = await store.historyMany(refs)
    for (const r of refs) pool.set(keyOf(r.type, r.id), [])
    for (const row of rows) pool.get(keyOf(row.entityType, row.entityId))!.push(row)
  }
  /** Events no unread history row can come before (strictly newer than the last row read; a tie may hide one). */
  const finalEvents = () => {
    const all = activityFromHistory([...pool.values()].flat())
    return isDone ? all : all.filter(e => e.at > readUpTo)
  }

  const load = async (change: StoreChange): Promise<ActivityState> => {
    const size = want()
    if (change === 'unknown' || size > held || held === 0) {
      pool.clear()
      known.clear()
      cursor = undefined
      readUpTo = Infinity
      isDone = false
      people = groups = undefined
    } else {
      const touched = FEED_TYPES.flatMap(type => [...(change[type] ?? [])].map(id => ({type, id})))
      if (touched.length) await readHistories(touched)
      if (touches(change, 'person')) people = undefined
      if (touches(change, 'group')) groups = undefined
      for (const t of touched) known.delete(keyOf(t.type, t.id))
    }
    held = size
    let list = finalEvents()
    while (list.length < size && !isDone) {
      const page = await store.historyPage({after: cursor, limit: ACTIVITY_PAGE})
      cursor = page.next
      isDone = page.next === null
      if (page.items.length) readUpTo = page.items[page.items.length - 1]!.at
      const fresh = new Map<string, {type: EntityType; id: string}>()
      for (const h of page.items) {
        const key = keyOf(h.entityType, h.entityId)
        if (FEED_SET.has(h.entityType) && !pool.has(key)) fresh.set(key, {type: h.entityType, id: h.entityId})
      }
      if (fresh.size) await readHistories([...fresh.values()])
      list = finalEvents()
    }
    const hasMore = list.length > size
    list = list.slice(0, size)
    people ??= (await store.getAll<Person>('person')).map(displayPerson)
    groups ??= await store.getAll('group')
    // Only what the events name: an expense or a request row shows its current state.
    const wanted = new Map<EntityType, string[]>()
    for (const e of list) {
      if (e.entityType !== 'expense' && e.entityType !== 'friendRequest') continue
      if (known.has(keyOf(e.entityType, e.entityId))) continue
      const ids = wanted.get(e.entityType) ?? []
      ids.push(e.entityId)
      wanted.set(e.entityType, ids)
    }
    for (const [type, ids] of wanted) for (const row of await store.getMany(type, ids)) known.set(keyOf(type, row.id), row)
    const named = (type: EntityType) => [...new Set(list.filter(e => e.entityType === type).map(e => e.entityId))].map(id => known.get(keyOf(type, id))).filter((e): e is Entity => !!e)
    const entities = {
      person: people,
      group: groups,
      expense: named('expense'),
      repayment: [],
      writeoff: [],
      friendRequest: named('friendRequest').map(e => displayPerson(e as Entity<FriendRequest>)),
      reminder: [],
    } satisfies Record<FeedType, Entity[]>
    return {events: list, entities, isDone: isDone && !hasMore}
  }
  return change => {
    const next = queue.then(() => load(change))
    queue = next.catch(() => undefined)
    return next
  }
}
