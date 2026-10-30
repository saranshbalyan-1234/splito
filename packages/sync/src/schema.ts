/**
 * The local database schema, version 4 (ARCHITECTURE 9.8). One definition
 * drives both engines: IndexedDB object stores and SQLite tables share names,
 * columns, keys and indexes, and the Postgres mirror (backend batch) is cut
 * from the same list.
 *
 * Rules every store follows:
 * - One store per entity type; relations (`group_members`, `expense_parties`)
 *   and projections (`balances`, `pair_balances`) have their own.
 * - Rows are flat: scalar columns (strings, integers, null) plus, for entity
 *   stores, `data`, the entity as codec JSON (bigint-safe). Columns exist for
 *   every query path; nothing is read by scanning `data`.
 * - Booleans are 0/1 (IndexedDB cannot index a boolean). A missing group is
 *   `''`, never null (IndexedDB leaves null out of an index).
 * - Money columns are decimal strings of minor units (the codec's own bigint
 *   form), summed only by the domain in JS.
 * - Every index ends with the row's id, so each index key is unique and a
 *   list pages by "the last key seen" on both engines with the same order.
 */
import {decode, encode} from './codec'
import {type Expense, type Group, type Person, type Repayment} from './mutations'
import {type Entity, type EntityInput, type EntityType, type HistoryRow, type OutboxOp, type OutboxInput, type RowSyncStatus} from './types'

/**
 * 1: one `entities` store. 2: a store per entity type, relations and balance
 * projections. 3: the `aggregates` and `search_terms` projections and
 * `people.lastActivityAt` (so Analytics and Search never load the ledger).
 * 4: the `reminders` store (Remind nudges and Remind me, F-1118 / F-1119); a deleted expense keeps its
 * `expense_parties` rows (flagged) and its search terms, so lists show deleted items in place (decision 103); the
 * `history.binDays` preference is gone.
 * 5: the `disputes` store (disputes and holds, F-1210) and the `disputed_balances` / `disputed_pairs` projections
 * (what part of each balance sits on a disputed or held record, kept in the balance transaction).
 * 6: the `group_requests` store (group requests and join requests, F-269); a group's `joinPolicy` lives in its data
 * (absent reads as 'approve'), so no group column changes.
 */
export const SCHEMA_VERSION = 6

export type Scalar = string | number
export type Key = Scalar[]
export type Row = Record<string, Scalar | null>

/** `?` marks a nullable column. */
export type ColumnType = 'text' | 'int' | 'text?' | 'int?'

export interface StoreSpec {
  /** Primary key columns (the outbox's is its auto-increment `seq`). */
  key: readonly string[]
  /** True: `key` is one integer the engine numbers. */
  auto?: boolean
  columns: Readonly<Record<string, ColumnType>>
  indexes: Readonly<Record<string, {columns: readonly string[]; unique?: boolean}>>
}

const ix = (...columns: string[]) => ({columns})

const SYNC_COLUMNS = {
  syncStatus: 'text',
  serverVersion: 'int?',
  syncedAt: 'int?',
  syncError: 'text?',
} as const satisfies Record<string, ColumnType>

/** Columns of every entity row. */
const ENTITY_COLUMNS = {
  id: 'text',
  version: 'int',
  createdAt: 'int',
  updatedAt: 'int',
  deleted: 'int',
  deletedAt: 'int?',
  purgedAt: 'int?',
  ...SYNC_COLUMNS,
  data: 'text',
} as const satisfies Record<string, ColumnType>

/** Columns of every normalised relation row. */
const RELATION_COLUMNS = {
  id: 'text',
  version: 'int',
  createdAt: 'int',
  updatedAt: 'int',
  deleted: 'int',
  ...SYNC_COLUMNS,
} as const satisfies Record<string, ColumnType>

export const STORES = {
  people: {
    key: ['id'],
    // `lastActivityAt`: the newest change to anything this person is on (a projection column, like a group's `activityAt`).
    columns: {...ENTITY_COLUMNS, name: 'text', nameKey: 'text', isMe: 'int', accountId: 'text?', lastActivityAt: 'int'},
    indexes: {
      byName: ix('nameKey', 'id'),
      byUpdatedAt: ix('updatedAt', 'id'),
      byActivity: ix('lastActivityAt', 'id'),
      bySyncStatus: ix('syncStatus', 'id'),
    },
  },
  groups: {
    key: ['id'],
    // `activityAt`: the newest change to the group or to anything recorded in it (a projection column, 26.17).
    columns: {...ENTITY_COLUMNS, name: 'text', kind: 'text', currency: 'text', archived: 'int', activityAt: 'int'},
    indexes: {
      byUpdatedAt: ix('updatedAt', 'id'),
      byActivity: ix('activityAt', 'id'),
      byArchived: ix('archived', 'updatedAt', 'id'),
      bySyncStatus: ix('syncStatus', 'id'),
    },
  },
  group_members: {
    key: ['groupId', 'personId'],
    columns: {...RELATION_COLUMNS, groupId: 'text', personId: 'text', joinedAt: 'int', leftAt: 'int?', role: 'text'},
    indexes: {
      byPerson: ix('personId', 'groupId'),
      bySyncStatus: ix('syncStatus', 'groupId', 'personId'),
    },
  },
  expenses: {
    key: ['id'],
    columns: {...ENTITY_COLUMNS, groupId: 'text', date: 'text', currency: 'text', total: 'text', tz: 'text', category: 'text', title: 'text'},
    indexes: {
      byGroupDate: ix('groupId', 'date', 'id'),
      byDate: ix('date', 'id'),
      byUpdatedAt: ix('updatedAt', 'id'),
      byDeleted: ix('deleted', 'updatedAt', 'id'),
      bySyncStatus: ix('syncStatus', 'id'),
    },
  },
  expense_parties: {
    key: ['expenseId', 'personId'],
    columns: {
      ...RELATION_COLUMNS,
      expenseId: 'text',
      personId: 'text',
      paid: 'text',
      share: 'text',
      groupId: 'text',
      currency: 'text',
      date: 'text',
    },
    indexes: {
      byPersonDate: ix('personId', 'date', 'expenseId'),
      byGroupPerson: ix('groupId', 'personId', 'date', 'expenseId'),
      bySyncStatus: ix('syncStatus', 'expenseId', 'personId'),
    },
  },
  repayments: {
    key: ['id'],
    columns: {...ENTITY_COLUMNS, groupId: 'text', fromId: 'text', toId: 'text', currency: 'text', amount: 'text', date: 'text', tz: 'text'},
    indexes: {
      byGroup: ix('groupId', 'date', 'id'),
      byFrom: ix('fromId', 'date', 'id'),
      byTo: ix('toId', 'date', 'id'),
      byDate: ix('date', 'id'),
      byUpdatedAt: ix('updatedAt', 'id'),
      byDeleted: ix('deleted', 'updatedAt', 'id'),
      bySyncStatus: ix('syncStatus', 'id'),
    },
  },
  writeoffs: {
    key: ['id'],
    columns: {...ENTITY_COLUMNS, groupId: 'text', fromId: 'text', toId: 'text', currency: 'text', amount: 'text', date: 'text', tz: 'text'},
    indexes: {
      byGroup: ix('groupId', 'date', 'id'),
      byFrom: ix('fromId', 'date', 'id'),
      byTo: ix('toId', 'date', 'id'),
      byDate: ix('date', 'id'),
      byUpdatedAt: ix('updatedAt', 'id'),
      byDeleted: ix('deleted', 'updatedAt', 'id'),
      bySyncStatus: ix('syncStatus', 'id'),
    },
  },
  comments: {
    key: ['id'],
    columns: {...ENTITY_COLUMNS, targetType: 'text', targetId: 'text'},
    indexes: {
      byTarget: ix('targetType', 'targetId', 'createdAt', 'id'),
      bySyncStatus: ix('syncStatus', 'id'),
    },
  },
  /*
   * Remind (F-1118) and Remind me (F-1119). `kind` 'nudge': a friendly reminder I shared with someone
   * (a log row, `dueAt` null). 'self': a notification I scheduled for myself (`dueAt` is the first or next
   * due time, `repeat` none|daily|weekly|monthly). `groupId` '' for none.
   */
  reminders: {
    key: ['id'],
    columns: {...ENTITY_COLUMNS, personId: 'text', groupId: 'text', kind: 'text', dueAt: 'int?', repeat: 'text'},
    indexes: {
      byPerson: ix('personId', 'createdAt', 'id'),
      byDue: ix('kind', 'dueAt', 'id'),
      bySyncStatus: ix('syncStatus', 'id'),
    },
  },
  /*
   * Disputes and holds (F-1210). `targetType`/`targetId` name the expense, payment or write-off; `status` is
   * open | accepted | rejected | withdrawn | released | gone. `byTargetStatus` finds a record's open ones (the
   * badge, the one-open-per-person rule, the projection); `byStatus` lists every open one (the Disputed filter).
   */
  disputes: {
    key: ['id'],
    columns: {...ENTITY_COLUMNS, targetType: 'text', targetId: 'text', status: 'text', raisedBy: 'text', kind: 'text'},
    indexes: {
      byTarget: ix('targetType', 'targetId', 'createdAt', 'id'),
      byTargetStatus: ix('targetType', 'targetId', 'status', 'id'),
      byStatus: ix('status', 'updatedAt', 'id'),
      bySyncStatus: ix('syncStatus', 'id'),
    },
  },
  friend_requests: {
    key: ['id'],
    columns: {...ENTITY_COLUMNS, status: 'text', direction: 'text'},
    indexes: {
      byStatus: ix('status', 'updatedAt', 'id'),
      bySyncStatus: ix('syncStatus', 'id'),
    },
  },
  /*
   * Group requests (F-269): "X added you to G", "I added P to G", "S opened G's link" and "I asked to join G".
   * `byGroup` finds a group's pending ones (its Members list, the admins' approvals); `byStatus` every pending one.
   */
  group_requests: {
    key: ['id'],
    columns: {...ENTITY_COLUMNS, status: 'text', direction: 'text', kind: 'text', groupId: 'text'},
    indexes: {
      byStatus: ix('status', 'updatedAt', 'id'),
      byGroup: ix('groupId', 'status', 'id'),
      bySyncStatus: ix('syncStatus', 'id'),
    },
  },
  invite_links: {
    key: ['id'],
    columns: {...ENTITY_COLUMNS, groupId: 'text', revoked: 'int'},
    indexes: {
      byUpdatedAt: ix('updatedAt', 'id'),
      bySyncStatus: ix('syncStatus', 'id'),
    },
  },
  feedback: {
    key: ['id'],
    columns: {...ENTITY_COLUMNS},
    indexes: {
      byUpdatedAt: ix('updatedAt', 'id'),
      bySyncStatus: ix('syncStatus', 'id'),
    },
  },
  preferences: {
    key: ['id'],
    columns: {...ENTITY_COLUMNS},
    indexes: {bySyncStatus: ix('syncStatus', 'id')},
  },
  history: {
    key: ['entityType', 'entityId', 'version'],
    columns: {entityType: 'text', entityId: 'text', version: 'int', data: 'text', deleted: 'int', at: 'int', actor: 'text'},
    indexes: {
      byEntity: ix('entityType', 'entityId', 'version'),
      byChangedAt: ix('at', 'entityType', 'entityId', 'version'),
    },
  },
  outbox: {
    key: ['seq'],
    auto: true,
    columns: {
      seq: 'int',
      opId: 'text',
      deviceId: 'text',
      actor: 'text',
      entityType: 'text',
      entityId: 'text',
      opType: 'text',
      baseVersion: 'int',
      payload: 'text',
      schemaVersion: 'int',
      deps: 'text',
      attempts: 'int',
      nextAttemptAt: 'int?',
      lastError: 'text?',
      status: 'text',
    },
    indexes: {
      opId: {columns: ['opId'], unique: true},
      byStatus: ix('status', 'seq'),
      byEntity: ix('entityType', 'entityId', 'seq'),
    },
  },
  meta: {
    key: ['key'],
    columns: {key: 'text', value: 'text'},
    indexes: {},
  },
  /*
   * `history`, `meta`, `balances`, `pair_balances`, `aggregates` and
   * `search_terms` have no `syncStatus` by design (9.8 reading, F-117): history
   * is an append-only audit trail of rows that carry their own status, `meta`
   * is local bookkeeping, and the last four are projections derived from rows
   * (rebuilt by `rebuildProjections`, never sent), so they are exactly as
   * synced as the rows behind them. Every store holding data a user wrote
   * (the entity and relation stores) has the column and its index.
   */
  balances: {
    key: ['personId', 'groupId', 'currency'],
    columns: {personId: 'text', groupId: 'text', currency: 'text', amount: 'text', count: 'int', updatedAt: 'int'},
    indexes: {byGroup: ix('groupId', 'currency', 'personId')},
  },
  pair_balances: {
    key: ['personId', 'otherId', 'currency'],
    columns: {personId: 'text', otherId: 'text', currency: 'text', amount: 'text', updatedAt: 'int'},
    indexes: {},
  },
  /*
   * The part of `balances` that sits on records with an open dispute or hold (F-1210, "of which disputed"): the
   * same cells, summed over only those records (an item dispute counts only that item's portion), kept in the
   * balance transaction. `count` is how many disputed records make the sum.
   */
  disputed_balances: {
    key: ['personId', 'groupId', 'currency'],
    columns: {personId: 'text', groupId: 'text', currency: 'text', amount: 'text', count: 'int', updatedAt: 'int'},
    indexes: {byGroup: ix('groupId', 'currency', 'personId')},
  },
  /* What `otherId` owes `personId` on disputed records, per group ('' outside groups) and currency (> 0 they owe). */
  disputed_pairs: {
    key: ['personId', 'otherId', 'groupId', 'currency'],
    columns: {personId: 'text', otherId: 'text', groupId: 'text', currency: 'text', amount: 'text', updatedAt: 'int'},
    indexes: {},
  },
  /*
   * Spending and balance sums per `[currency, month, groupId|'', categoryId, personId, kind]`
   * (the cells of `recordCells`, folded to a month; minor units as decimal strings), kept in the same
   * transaction as `balances`. Analytics reads history-long charts from here. `personId` '' is the
   * whole expense (`total`, `count`); a person row holds that person's `paid`, `share` and `net`.
   */
  aggregates: {
    key: ['currency', 'month', 'groupId', 'categoryId', 'personId', 'kind'],
    columns: {
      currency: 'text',
      month: 'text',
      groupId: 'text',
      categoryId: 'text',
      personId: 'text',
      kind: 'text',
      total: 'text',
      paid: 'text',
      share: 'text',
      net: 'text',
      count: 'int',
      updatedAt: 'int',
    },
    indexes: {byPerson: ix('personId', 'currency', 'month', 'groupId', 'categoryId', 'kind')},
  },
  /*
   * Search terms (`kind`: 'w' word prefix token, 'a' amount key per currency, 'm' month of the year,
   * 'c' category id) -> the expense, person or group they find. Kept in the mutation transaction.
   */
  search_terms: {
    key: ['kind', 'term', 'entityType', 'entityId'],
    columns: {kind: 'text', term: 'text', entityType: 'text', entityId: 'text'},
    indexes: {},
  },
} as const satisfies Record<string, StoreSpec>

export type StoreName = keyof typeof STORES

/** Entity type -> the store that holds it. */
export const ENTITY_STORE = {
  person: 'people',
  group: 'groups',
  expense: 'expenses',
  repayment: 'repayments',
  writeoff: 'writeoffs',
  comment: 'comments',
  friendRequest: 'friend_requests',
  inviteLink: 'invite_links',
  feedback: 'feedback',
  preference: 'preferences',
  reminder: 'reminders',
  dispute: 'disputes',
  groupRequest: 'group_requests',
} as const satisfies Record<EntityType, StoreName>

/** The index names of one entity type's store. */
export type EntityIndex<T extends EntityType> = keyof (typeof STORES)[(typeof ENTITY_STORE)[T]]['indexes'] & string

/** Entity stores in creation order. */
export const ENTITY_TYPES = Object.keys(ENTITY_STORE) as EntityType[]

/** Money entity stores: never read whole on a hot path (ARCHITECTURE 9.8). */
export const MONEY_TYPES = ['expense', 'repayment', 'writeoff'] as const

export const specOf = (store: StoreName): StoreSpec => STORES[store]

/** The columns of one index (or of the primary key when `index` is undefined). */
export function indexColumns(store: StoreName, index?: string): readonly string[] {
  if (index === undefined) return STORES[store].key
  const found = (STORES[store].indexes as Record<string, {columns: readonly string[]}>)[index]
  if (!found) throw new Error(`no index ${index} on ${store}`)
  return found.columns
}

/** The full index key of a row, in index order: what a page cursor holds. */
export function indexKey(store: StoreName, index: string | undefined, row: Row): Key {
  return indexColumns(store, index).map(c => row[c] as Scalar)
}

/* -------------------------------------------------------------------------- */
/* Entity <-> row                                                             */
/* -------------------------------------------------------------------------- */

/** Extra query columns per entity type. Forward-compatible: a malformed `data` never throws. */
const EXTRA: Record<EntityType, (data: unknown) => Row> = {
  person: data => {
    const d = data as Partial<Person> | null
    return {
      name: d?.name ?? '',
      nameKey: (d?.name ?? '').toLocaleLowerCase(),
      isMe: d?.isMe ? 1 : 0,
      accountId: d?.accountId ?? null,
    }
  },
  group: data => {
    const d = data as Partial<Group> | null
    return {name: d?.name ?? '', kind: d?.kind ?? 'other', currency: d?.currency ?? '', archived: d?.archived ? 1 : 0}
  },
  expense: data => {
    const d = data as Partial<Expense> | null
    return {
      groupId: d?.groupId ?? '',
      date: d?.date ?? '',
      currency: d?.currency ?? '',
      total: String(d?.total ?? 0n),
      tz: d?.tz ?? '',
      category: d?.category ?? '',
      title: d?.title ?? '',
    }
  },
  repayment: data => moneyTransfer(data as Partial<Repayment> | null),
  writeoff: data => moneyTransfer(data as Partial<Repayment> | null),
  comment: data => {
    const d = data as {targetType?: string; targetId?: string} | null
    return {targetType: d?.targetType ?? '', targetId: d?.targetId ?? ''}
  },
  dispute: data => {
    const d = data as {targetType?: string; targetId?: string; status?: string; raisedBy?: string; kind?: string} | null
    return {targetType: d?.targetType ?? '', targetId: d?.targetId ?? '', status: d?.status ?? '', raisedBy: d?.raisedBy ?? '', kind: d?.kind ?? ''}
  },
  friendRequest: data => {
    const d = data as {status?: string; direction?: string} | null
    return {status: d?.status ?? '', direction: d?.direction ?? ''}
  },
  groupRequest: data => {
    const d = data as {status?: string; direction?: string; kind?: string; groupId?: string} | null
    return {status: d?.status ?? '', direction: d?.direction ?? '', kind: d?.kind ?? '', groupId: d?.groupId ?? ''}
  },
  inviteLink: data => {
    const d = data as {groupId?: string | null; revoked?: boolean} | null
    return {groupId: d?.groupId ?? '', revoked: d?.revoked ? 1 : 0}
  },
  feedback: () => ({}),
  preference: () => ({}),
  reminder: data => {
    const d = data as {kind?: string; personId?: string; groupId?: string | null; dueAt?: number | null; repeat?: string} | null
    return {personId: d?.personId ?? '', groupId: d?.groupId ?? '', kind: d?.kind ?? '', dueAt: typeof d?.dueAt === 'number' ? d.dueAt : null, repeat: d?.repeat ?? 'none'}
  },
}

function moneyTransfer(d: Partial<Repayment> | null | undefined): Row {
  return {
    groupId: d?.groupId ?? '',
    fromId: d?.from ?? '',
    toId: d?.to ?? '',
    currency: d?.currency ?? '',
    amount: String(d?.amount ?? 0n),
    date: d?.date ?? '',
    tz: d?.tz ?? '',
  }
}

/** The entity with every sync field filled from what a writer gave and what was stored. */
export function completeEntity<T>(e: EntityInput<T>, prev: Entity<T> | undefined): Entity<T> {
  return {
    type: e.type,
    id: e.id,
    data: e.data,
    version: e.version,
    deleted: e.deleted,
    updatedAt: e.updatedAt,
    createdAt: e.createdAt ?? prev?.createdAt ?? e.updatedAt,
    syncStatus: e.syncStatus ?? prev?.syncStatus ?? 'local',
    serverVersion: e.serverVersion !== undefined ? e.serverVersion : (prev?.serverVersion ?? null),
    syncedAt: e.syncedAt !== undefined ? e.syncedAt : (prev?.syncedAt ?? null),
    syncError: e.syncError !== undefined ? e.syncError : (prev?.syncError ?? null),
  }
}

export function rowOfEntity(e: Entity): Row {
  const purgedAt = (e.data as {purgedAt?: unknown} | null)?.purgedAt
  return {
    id: e.id,
    version: e.version,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
    deleted: e.deleted ? 1 : 0,
    deletedAt: e.deleted ? e.updatedAt : null,
    purgedAt: typeof purgedAt === 'number' ? purgedAt : null,
    syncStatus: e.syncStatus,
    serverVersion: e.serverVersion,
    syncedAt: e.syncedAt,
    syncError: e.syncError,
    data: encode(e.data),
    ...EXTRA[e.type](e.data),
    // A group's own change is activity; the store raises it further as records land in the group.
    ...(e.type === 'group' ? {activityAt: e.updatedAt} : {}),
    // A person's activity is raised as records they are on change; a new row starts with none.
    ...(e.type === 'person' ? {lastActivityAt: 0} : {}),
  }
}

export function entityOfRow(type: EntityType, r: Row): Entity {
  return {
    type,
    id: r.id as string,
    data: decode(r.data as string),
    version: r.version as number,
    deleted: !!r.deleted,
    createdAt: r.createdAt as number,
    updatedAt: r.updatedAt as number,
    syncStatus: r.syncStatus as RowSyncStatus,
    serverVersion: r.serverVersion as number | null,
    syncedAt: r.syncedAt as number | null,
    syncError: r.syncError as string | null,
  }
}

export const historyRow = (h: HistoryRow): Row => ({
  entityType: h.entityType,
  entityId: h.entityId,
  version: h.version,
  data: encode(h.data),
  deleted: h.deleted ? 1 : 0,
  at: h.at,
  actor: h.actor,
})

export const historyOfRow = (r: Row): HistoryRow => ({
  entityType: r.entityType as EntityType,
  entityId: r.entityId as string,
  version: r.version as number,
  data: decode(r.data as string),
  deleted: !!r.deleted,
  at: r.at as number,
  actor: r.actor as string,
})

export const outboxRow = (o: OutboxInput): Row => ({
  ...(o.seq === undefined ? {} : {seq: o.seq}),
  opId: o.opId,
  deviceId: o.deviceId,
  actor: o.actor,
  entityType: o.entityType,
  entityId: o.entityId,
  opType: o.opType,
  baseVersion: o.baseVersion,
  payload: encode(o.payload),
  schemaVersion: o.schemaVersion,
  deps: JSON.stringify(o.deps),
  attempts: o.attempts,
  nextAttemptAt: o.nextAttemptAt,
  lastError: o.lastError,
  status: o.status ?? 'queued',
})

export const outboxOfRow = (r: Row): OutboxOp => ({
  seq: r.seq as number,
  opId: r.opId as string,
  deviceId: r.deviceId as string,
  actor: r.actor as string,
  entityType: r.entityType as EntityType,
  entityId: r.entityId as string,
  opType: r.opType as string,
  baseVersion: r.baseVersion as number,
  payload: decode(r.payload as string),
  schemaVersion: r.schemaVersion as 1,
  deps: JSON.parse(r.deps as string),
  attempts: r.attempts as number,
  nextAttemptAt: r.nextAttemptAt as number | null,
  lastError: r.lastError as string | null,
  status: r.status as OutboxOp['status'],
})
