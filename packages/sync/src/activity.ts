import type {CurrencyCode, LocalDate} from '@splito/domain'

import type {Expense, Group, Person} from './mutations'
import type {Store} from './store'
import type {EntityType, HistoryRow} from './types'

/**
 * What a repayment entity stores. Its mutations belong to settle-up; the
 * fields match `@splito/domain`'s `RepaymentRecord` so the ledger can read it.
 */
export interface Repayment {
  from: string
  to: string
  amount: bigint
  currency: CurrencyCode
  groupId: string | null
  date: LocalDate
}

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

/** One change from the audit history, as the Activity feed shows it. */
export type ActivityEvent = Base &
  (
    | {entityType: 'expense'; kind: 'expense.created' | 'expense.edited' | 'expense.deleted' | 'expense.restored'; data: Expense; prev?: Expense}
    | {entityType: 'person'; kind: 'person.added' | 'person.removed'; data: Person; prev?: Person}
    | {entityType: 'group'; kind: 'group.created' | 'group.edited' | 'group.archived' | 'group.deleted'; data: Group; prev?: Group}
    | {entityType: 'repayment'; kind: 'repayment.recorded' | 'repayment.edited' | 'repayment.removed'; data: Repayment; prev?: Repayment}
  )

export type ActivityKind = ActivityEvent['kind']

const FEED_TYPES = ['person', 'group', 'expense', 'repayment'] as const satisfies EntityType[]

/** What a history row means, given the version before it. Undefined rows stay out of the feed. */
function kindOf(row: HistoryRow, prev: HistoryRow | undefined): ActivityKind | undefined {
  const isNew = !prev || prev.deleted
  switch (row.entityType) {
    case 'expense':
      return !prev ? 'expense.created' : row.deleted ? 'expense.deleted' : prev.deleted ? 'expense.restored' : 'expense.edited'
    case 'person':
      // Your own profile row is setup, not activity; renames aren't shown.
      if ((row.data as Person).isMe) return undefined
      return row.deleted ? 'person.removed' : isNew ? 'person.added' : undefined
    case 'group':
      if (row.deleted) return 'group.deleted'
      if (isNew) return 'group.created'
      return (row.data as Group).archived && !(prev.data as Group).archived ? 'group.archived' : 'group.edited'
    case 'repayment':
      return row.deleted ? 'repayment.removed' : isNew ? 'repayment.recorded' : 'repayment.edited'
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
 * deletes and restores are activity too).
 * ponytail: one history read per entity; add a store-wide "history since"
 * query when histories get long.
 */
export async function loadActivity(store: Store): Promise<ActivityEvent[]> {
  const entities = (await Promise.all(FEED_TYPES.map(type => store.getAll(type)))).flat()
  const rows = (await Promise.all(entities.map(e => store.history(e.type, e.id)))).flat()
  return activityFromHistory(rows)
}
