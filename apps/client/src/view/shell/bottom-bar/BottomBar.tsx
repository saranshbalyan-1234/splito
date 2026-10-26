// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/view/shell/bottom-bar/BottomBar.tsx
import {type JSX, useCallback} from 'react'
import {type GestureResponderEvent, View} from 'react-native'
import Animated from 'react-native-reanimated'
import {useSafeAreaInsets} from 'react-native-safe-area-context'
import {useLingui} from '@lingui/react'
import {type BottomTabBarProps} from '@react-navigation/bottom-tabs'
import {StackActions} from '@react-navigation/native'

import {PressableScale} from '#/lib/custom-animations/PressableScale'
import {useDedupe} from '#/lib/hooks/useDedupe'
import {useMinimalShellFooterTransform} from '#/lib/hooks/useMinimalShellTransform'
import {useNavigationTabState} from '#/lib/hooks/useNavigationTabState'
import {clamp} from '#/lib/numbers'
import {getTabState, TabState} from '#/lib/routes/helpers'
import {TAB_ROUTE, useTabs} from '#/lib/routes/tabs'
import {useShellLayout} from '#/state/shell/shell-layout'
import {type SidebarTab} from '#/view/shell/desktop/LeftNav'
import {atoms as a, useTheme} from '#/alf'
import {TAB_LABELS, TabGlyph} from '#/components/TabGlyph'
import {Text} from '#/components/Typography'
import {useAnalytics} from '#/analytics'
import {styles} from './BottomBarStyles'

/*
 * Bluesky's signed-in native bottom bar with Splito's tabs, in the order the
 * `tabs` preference sets. There is no centre button: Add expense is the FAB,
 * as Bluesky's compose action is.
 */
export function BottomBar({navigation}: BottomTabBarProps) {
  const t = useTheme()
  const {_} = useLingui()
  const ax = useAnalytics()
  const safeAreaInsets = useSafeAreaInsets()
  const {footerHeight} = useShellLayout()
  const tabState = useNavigationTabState()
  const tabs = useTabs()
  const dedupe = useDedupe()
  const footerMinimalShellTransform = useMinimalShellFooterTransform()
  const iconWidth = 28

  const isAt: Record<SidebarTab, boolean> = {
    People: tabState.isAtPeople,
    Groups: tabState.isAtGroups,
    Analytics: tabState.isAtAnalytics,
    Activity: tabState.isAtActivity,
    Profile: tabState.isAtProfile,
  }

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
        {tabs.map(tab => (
          <Btn
            key={tab}
            testID={`tab-${tab}`}
            icon={
              <TabGlyph
                tab={tab}
                isActive={isAt[TAB_ROUTE[tab]]}
                size={iconWidth}
              />
            }
            onPress={() => onPressTab(TAB_ROUTE[tab])}
            accessibilityRole="tab"
            accessibilityLabel={_(TAB_LABELS[tab])}
            accessibilityHint=""
          />
        ))}
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
