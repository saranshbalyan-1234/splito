// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/view/shell/bottom-bar/BottomBarWeb.tsx
import {useCallback} from 'react'
import {View} from 'react-native'
import Animated from 'react-native-reanimated'
import {msg, plural} from '@lingui/core/macro'
import {useLingui} from '@lingui/react'
import {useNavigationState} from '@react-navigation/native'

import {useMinimalShellFooterTransform} from '#/lib/hooks/useMinimalShellTransform'
import {getCurrentRoute, isTab} from '#/lib/routes/helpers'
import {useShellLayout} from '#/state/shell/shell-layout'
import {useMe} from '#/data/hooks'
import {Link} from '#/view/com/util/Link'
import {UserAvatar} from '#/view/com/util/UserAvatar'
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

type NavItemValue = 'people' | 'groups' | 'analytics' | 'activity' | 'profile'

/*
 * Bluesky's signed-in mobile-web bottom bar with Splito's five tabs. There is
 * no centre button: Add expense is the FAB, as Bluesky's compose action is.
 */
export function BottomBarWeb() {
  const {_} = useLingui()
  const t = useTheme()
  const footerMinimalShellTransform = useMinimalShellFooterTransform()
  const {footerHeight} = useShellLayout()
  const me = useMe()
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
        <>
          <NavItem
            routeName="People"
            label={_(msg`People`)}
            href="/"
            navItem="people">
            {({isActive}) => {
              const Icon = isActive ? HomeFilled : Home
              return (
                <Icon
                  aria-hidden={true}
                  width={iconWidth + 1}
                  style={[styles.ctrlIcon, t.atoms.text, styles.homeIcon]}
                />
              )
            }}
          </NavItem>
          <NavItem
            routeName="Groups"
            label={_(msg`Groups`)}
            href="/groups"
            navItem="groups">
            {({isActive}) => {
              const Icon = isActive ? GroupFilled : Group
              return (
                <Icon
                  aria-hidden={true}
                  width={iconWidth + 1}
                  style={[styles.ctrlIcon, t.atoms.text]}
                />
              )
            }}
          </NavItem>
          <NavItem
            routeName="Analytics"
            label={_(msg`Analytics`)}
            href="/analytics"
            navItem="analytics">
            {({isActive}) => {
              const Icon = isActive ? ChartPieFilled : ChartPie
              return (
                <Icon
                  aria-hidden={true}
                  width={iconWidth}
                  style={[styles.ctrlIcon, t.atoms.text]}
                />
              )
            }}
          </NavItem>
          <NavItem
            routeName="Activity"
            label={_(msg`Activity`)}
            href="/activity"
            navItem="activity">
            {({isActive}) => {
              const Icon = isActive ? BellFilled : Bell
              return (
                <Icon
                  aria-hidden={true}
                  width={iconWidth}
                  style={[styles.ctrlIcon, t.atoms.text, styles.bellIcon]}
                />
              )
            }}
          </NavItem>
          <NavItem
            routeName="Profile"
            label={_(msg`Profile`)}
            href="/profile"
            navItem="profile">
            {({isActive}) => (
              <View style={styles.ctrlIconSizingWrapper}>
                <View
                  style={[
                    styles.ctrlIcon,
                    styles.profileIcon,
                    isActive && [
                      styles.onProfile,
                      {borderColor: t.atoms.text.color},
                    ],
                  ]}>
                  <UserAvatar
                    name={me?.data.name}
                    size={iconWidth - 3}
                    type="user"
                  />
                </View>
              </View>
            )}
          </NavItem>
        </>
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
