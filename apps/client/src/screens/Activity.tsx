// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/view/screens/Notifications.tsx
import {useDeferredValue} from 'react'
import {View} from 'react-native'
import Animated, {LayoutAnimationConfig} from 'react-native-reanimated'
import {Plural, Trans, useLingui} from '@lingui/react/macro'
import {useNavigation, useRoute} from '@react-navigation/native'

import {useNumberLocale} from '#/locale/numberLocale'
import {Deferred} from '#/components/Deferred'
import {usePagedRows} from '#/lib/hooks/usePagedRows'
import {type NavigationProp} from '#/lib/routes/types'
import {EmptyState} from '#/view/com/util/EmptyState'
import {List} from '#/view/com/util/List'
import {atoms as a, useTheme} from '#/alf'
import {ActivityItem} from '#/components/activity/ActivityItem'
import {type FeedRow} from '#/components/activity/feed'
import {LoadingSkeleton} from '#/components/activity/LoadingSkeleton'
import {
  getBorderColor,
  SectionHeader,
} from '#/components/activity/SectionHeader'
import {useActivityActions} from '#/components/activity/useActivityActions'
import {useActivityFeed} from '#/components/activity/useActivityFeed'
import {AddExpenseFAB, AddExpenseFABInset} from '#/components/AddExpenseFAB'
import {Button, ButtonText} from '#/components/Button'
import {SearchAskButton} from '#/components/SearchAsk/SearchAskButton'
import {HeaderAvatar} from '#/components/HeaderAvatar'
import {MarkAllReadIcon} from '#/components/activity/icons'
import * as Layout from '#/components/Layout'
import {TabScreen} from '#/components/TabScreen'
import {TabBar} from '#/components/TabBar'
import {Text} from '#/components/Typography'
import {Shimmer} from '#/motion/Shimmer'
import {useListAnimations} from '#/motion/listAnimations'

const isUnreadRow = (row: FeedRow | undefined) =>
  row?.type === 'event' && !row.isRead

/**
 * Activity: every change in the local audit history (expenses, friends,
 * groups, payments) in Bluesky's notifications list, under one header per
 * day, with Bluesky's "All" tab and a "From others" tab in its Mentions slot.
 * A bottom-bar / sidebar destination with Bluesky's unread badge (owner:
 * "make notification as activity and move to bottom"). Read and hidden marks
 * are personal and stay on this device.
 */
export function ActivityScreen() {
  const t = useTheme()
  const {t: l} = useLingui()
  const locale = useNumberLocale()
  const listAnimations = useListAnimations()
  /* The tab is the address (`/activity/others`, F-241): written on a tap, read from the route. */
  const navigation = useNavigation<NavigationProp>()
  const tabParam = (useRoute().params as {tab?: string} | undefined)?.tab
  const tab = tabParam === 'others' ? 1 : tabParam === 'disputed' ? 2 : 0
  const setTab = (i: number) => navigation.setParams({tab: i === 1 ? 'others' : i === 2 ? 'disputed' : undefined})
  /* The tab bar follows the tap at once; the list behind it re-renders as a transition (owner 151). */
  const bodyTab = useDeferredValue(tab)
  const feed = useActivityFeed(bodyTab === 0 ? 'all' : bodyTab === 1 ? 'others' : 'disputed')
  const actions = useActivityActions(feed)
  const {snapshot, rows, hiddenCount, unreadCount, me} = feed
  const {shown, onEndReached: showMore} = usePagedRows(bodyTab)(rows)
  /* Rows already loaded appear a page at a time; past the last one, older history is read by cursor. */
  const onEndReached = () => {
    if (shown.length < rows.length) showMore()
    else if (!feed.isDone) feed.loadMore?.()
  }

  const renderItem = ({item: row, index}: {item: FeedRow; index: number}) => {
    if (!snapshot) return null
    if (row.type === 'section') {
      return (
        <SectionHeader
          day={row.day}
          isFirst={index === 0}
          isUnreadAbove={isUnreadRow(rows[index - 1])}
          isUnreadBelow={isUnreadRow(rows[index + 1])}
        />
      )
    }
    return (
      <Animated.View
        {...listAnimations}
        style={[
          row.hasDivider && [
            a.border_t,
            getBorderColor(t, isUnreadRow(rows[index - 1]) || !row.isRead),
          ],
        ]}>
        <ActivityItem
          event={row.event}
          isRead={row.isRead}
          snapshot={snapshot}
          me={me}
          locale={locale}
          actions={actions}
        />
      </Animated.View>
    )
  }

  return (
    <TabScreen testID="screen-activity">
      {/* Rule set: avatar | Activity | Mark all read; the tabs travel with the header. */}
      <Layout.Header.Sticky>
        <Layout.Header.Outer noBottomBorder sticky={false}>
          <HeaderAvatar />
          {/* Balances Search & Ask on the right, so the title stays centred. */}
          <Layout.Header.Slot />
          <Layout.Header.Content>
            <Layout.Header.TitleText>
              <Trans>Activity</Trans>
            </Layout.Header.TitleText>
          </Layout.Header.Content>
          <SearchAskButton />
          <Layout.Header.ActionButton
            testID="activity-mark-all-read"
            label={l`Mark all read`}
            icon={MarkAllReadIcon}
            edge
            disabled={unreadCount === 0}
            onPress={actions.markEverythingRead}
          />
        </Layout.Header.Outer>
        <TabBar
          testID="activity-tabs"
          selectedPage={tab}
          items={[l`All`, l`From others`, l`Disputed`]}
          onSelect={setTab}
        />
      </Layout.Header.Sticky>
      {/* Shell first (owner 152): the header paints at once, a skeleton while the data is missing, the list mounts after as a transition. */}
      <Deferred
        when={snapshot !== undefined}
        fallback={
        <Shimmer testID="activity-loading">
          <LoadingSkeleton />
        </Shimmer>
        }>
        {() => (
        <LayoutAnimationConfig skipEntering skipExiting>
          <List
            testID="activity-list"
            data={shown}
            onEndReached={onEndReached}
            keyExtractor={(row: FeedRow) => row.key}
            renderItem={renderItem}
            sideBorders={false}
            ListEmptyComponent={
              <EmptyState
                testID="activity-empty"
                illustration="empty-activity"
                message={
                  hiddenCount > 0
                    ? l`You've hidden everything here. New expenses, payments and group changes will show up as they happen.`
                    : bodyTab === 2
                      ? l`No disputes or holds. When someone questions an expense or puts it on hold, it shows up here.`
                    : bodyTab === 1
                      ? l`Nothing from other people yet. When someone else adds or changes something you share, it shows up here.`
                      : l`Nothing here yet. Expenses, payments and group changes will show up here.`
                }
              />
            }
            ListFooterComponent={
              <>
                {hiddenCount > 0 ? (
                  <View
                    testID="activity-hidden-footer"
                    style={[
                      a.flex_row,
                      a.align_center,
                      a.justify_center,
                      a.gap_sm,
                      a.px_lg,
                      a.py_lg,
                      shown.length > 0 && [
                        a.border_t,
                        getBorderColor(t, isUnreadRow(shown.at(-1))),
                      ],
                    ]}>
                    <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
                      <Plural
                        value={hiddenCount}
                        one="# change hidden from your activity"
                        other="# changes hidden from your activity"
                      />
                    </Text>
                    <Button
                      testID="activity-unhide-all"
                      label={l`Show hidden changes`}
                      color="secondary"
                      variant="ghost"
                      size="tiny"
                      onPress={actions.unhideAll}>
                      <ButtonText>
                        <Trans>Show them</Trans>
                      </ButtonText>
                    </Button>
                  </View>
                ) : null}
                {/* Clears the FAB and bottom bar on phones. */}
                <AddExpenseFABInset />
              </>
            }
          />
        </LayoutAnimationConfig>
        )}
      </Deferred>
      <AddExpenseFAB />
    </TabScreen>
  )
}
