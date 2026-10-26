// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/view/shell/bottom-bar/BottomBar.tsx
import {type JSX, useCallback} from 'react'
import {type GestureResponderEvent, View} from 'react-native'
import Animated from 'react-native-reanimated'
import {useSafeAreaInsets} from 'react-native-safe-area-context'
import {useLingui} from '@lingui/react/macro'
import {type BottomTabBarProps} from '@react-navigation/bottom-tabs'
import {StackActions} from '@react-navigation/native'

import {PressableScale} from '#/lib/custom-animations/PressableScale'
import {useDedupe} from '#/lib/hooks/useDedupe'
import {useMinimalShellFooterTransform} from '#/lib/hooks/useMinimalShellTransform'
import {useNavigationTabState} from '#/lib/hooks/useNavigationTabState'
import {clamp} from '#/lib/numbers'
import {getTabState, TabState} from '#/lib/routes/helpers'
import {useShellLayout} from '#/state/shell/shell-layout'
import {useMe} from '#/data/hooks'
import {UserAvatar} from '#/view/com/util/UserAvatar'
import {type SidebarTab} from '#/view/shell/desktop/LeftNav'
import {atoms as a, useTheme} from '#/alf'
import {
  Bell_Filled_Corner0_Rounded as BellFilled,
  Bell_Stroke2_Corner0_Rounded as Bell,
} from '#/components/icons/Bell'
import {
  ChartPie_Filled_Corner0_Rounded as ChartPieFilled,
  ChartPie_Stroke2_Corner0_Rounded as ChartPie,
} from '#/components/icons/ChartPie'
import {
  Group3_Filled_Corner0_Rounded as GroupFilled,
  Group3_Stroke2_Corner0_Rounded as Group,
} from '#/components/icons/Group'
import {
  HomeOpen_Filled_Corner0_Rounded as HomeFilled,
  HomeOpen_Stoke2_Corner0_Rounded as Home,
} from '#/components/icons/HomeOpen'
import {Text} from '#/components/Typography'
import {useAnalytics} from '#/analytics'
import {styles} from './BottomBarStyles'

export function BottomBar({navigation}: BottomTabBarProps) {
  const t = useTheme()
  const {t: l} = useLingui()
  const ax = useAnalytics()
  const safeAreaInsets = useSafeAreaInsets()
  const {footerHeight} = useShellLayout()
  const {isAtPeople, isAtGroups, isAtAnalytics, isAtActivity, isAtProfile} =
    useNavigationTabState()
  const me = useMe()
  const dedupe = useDedupe()
  const footerMinimalShellTransform = useMinimalShellFooterTransform()
  const iconWidth = 28

  const onPressTab = useCallback(
    (tab: SidebarTab) => {
      ax.metric('nav:click', {
        item: tab.toLowerCase(),
        surface: 'bottomBar',
      })
      const state = navigation.getState()
      const tabState = getTabState(state, tab)
      if (tabState === TabState.InsideAtRoot) {
        // Splito screens have no soft reset (scroll to top) yet.
      } else if (tabState === TabState.Inside) {
        // find the correct navigator in which to pop-to-top
        const target = state.routes.find(route => route.name === tab)?.state
          ?.key
        dedupe(() => {
          if (target) {
            // if we found it, trigger pop-to-top
            navigation.dispatch({
              ...StackActions.popToTop(),
              target,
            })
          } else {
            // fallback: reset navigation
            navigation.reset({
              index: 0,
              routes: [{name: tab}],
            })
          }
        })
      } else {
        dedupe(() => navigation.navigate(tab))
      }
    },
    [navigation, dedupe, ax],
  )
  const onPressPeople = useCallback(() => onPressTab('People'), [onPressTab])
  const onPressGroups = useCallback(() => onPressTab('Groups'), [onPressTab])
  const onPressAnalytics = useCallback(
    () => onPressTab('Analytics'),
    [onPressTab],
  )
  const onPressActivity = useCallback(
    () => onPressTab('Activity'),
    [onPressTab],
  )
  const onPressProfile = useCallback(() => {
    onPressTab('Profile')
  }, [onPressTab])

  return (
    <>
      <Animated.View
        style={[
          styles.bottomBar,
          t.atoms.bg,
          t.atoms.border_contrast_low,
          {paddingBottom: clamp(safeAreaInsets.bottom, 15, 60)},
          footerMinimalShellTransform,
        ]}
        onLayout={e => {
          footerHeight.set(e.nativeEvent.layout.height)
        }}>
        <>
          <Btn
            testID="tab-people"
            icon={
              isAtPeople ? (
                <HomeFilled
                  width={iconWidth + 1}
                  style={[styles.ctrlIcon, t.atoms.text, styles.homeIcon]}
                />
              ) : (
                <Home
                  width={iconWidth + 1}
                  style={[styles.ctrlIcon, t.atoms.text, styles.homeIcon]}
                />
              )
            }
            onPress={onPressPeople}
            accessibilityRole="tab"
            accessibilityLabel={l`People`}
            accessibilityHint=""
          />
          <Btn
            testID="tab-groups"
            icon={
              isAtGroups ? (
                <GroupFilled
                  width={iconWidth + 2}
                  style={[styles.ctrlIcon, t.atoms.text, styles.searchIcon]}
                />
              ) : (
                <Group
                  width={iconWidth + 2}
                  style={[styles.ctrlIcon, t.atoms.text, styles.searchIcon]}
                />
              )
            }
            onPress={onPressGroups}
            accessibilityRole="tab"
            accessibilityLabel={l`Groups`}
            accessibilityHint=""
          />
          {/* No centre button: Add expense is the FAB, as Bluesky's compose action is. */}
          <Btn
            testID="tab-analytics"
            icon={
              isAtAnalytics ? (
                <ChartPieFilled
                  width={iconWidth}
                  style={[styles.ctrlIcon, t.atoms.text]}
                />
              ) : (
                <ChartPie
                  width={iconWidth}
                  style={[styles.ctrlIcon, t.atoms.text]}
                />
              )
            }
            onPress={onPressAnalytics}
            accessibilityRole="tab"
            accessibilityLabel={l`Analytics`}
            accessibilityHint=""
          />
          <Btn
            testID="tab-activity"
            icon={
              isAtActivity ? (
                <BellFilled
                  width={iconWidth}
                  style={[styles.ctrlIcon, t.atoms.text, styles.bellIcon]}
                />
              ) : (
                <Bell
                  width={iconWidth}
                  style={[styles.ctrlIcon, t.atoms.text, styles.bellIcon]}
                />
              )
            }
            onPress={onPressActivity}
            accessible={true}
            accessibilityRole="tab"
            accessibilityLabel={l`Activity`}
            accessibilityHint=""
          />
          <Btn
            testID="tab-profile"
            icon={
              <View style={styles.ctrlIconSizingWrapper}>
                <View
                  style={[
                    styles.ctrlIcon,
                    styles.profileIcon,
                    isAtProfile && [
                      styles.onProfile,
                      {
                        borderColor: t.atoms.text.color,
                        borderWidth: 1,
                      },
                    ],
                  ]}>
                  <UserAvatar
                    name={me?.data.name}
                    size={iconWidth - (isAtProfile ? 3 : 2)}
                    type="user"
                  />
                </View>
              </View>
            }
            onPress={onPressProfile}
            accessibilityRole="tab"
            accessibilityLabel={l`Profile`}
            accessibilityHint=""
          />
        </>
      </Animated.View>
    </>
  )
}

interface BtnProps extends Pick<
  React.ComponentProps<typeof PressableScale>,
  | 'accessible'
  | 'accessibilityRole'
  | 'accessibilityHint'
  | 'accessibilityLabel'
> {
  testID?: string
  icon: JSX.Element
  notificationCount?: string
  hasNew?: boolean
  onPress?: (event: GestureResponderEvent) => void
  onLongPress?: (event: GestureResponderEvent) => void
}

function Btn({
  testID,
  icon,
  hasNew,
  notificationCount,
  onPress,
  onLongPress,
  accessible,
  accessibilityHint,
  accessibilityLabel,
}: BtnProps) {
  const t = useTheme()

  return (
    <PressableScale
      testID={testID}
      style={[styles.ctrl, a.flex_1]}
      onPress={onPress}
      onLongPress={onLongPress}
      accessible={accessible}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      targetScale={0.8}
      accessibilityLargeContentTitle={accessibilityLabel}
      accessibilityShowsLargeContentViewer>
      {icon}
      {notificationCount ? (
        <View
          style={[
            styles.notificationCount,
            a.rounded_full,
            {backgroundColor: t.palette.primary_500},
          ]}>
          <Text
            style={styles.notificationCountLabel}
            maxFontSizeMultiplier={1.5}>
            {notificationCount}
          </Text>
        </View>
      ) : hasNew ? (
        <View
          style={[styles.hasNewBadge, {backgroundColor: t.palette.primary_500}]}
        />
      ) : null}
    </PressableScale>
  )
}
