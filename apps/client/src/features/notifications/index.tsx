import {createContext, useContext, useEffect, useState} from 'react'
import {useLingui} from '@lingui/react/macro'
import {formatAmount} from '@splito/domain'
import {
  type Entity,
  type Expense,
  type Group,
  type HistoryRow,
  type Person,
  type Store,
} from '@splito/sync'

import {useNumberLocale} from '#/locale/numberLocale'
import {device, useStorage} from '#/storage'
import {useMutationCtx, useStore} from '#/data/hooks'
import {type ActivityItem} from '#/view/com/notifications/NotificationFeedItem'

type Change = {entity: Entity; row: HistoryRow; prev: HistoryRow | undefined}

/**
 * Every entity's history rows, newest first. Includes deleted entities, so
 * deletes and restores show up.
 * ponytail: one history read per entity on each store change; add a
 * store-wide "history since" query when the feed gets long.
 */
async function loadChanges(store: Store): Promise<Change[]> {
  const entities = (
    await Promise.all([
      store.getAll('person'),
      store.getAll('group'),
      store.getAll('expense'),
    ])
  ).flat()
  const changes: Change[] = []
  for (const entity of entities) {
    const rows = (await store.history(entity.type, entity.id)).sort(
      (x, y) => x.version - y.version,
    )
    rows.forEach((row, i) => changes.push({entity, row, prev: rows[i - 1]}))
  }
  // Writes in the same ms tie on `at`; the id keeps their order stable.
  return changes.sort(
    (x, y) =>
      y.row.at - x.row.at ||
      y.row.version - x.row.version ||
      x.entity.id.localeCompare(y.entity.id),
  )
}

const ChangesContext = createContext<Change[] | undefined>(undefined)
ChangesContext.displayName = 'NotificationsChangesContext'

/**
 * Reads the history once for the whole app: the header bell on every
 * top-level page and the Notifications screen share it, re-read after every
 * committed store transaction.
 */
export function Provider({children}: {children: React.ReactNode}) {
  const store = useStore()
  const [changes, setChanges] = useState<Change[]>()
  useEffect(() => {
    let cancelled = false
    const run = () =>
      void loadChanges(store).then(c => {
        if (!cancelled) setChanges(c)
      })
    run()
    const off = store.subscribe(run)
    return () => {
      cancelled = true
      off()
    }
  }, [store])
  return (
    <ChangesContext.Provider value={changes}>
      {children}
    </ChangesContext.Provider>
  )
}

const SEEN_AT: ['notificationsSeenAt'] = ['notificationsSeenAt']

/**
 * Feed rows, newest first; undefined while the history loads. A change is
 * unread when someone else made it after the last "Mark all read".
 * ponytail: one seen-at time per device, as Bluesky's `updateSeen`; per-row
 * read state (and syncing it) arrives with the sync stream.
 */
export function useNotifications(): ActivityItem[] | undefined {
  const {t: l} = useLingui()
  const locale = useNumberLocale()
  const {actor} = useMutationCtx()
  const changes = useContext(ChangesContext)
  const [seenAt = 0] = useStorage(device, SEEN_AT)
  if (!changes) return undefined

  const names = new Map<string, string>()
  for (const c of changes) {
    if (c.entity.type === 'person') {
      names.set(c.entity.id, (c.entity.data as Person).name)
    }
  }
  const nameOf = (id: string) =>
    id === actor ? l`You` : (names.get(id) ?? l`Someone`)
  /* As Bluesky's rows: who acted first, then the others involved, never you. */
  const people = (by: string, ids: string[]) =>
    [...new Set([by, ...ids])]
      .filter(id => id !== actor)
      .map(id => ({id, name: names.get(id) ?? ''}))

  return changes.flatMap(({entity, row, prev}): ActivityItem[] => {
    const isFromOthers = row.actor !== actor
    const base = {
      key: `${entity.type}-${entity.id}-${row.version}`,
      actorName: nameOf(row.actor),
      at: row.at,
      isFromOthers,
      isUnread: isFromOthers && row.at > seenAt,
    }
    if (entity.type === 'expense') {
      const e = row.data as Expense
      const type = !prev
        ? 'expense-added'
        : row.deleted
          ? 'expense-deleted'
          : prev.deleted
            ? 'expense-restored'
            : 'expense-edited'
      return [
        {
          ...base,
          type,
          subject: e.title,
          amount: formatAmount(e.total, e.currency, locale),
          authors: people(row.actor, Object.keys(e.shares)),
        },
      ]
    }
    if (entity.type === 'group' && !prev) {
      const g = row.data as Group
      return [
        {
          ...base,
          type: 'group-created',
          subject: g.name,
          authors: people(row.actor, g.members.map(m => m.personId)),
        },
      ]
    }
    if (entity.type === 'person' && !prev && !(row.data as Person).isMe) {
      return [
        {
          ...base,
          type: 'person-added',
          subject: (row.data as Person).name,
          authors: people(row.actor, [entity.id]),
        },
      ]
    }
    return []
  })
}

/** The header bell's badge: unread changes from others. */
export function useUnreadCount() {
  return useNotifications()?.filter(item => item.isUnread).length ?? 0
}

/** Marks everything up to now as read on this device. */
export function useMarkAllRead() {
  const [, setSeenAt] = useStorage(device, SEEN_AT)
  return () => setSeenAt(Date.now())
}
