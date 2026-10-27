// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/view/shell/bottom-bar/BottomBarWeb.tsx
import {useCallback} from 'react'
import {View} from 'react-native'
import Animated from 'react-native-reanimated'
import {useLingui} from '@lingui/react'
import {useNavigationState} from '@react-navigation/native'
import {type NavItemId} from '@splito/sync'

import {useMinimalShellFooterTransform} from '#/lib/hooks/useMinimalShellTransform'
import {currentSection} from '#/lib/routes/section'
import {NAV_ITEM_HREF, NAV_ITEM_ROUTE} from '#/lib/routes/navigationItems'
import {useTabs} from '#/lib/routes/tabs'

import {useShellLayout} from '#/state/shell/shell-layout'
import {Link} from '#/view/com/util/Link'
import {atoms as a, useTheme} from '#/alf'
import {
  describeUnread,
  useActivityBadge,
} from '#/components/activity/useActivityFeed'
import {PressableScale} from '#/motion/PressableScale'
import {useSearchAsk} from '#/components/SearchAsk/context'
import {NAV_LABELS, TabGlyph} from '#/components/TabGlyph'
import {Text} from '#/components/Typography'
import {useAnalytics} from '#/analytics'
import {styles} from './BottomBarStyles'

type NavItemValue = NavItemId

/*
 * Bluesky's signed-in mobile-web bottom bar with the items the `tabs`
 * preference picks from the shared nav list (Settings > Navigation), in its
 * order. Ask Splito opens the Search & Ask drawer instead of a page. There is
 * no centre button: Add expense is the FAB, as Bluesky's compose action is.
 */
export function BottomBarWeb() {
  const {_} = useLingui()
  const t = useTheme()
  const footerMinimalShellTransform = useMinimalShellFooterTransform()
  const {footerHeight} = useShellLayout()
  const tabs = useTabs()
  const iconWidth = 26
  const activityBadge = useActivityBadge()
  const searchAsk = useSearchAsk()
  /* Only the bar's own pages light up; under any other page the tab it was opened from stays lit. */
  const sections = tabs.flatMap(tab => NAV_ITEM_ROUTE[tab] ?? [])

  return (
    <>
      <Animated.View
        role="navigation"
        style={[
          styles.bottomBar,
          styles.bottomBarWeb,
          t.atoms.bg,
          t.atoms.border_contrast_low,
          footerMinimalShellTransform,
        ]}
        onLayout={event => footerHeight.set(event.nativeEvent.layout.height)}>
        {tabs.map(tab => {
          const routeName = NAV_ITEM_ROUTE[tab]
          const href = NAV_ITEM_HREF[tab]
          if (!routeName || !href) {
            return (
              <PressableScale
                key={tab}
                testID={`tab-${tab}`}
                style={[styles.ctrl, a.pb_lg]}
                accessibilityRole="button"
                accessibilityLabel={_(NAV_LABELS[tab])}
                accessibilityHint=""
                targetScale={0.8}
                // TODO(F-2301): open straight in Ask mode.
                onPress={() => searchAsk.open()}>
                <TabGlyph tab={tab} isActive={false} size={iconWidth} />
              </PressableScale>
            )
          }
          return (
            <NavItem
              key={tab}
              routeName={routeName}
              sections={sections}
              label={_(NAV_LABELS[tab])}
              href={href}
              navItem={tab}
              notificationCount={
                tab === 'activity' ? activityBadge : undefined
              }>
              {({isActive}) => (
                <TabGlyph tab={tab} isActive={isActive} size={iconWidth} />
              )}
            </NavItem>
          )
        })}
      </Animated.View>
    </>
  )
}

const NavItem: React.FC<{
  children: (props: {isActive: boolean}) => React.ReactNode
  href: string
  routeName: string
  /** The bar's pages, so a page outside them keeps its tab lit. */
  sections: readonly string[]
  label: string
  navItem: NavItemValue
  hasNew?: boolean
  notificationCount?: string
  onLongPress?: () => void
}> = ({
  children,
  href,
  routeName,
  sections,
  label,
  navItem,
  hasNew,
  notificationCount,
  onLongPress,
}) => {
  const t = useTheme()
  const ax = useAnalytics()
  /* Under a page that is not in the bar (Settings, unless added) the tab it was opened from stays lit, as Bluesky's does. */
  const section = useNavigationState(state => currentSection(state, sections))

  const onBeforePress = useCallback(() => {
    ax.metric('nav:click', {item: navItem, surface: 'bottomBar'})
  }, [ax, navItem])

  const isActive = section === routeName

  return (
    <Link
      testID={`tab-${navItem}`}
      href={href}
      style={[styles.ctrl, a.pb_lg]}
      navigationAction="navigate"
      aria-role="link"
      aria-label={label}
      aria-current={isActive ? 'page' : undefined}
      accessible={true}
      onBeforePress={onBeforePress}
      onLongPress={onLongPress}>
      {children({isActive})}
      {notificationCount ? (
        <View
          style={[
            styles.notificationCount,
            styles.notificationCountWeb,
            {backgroundColor: t.palette.primary_500},
          ]}
          aria-label={describeUnread(notificationCount)}>
          <Text
            testID={`nav-badge-${navItem}`}
            style={styles.notificationCountLabel}>
            {notificationCount}
          </Text>
        </View>
      ) : hasNew ? (
        <View
          style={[styles.hasNewBadge, {backgroundColor: t.palette.primary_500}]}
        />
      ) : null}
    </Link>
  )
}
