// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/view/shell/bottom-bar/BottomBarWeb.tsx
import {useCallback} from 'react'
import {View} from 'react-native'
import Animated from 'react-native-reanimated'
import {msg, plural} from '@lingui/core/macro'
import {useLingui} from '@lingui/react'
import {useNavigationState} from '@react-navigation/native'
import {type TabId} from '@splito/sync'

import {useMinimalShellFooterTransform} from '#/lib/hooks/useMinimalShellTransform'
import {getCurrentRoute, isTab} from '#/lib/routes/helpers'
import {TAB_ROUTE, tabHref, useTabs} from '#/lib/routes/tabs'
import {useShellLayout} from '#/state/shell/shell-layout'
import {Link} from '#/view/com/util/Link'
import {atoms as a, useTheme} from '#/alf'
import {TAB_LABELS, TabGlyph} from '#/components/TabGlyph'
import {Text} from '#/components/Typography'
import {useAnalytics} from '#/analytics'
import {styles} from './BottomBarStyles'

type NavItemValue = TabId

/*
 * Bluesky's signed-in mobile-web bottom bar with Splito's tabs, in the order
 * the `tabs` preference sets. There is no centre button: Add expense is the
 * FAB, as Bluesky's compose action is.
 */
export function BottomBarWeb() {
  const {_} = useLingui()
  const t = useTheme()
  const footerMinimalShellTransform = useMinimalShellFooterTransform()
  const {footerHeight} = useShellLayout()
  const tabs = useTabs()
  const iconWidth = 26

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
        {tabs.map(tab => (
          <NavItem
            key={tab}
            routeName={TAB_ROUTE[tab]}
            label={_(TAB_LABELS[tab])}
            href={tabHref(tab)}
            navItem={tab}>
            {({isActive}) => (
              <TabGlyph tab={tab} isActive={isActive} size={iconWidth} />
            )}
          </NavItem>
        ))}
      </Animated.View>
    </>
  )
}

const NavItem: React.FC<{
  children: (props: {isActive: boolean}) => React.ReactNode
  href: string
  routeName: string
  label: string
  navItem: NavItemValue
  hasNew?: boolean
  notificationCount?: string
  onLongPress?: () => void
}> = ({
  children,
  href,
  routeName,
  label,
  navItem,
  hasNew,
  notificationCount,
  onLongPress,
}) => {
  const t = useTheme()
  const {_} = useLingui()
  const ax = useAnalytics()
  const currentRoute = useNavigationState(state => {
    if (!state) {
      return {name: 'People'}
    }
    return getCurrentRoute(state)
  })

  const onBeforePress = useCallback(() => {
    ax.metric('nav:click', {item: navItem, surface: 'bottomBar'})
  }, [ax, navItem])

  const isActive = isTab(currentRoute.name, routeName)

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
          aria-label={_(
            msg`${plural(notificationCount, {
              one: '# unread item',
              other: '# unread items',
            })}`,
          )}>
          <Text style={styles.notificationCountLabel}>{notificationCount}</Text>
        </View>
      ) : hasNew ? (
        <View
          style={[styles.hasNewBadge, {backgroundColor: t.palette.primary_500}]}
        />
      ) : null}
    </Link>
  )
}
