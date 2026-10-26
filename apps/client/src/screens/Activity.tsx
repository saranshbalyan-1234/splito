// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/view/screens/Notifications.tsx
import {useState} from 'react'
import {View} from 'react-native'
import {LayoutAnimationConfig} from 'react-native-reanimated'
import {Trans, useLingui} from '@lingui/react/macro'

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
import {CheckDouble_Stroke2_Corner0_Rounded as MarkReadIcon} from '#/components/icons/Check'
import * as Layout from '#/components/Layout'
import {TabBar} from '#/components/TabBar'
import * as Toast from '#/components/Toast'
import {Shimmer} from '#/motion/Shimmer'
import {useMarkAllRead, useNotifications} from '#/features/notifications'

const PLACEHOLDER_ROWS = 8

// As upstream: not persisted across reloads, but kept for the session.
let lastActiveTab = 0

/**
 * Activity: Bluesky's Notifications screen over the local store's history,
 * a bottom-bar / sidebar tab. The avatar, the title and "Mark all read" in
 * the header, then the "All" / "From others" tabs (Bluesky's All /
 * Mentions). Upstream pages between the tabs with a pager; Splito's tabs
 * filter one list, so there is no swipe between them on native.
 */
export function ActivityScreen() {
  const {t: l} = useLingui()
  const {gtMobile} = useBreakpoints()
  const items = useNotifications()
  const markAllRead = useMarkAllRead()
  const [activeTab, setActiveTab] = useState(lastActiveTab)
  const hasUnread = !!items?.some(item => item.isUnread)

  const selectTab = (index: number) => {
    setActiveTab(index)
    lastActiveTab = index
  }

  const markRead = () => {
    markAllRead()
    Toast.show(l`All caught up`, {type: 'success'})
  }

  const shown =
    activeTab === 0 ? items : items?.filter(item => item.isFromOthers)

  return (
    <Layout.Screen testID="screen-activity">
      <Layout.Header.Sticky>
        <Layout.Header.Outer noBottomBorder sticky={false}>
          <HeaderAvatar />
          <Layout.Header.Content>
            <Layout.Header.TitleText>
              <Trans>Activity</Trans>
            </Layout.Header.TitleText>
          </Layout.Header.Content>
          <Layout.Header.ActionButton
            testID="activity-mark-read"
            label={l`Mark all read`}
            icon={MarkReadIcon}
            edge
            disabled={!hasUnread}
            onPress={markRead}
          />
        </Layout.Header.Outer>
        <TabBar
          testID="activity-tabs"
          items={[l`All`, l`From others`]}
          selectedPage={activeTab}
          onSelect={selectTab}
        />
      </Layout.Header.Sticky>
      {shown === undefined ? (
        <Shimmer testID="activity-loading">
          {Array.from({length: PLACEHOLDER_ROWS}, (_, i) => (
            <NotificationFeedItemPlaceholder key={i} hideTopBorder={i === 0} />
          ))}
        </Shimmer>
      ) : (
        <LayoutAnimationConfig skipEntering skipExiting>
          <List
            data={shown}
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
                message={
                  activeTab === 0
                    ? l`Nothing here yet. Expenses, payments and group changes will show up here.`
                    : l`Nothing from others yet. When friends add or change expenses, you’ll see it here.`
                }
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
