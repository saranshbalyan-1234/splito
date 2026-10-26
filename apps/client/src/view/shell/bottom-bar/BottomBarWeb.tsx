// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/view/shell/bottom-bar/BottomBarWeb.tsx
import {useCallback} from 'react'
import {View} from 'react-native'
import Animated from 'react-native-reanimated'
import {msg, plural} from '@lingui/core/macro'
import {useLingui} from '@lingui/react'
import {useNavigation, useNavigationState} from '@react-navigation/native'

import {getCurrentRoute, isTab} from '#/lib/routes/helpers'
import {type NavigationProp} from '#/lib/routes/types'
import {useShellLayout} from '#/state/shell/shell-layout'
import {useMe} from '#/data/hooks'
import {Link} from '#/view/com/util/Link'
import {UserAvatar} from '#/view/com/util/UserAvatar'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonIcon} from '#/components/Button'
import {
  Bell_Filled_Corner0_Rounded as BellFilled,
  Bell_Stroke2_Corner0_Rounded as Bell,
} from '#/components/icons/Bell'
import {
  Group3_Filled_Corner0_Rounded as GroupFilled,
  Group3_Stroke2_Corner0_Rounded as Group,
} from '#/components/icons/Group'
import {
  Person_Filled_Corner2_Rounded as PersonFilled,
  Person_Stroke2_Corner2_Rounded as Person,
} from '#/components/icons/Person'
import {PlusLarge_Stroke2_Corner0_Rounded as PlusIcon} from '#/components/icons/Plus'
import {Text} from '#/components/Typography'
import {useAnalytics} from '#/analytics'
import {styles} from './BottomBarStyles'

type NavItemValue = 'people' | 'groups' | 'activity' | 'profile'

export function BottomBarWeb() {
  const {_} = useLingui()
  const t = useTheme()
  const {footerHeight} = useShellLayout()
  const navigation = useNavigation<NavigationProp>()
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
        ]}
        onLayout={event => footerHeight.set(event.nativeEvent.layout.height)}>
        <>
          <NavItem routeName="People" href="/" navItem="people">
            {({isActive}) => {
              const Icon = isActive ? PersonFilled : Person
              return (
                <Icon
                  aria-hidden={true}
                  width={iconWidth + 1}
                  style={[styles.ctrlIcon, t.atoms.text, styles.homeIcon]}
                />
              )
            }}
          </NavItem>
          <NavItem routeName="Groups" href="/groups" navItem="groups">
            {({isActive}) => {
              const Icon = isActive ? GroupFilled : Group
              return (
                <Icon
                  aria-hidden={true}
                  width={iconWidth + 2}
                  style={[styles.ctrlIcon, t.atoms.text, styles.searchIcon]}
                />
              )
            }}
          </NavItem>

          {/* Spec: phones get a central +. Bluesky's compose action, in the middle slot. */}
          <View style={[styles.ctrl, a.pb_lg, a.align_center, a.justify_center]}>
            <Button
              testID="tab-add"
              label={_(msg`Add expense`)}
              onPress={() => navigation.navigate('AddExpense', {})}
              size="small"
              shape="round"
              color="primary">
              <ButtonIcon icon={PlusIcon} size="md" />
            </Button>
          </View>

          <NavItem routeName="Activity" href="/activity" navItem="activity">
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
          <NavItem routeName="Profile" href="/profile" navItem="profile">
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
  navItem: NavItemValue
  hasNew?: boolean
  notificationCount?: string
  onLongPress?: () => void
}> = ({
  children,
  href,
  routeName,
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
      aria-label={routeName}
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
