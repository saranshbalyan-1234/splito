// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/view/screens/Notifications.tsx
import {useState} from 'react'
import {View} from 'react-native'
import Animated, {LayoutAnimationConfig} from 'react-native-reanimated'
import {Plural, Trans, useLingui} from '@lingui/react/macro'
import {PREFS} from '@splito/sync'

import {useNumberLocale} from '#/locale/numberLocale'
import {usePref} from '#/data/hooks'
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
import {HeaderAvatar} from '#/components/HeaderAvatar'
import {MarkAllReadIcon} from '#/components/activity/icons'
import * as Layout from '#/components/Layout'
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
  const [tab, setTab] = useState(0)
  const feed = useActivityFeed(tab === 0 ? 'all' : 'others')
  const actions = useActivityActions(feed)
  const [swipeLeft = PREFS.swipeLeft.default] = usePref('swipeLeft')
  const [swipeRight = PREFS.swipeRight.default] = usePref('swipeRight')
  const {snapshot, rows, hiddenCount, unreadCount, me} = feed

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
          swipeLeft={swipeLeft}
          swipeRight={swipeRight}
          actions={actions}
        />
      </Animated.View>
    )
  }

  return (
    <Layout.Screen testID="screen-activity">
      {/* Rule set: avatar | Activity | Mark all read; the tabs travel with the header. */}
      <Layout.Header.Sticky>
        <Layout.Header.Outer noBottomBorder sticky={false}>
          <HeaderAvatar />
          <Layout.Header.Content>
            <Layout.Header.TitleText>
              <Trans>Activity</Trans>
            </Layout.Header.TitleText>
          </Layout.Header.Content>
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
          items={[l`All`, l`From others`]}
          onSelect={setTab}
        />
      </Layout.Header.Sticky>
      {snapshot === undefined ? (
        <Shimmer testID="activity-loading">
          <LoadingSkeleton />
        </Shimmer>
      ) : (
        <LayoutAnimationConfig skipEntering skipExiting>
          <List
            testID="activity-list"
            data={rows}
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
                    : tab === 1
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
                      rows.length > 0 && [
                        a.border_t,
                        getBorderColor(t, isUnreadRow(rows.at(-1))),
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
      <AddExpenseFAB />
    </Layout.Screen>
  )
}
