// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/view/screens/Notifications.tsx
import {useDeferredValue, useEffect} from 'react'
import {View} from 'react-native'
import Animated, {LayoutAnimationConfig, ZoomIn, ZoomOut} from 'react-native-reanimated'
import {Plural, Trans, useLingui} from '@lingui/react/macro'
import {useNavigation, useRoute} from '@react-navigation/native'
import {type ActivityTypeId} from '@splito/sync'

import {type Params, param} from '#/lib/links/listState'

import {useNumberLocale} from '#/locale/numberLocale'
import {Deferred} from '#/components/Deferred'
import {usePagedRows} from '#/lib/hooks/usePagedRows'
import {useDialogControl} from '#/components/Dialog'
import {usePref} from '#/data/hooks'
import {useShouldReduceMotion} from '#/motion/useShouldReduceMotion'
import {type NavigationProp} from '#/lib/routes/types'
import {EmptyState} from '#/view/com/util/EmptyState'
import {List} from '#/view/com/util/List'
import {atoms as a, useTheme} from '#/alf'
import {ActivityItem} from '#/components/activity/ActivityItem'
import {type ActivityTab, type FeedRow} from '#/components/activity/feed'
import {LoadingSkeleton} from '#/components/activity/LoadingSkeleton'
import {
  getBorderColor,
  SectionHeader,
} from '#/components/activity/SectionHeader'
import {useActivityActions} from '#/components/activity/useActivityActions'
import {useActivityFeed} from '#/components/activity/useActivityFeed'
import {AddExpenseFAB, AddExpenseFABInset} from '#/components/AddExpenseFAB'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import {SearchAskButton} from '#/components/SearchAsk/SearchAskButton'
import {HeaderLead} from '#/components/HeaderLead'
import {ActivityFilterDialog} from '#/components/activity/ActivityFilterDialog'
import {ACTIVITY_TABS, readActivityParams, activityParams, typesToParam} from '#/components/activity/urlState'
import {SettingsSliderVertical_Stroke2_Corner0_Rounded as FilterIcon} from '#/components/icons/SettingsSlider'
import {TimesLarge_Stroke2_Corner0_Rounded as ClearIcon} from '#/components/icons/Times'
import {MarkAllReadIcon} from '#/components/activity/icons'
import * as Layout from '#/components/Layout'
import {TabBar} from '#/components/TabBar'
import {Text} from '#/components/Typography'
import {Shimmer} from '#/motion/Shimmer'
import {useListAnimations} from '#/motion/listAnimations'

const NO_TYPES: readonly ActivityTypeId[] = []
/** A narrowed list reads older history until it shows this many changes. */
const MIN_LISTED = 20
const isNarrowedViewOrTab = (tab: ActivityTab, types: readonly ActivityTypeId[], group: string | undefined) => tab !== 'all' || types.length > 0 || !!group

const isUnreadRow = (row: FeedRow | undefined) =>
  row?.type === 'event' && !row.isRead

/**
 * Activity: every change in the local audit history (expenses, friends,
 * groups, payments) in Bluesky's notifications list, under one header per
 * day, with the tabs All / Me / Others (owner 92) and a Type filter (owner 173).
 * A bottom-bar / sidebar destination with Bluesky's unread badge (owner:
 * "make notification as activity and move to bottom"). Read and hidden marks
 * are personal and stay on this device.
 */
export function ActivityScreen() {
  const t = useTheme()
  const {t: l} = useLingui()
  const locale = useNumberLocale()
  const listAnimations = useListAnimations()
  /*
   * The tab and the types are the address (`/activity/me?type=transactions&group=<id>`, F-241): written on a tap or
   * an Apply, read from the route; what the address leaves out falls back to the saved choice (F-1213, F-259).
   */
  const navigation = useNavigation<NavigationProp>()
  const route = useRoute()
  const [savedTab, setSavedTab] = usePref('activity.tab')
  const [savedTypes, setSavedTypes] = usePref('activity.type')
  const fromAddress = readActivityParams(route.params as Params)
  const tabName: ActivityTab = fromAddress.tab ?? savedTab ?? 'all'
  const types = fromAddress.types ?? savedTypes ?? NO_TYPES
  const group = fromAddress.group
  const tab = ACTIVITY_TABS.indexOf(tabName)
  const setTab = (i: number) => {
    const next = ACTIVITY_TABS[i]!
    navigation.setParams({tab: param(next, 'all', savedTab ?? 'all') as ActivityTab | undefined})
    void setSavedTab(next)
  }
  const filterControl = useDialogControl({url: 'filters'})
  /* The filter dot counts the types chosen; a group scope has its own chip. */
  const activeFilterCount = types.length
  const applyTypes = (next: ActivityTypeId[]) => {
    navigation.setParams({type: activityParams({tab: tabName, types: next}, {tab: savedTab ?? 'all', types: savedTypes ?? NO_TYPES}).type})
    void setSavedTypes(next)
  }
  const clearGroup = () => navigation.setParams({group: undefined})
  const shouldReduceMotion = useShouldReduceMotion()
  /* The tab bar follows the tap at once; the list behind it re-renders as a transition (owner 151). */
  const bodyTab = useDeferredValue(tabName)
  const bodyTypes = useDeferredValue(types)
  const feed = useActivityFeed({tab: bodyTab, types: bodyTypes, group})
    const actions = useActivityActions(feed)
  const {snapshot, rows, hiddenCount, unreadCount, me} = feed
  const {shown, onEndReached: showMore} = usePagedRows(`${bodyTab}|${typesToParam(bodyTypes)}|${group}`)(rows)
  /* Rows already loaded appear a page at a time; past the last one, older history is read by cursor. */
  const onEndReached = () => {
    if (shown.length < rows.length) showMore()
    else if (!feed.isDone) feed.loadMore?.()
  }

  /*
   * A narrowed list (a tab, a type, a group) can find nothing in the newest page of history while older pages hold
   * matches: read older pages until a screenful is listed or the history ends.
   */
  const eventCount = rows.length - rows.filter(r => r.type === 'section').length
  const isSearchingOlder = !feed.isDone && !!feed.loadMore && eventCount < MIN_LISTED && isNarrowedViewOrTab(bodyTab, bodyTypes, group)
  const loadMore = feed.loadMore
  useEffect(() => {
    if (isSearchingOlder) loadMore?.()
  }, [isSearchingOlder, snapshot, loadMore])

  /* The empty state follows the tab and the filters (owner 173): it says what is missing, and a narrowed list offers the way out. */
  const isNarrowedView = bodyTypes.length > 0 || !!group
  const emptyMessage = () => {
    if (hiddenCount > 0) return l`You've hidden everything here. New expenses, payments and group changes will show up as they happen.`
    if (isNarrowedView) return l`Nothing matches these filters yet.`
    if (bodyTab === 'me') return l`Nothing from you yet. What you add or change shows up here.`
    if (bodyTab === 'others') return l`Nothing from other people yet. When someone else adds or changes something you share, it shows up here.`
    return l`Nothing here yet. Expenses, payments and group changes will show up here.`
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
    <Layout.Screen testID="screen-activity">
      {/* Rule set: avatar | Activity | Mark all read; the tabs travel with the header. */}
      <Layout.Header.Sticky>
        <Layout.Header.Outer noBottomBorder sticky={false}>
          <HeaderLead />
          {/* Balances Search & Ask on the right, so the title stays centred. */}
          <Layout.Header.Slot />
          <Layout.Header.Content>
            <Layout.Header.TitleText>
              <Trans>Activity</Trans>
            </Layout.Header.TitleText>
          </Layout.Header.Content>
          <SearchAskButton />
          <Layout.Header.ActionButton
            testID="activity-filters"
            label={activeFilterCount > 0 ? l`Filters, ${activeFilterCount} on` : l`Filters`}
            icon={FilterIcon}
            onPress={() => filterControl.open()}>
            {activeFilterCount > 0 ? (
              <Animated.View
                testID="activity-filters-dot"
                entering={shouldReduceMotion ? undefined : ZoomIn.springify()}
                exiting={shouldReduceMotion ? undefined : ZoomOut}
                style={[
                  a.absolute,
                  a.rounded_full,
                  {
                    top: 5,
                    right: 5,
                    width: 9,
                    height: 9,
                    borderWidth: 1.5,
                    borderColor: t.atoms.bg.backgroundColor,
                    backgroundColor: t.palette.primary_500,
                  },
                ]}
              />
            ) : null}
          </Layout.Header.ActionButton>
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
          items={[l`All`, l`Me`, l`Others`]}
          onSelect={setTab}
        />
        {group ? (
          <View style={[a.flex_row, a.px_lg, a.py_sm]}>
            <Button
              testID="activity-group-chip"
              label={l`Only ${feed.snapshot?.groups.get(group)?.data.name ?? l`this group`}. Show everything`}
              size="tiny"
              color="secondary"
              onPress={clearGroup}>
              <ButtonText>{feed.snapshot?.groups.get(group)?.data.name ?? l`This group`}</ButtonText>
              <ButtonIcon icon={ClearIcon} />
            </Button>
          </View>
        ) : null}
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
              /* Still reading older history for a match: the same-size skeleton, not "nothing matches" (owner 152). */
              isSearchingOlder ? (
                <Shimmer testID="activity-searching">
                  <LoadingSkeleton />
                </Shimmer>
              ) : (
              <EmptyState
                testID="activity-empty"
                illustration="empty-activity"
                message={emptyMessage()}
                button={
                  isNarrowedView
                    ? {
                        testID: 'activity-clear-filters',
                        label: l`Show every type`,
                        text: l`Show every type`,
                        onPress: () => {
                          applyTypes([])
                          clearGroup()
                        },
                      }
                    : undefined
                }
              />
              )
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
      <ActivityFilterDialog control={filterControl} types={types} onFiltersApplied={applyTypes} />
      <AddExpenseFAB />
    </Layout.Screen>
  )
}
