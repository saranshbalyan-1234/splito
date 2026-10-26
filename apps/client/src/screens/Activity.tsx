import {useEffect, useState} from 'react'
import {View} from 'react-native'
import {LayoutAnimationConfig} from 'react-native-reanimated'
import {Trans, useLingui} from '@lingui/react/macro'
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
import {useMutationCtx, useStore} from '#/data/hooks'
import {
  type ActivityItem,
  NotificationFeedItem,
  NotificationFeedItemPlaceholder,
} from '#/view/com/notifications/NotificationFeedItem'
import {EmptyState} from '#/view/com/util/EmptyState'
import {List} from '#/view/com/util/List'
import {useBreakpoints} from '#/alf'
import {AddExpenseFAB} from '#/components/AddExpenseFAB'
import {HeaderAvatar} from '#/components/HeaderAvatar'
import * as Layout from '#/components/Layout'
import {Shimmer} from '#/motion/Shimmer'

const PLACEHOLDER_ROWS = 8

type Change = {entity: Entity; row: HistoryRow; prev: HistoryRow | undefined}

/**
 * Every entity's history rows, newest first. Includes deleted entities, so
 * deletes and restores show up.
 * ponytail: one history read per entity on each store change; add a
 * store-wide "history since" query when activity gets long.
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
  return changes.sort(
    (x, y) => y.row.at - x.row.at || y.row.version - x.row.version,
  )
}

/** Live history, re-read after every committed store transaction. */
function useChanges() {
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
  return changes
}

/** Activity: changes from the local store's history, in Bluesky's notification rows. */
export function ActivityScreen() {
  const {t: l} = useLingui()
  const locale = useNumberLocale()
  const {actor} = useMutationCtx()
  const changes = useChanges()
  const {gtMobile} = useBreakpoints()

  const names = new Map<string, string>()
  for (const c of changes ?? []) {
    if (c.entity.type === 'person') {
      names.set(c.entity.id, (c.entity.data as Person).name)
    }
  }
  const nameOf = (id: string) =>
    id === actor ? l`You` : (names.get(id) ?? l`Someone`)
  const people = (ids: string[]) =>
    ids.map(id => ({id, name: names.get(id) ?? ''}))

  const items: ActivityItem[] = (changes ?? []).flatMap(
    ({entity, row, prev}): ActivityItem[] => {
      const key = `${entity.type}-${entity.id}-${row.version}`
      const base = {key, actorName: nameOf(row.actor), at: row.at}
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
            authors: people(Object.keys(e.shares)),
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
            authors: people(g.members.map(m => m.personId)),
          },
        ]
      }
      if (entity.type === 'person' && !prev && !(row.data as Person).isMe) {
        return [
          {
            ...base,
            type: 'person-added',
            subject: (row.data as Person).name,
            authors: people([entity.id]),
          },
        ]
      }
      return []
    },
  )

  return (
    <Layout.Screen testID="screen-activity">
      <Layout.Header.Outer>
        <Layout.Header.Content align="left">
          <Layout.Header.TitleText>
            <Trans>Activity</Trans>
          </Layout.Header.TitleText>
        </Layout.Header.Content>
        <HeaderAvatar />
      </Layout.Header.Outer>
      {changes === undefined ? (
        <Shimmer testID="activity-loading">
          {Array.from({length: PLACEHOLDER_ROWS}, (_, i) => (
            <NotificationFeedItemPlaceholder key={i} hideTopBorder={i === 0} />
          ))}
        </Shimmer>
      ) : (
        <LayoutAnimationConfig skipEntering skipExiting>
          <List
            data={items}
            keyExtractor={(item: ActivityItem) => item.key}
            renderItem={({
              item,
              index,
            }: {
              item: ActivityItem
              index: number
            }) => (
              <NotificationFeedItem item={item} hideTopBorder={index === 0} />
            )}
            ListEmptyComponent={
              <EmptyState
                testID="activity-empty"
                illustration="empty-activity"
                message={l`Nothing here yet. Expenses, payments and group changes will show up here.`}
              />
            }
            ListFooterComponent={
              !gtMobile ? <View style={{height: 100}} /> : undefined
            }
          />
        </LayoutAnimationConfig>
      )}
      <AddExpenseFAB />
    </Layout.Screen>
  )
}
