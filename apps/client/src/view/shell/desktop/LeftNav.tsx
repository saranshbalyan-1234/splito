// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/view/shell/desktop/LeftNav.tsx
import {useCallback, useMemo} from 'react'
import {ScrollView, StyleSheet, View} from 'react-native'
import {useSafeAreaInsets} from 'react-native-safe-area-context'
import {plural} from '@lingui/core/macro'
import {Trans, useLingui} from '@lingui/react/macro'
import {useNavigation, useNavigationState} from '@react-navigation/native'

import {
  getCurrentRoute,
  getTabState,
  isTab,
  TabState,
} from '#/lib/routes/helpers'
import {type NavigationProp} from '#/lib/routes/types'
import {Link} from '#/view/com/util/Link'
import {PressableWithHover} from '#/view/com/util/PressableWithHover'
import {
  atoms as a,
  useBreakpoints,
  useLayoutBreakpoints,
  useTheme,
  web,
} from '#/alf'
import {Logo, LogoMark} from '#/components/brand/Logo'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import {
  Bell_Filled_Corner0_Rounded as BellFilledIcon,
  Bell_Stroke2_Corner0_Rounded as BellIcon,
} from '#/components/icons/Bell'
import {type Props as SVGIconProps} from '#/components/icons/common'
import {
  Group3_Filled_Corner0_Rounded as GroupFilledIcon,
  Group3_Stroke2_Corner0_Rounded as GroupIcon,
} from '#/components/icons/Group'
import {
  Person_Filled_Corner2_Rounded as PersonFilledIcon,
  Person_Stroke2_Corner2_Rounded as PersonIcon,
} from '#/components/icons/Person'
import {PlusLarge_Stroke2_Corner0_Rounded as PlusIcon} from '#/components/icons/Plus'
import {
  UserCircle_Filled_Corner0_Rounded as UserCircleFilledIcon,
  UserCircle_Stroke2_Corner0_Rounded as UserCircleIcon,
} from '#/components/icons/UserCircle'
import {
  CENTER_COLUMN_OFFSET,
  CENTER_COLUMN_WIDTH,
} from '#/components/Layout/const'
import {Text} from '#/components/Typography'
import {useAnalytics} from '#/analytics'
import {IS_NATIVE} from '#/env'
import {router} from '#/routes'
import {getComposeButtonLayout} from './composeButtonLayout'

/** The left nav's destinations; the tab navigator's route names on native. */
export type SidebarTab = 'People' | 'Groups' | 'Activity' | 'Profile'
type NavClickItem = 'people' | 'groups' | 'activity' | 'profile'

const LARGE_ELEMENT_SIZE = 48
const NAV_ICON_WIDTH = 28
const NAV_ITEM_TO_TAB: Record<NavClickItem, SidebarTab> = {
  people: 'People',
  groups: 'Groups',
  activity: 'Activity',
  profile: 'Profile',
}

export const LEFT_NAV_STANDARD_WIDTH = 240
export const LEFT_NAV_MINIMAL_WIDTH = 80

/*
 * Bluesky renders the signed-in account card (avatar + account switcher) in
 * this slot. Splito has no accounts here, so the slot holds the Splito logo,
 * which returns to People and is inactive on People (spec: App shell).
 */
function LogoCard({minimal}: {minimal: boolean}) {
  const {t: l} = useLingui()
  const currentRouteName = useNavigationState(state => {
    if (!state) {
      return 'People'
    }
    return getCurrentRoute(state).name
  })
  const isHome = isTab(currentRouteName, 'People')

  return (
    <View style={[a.pb_md, !minimal && [a.w_full, a.align_start]]}>
      <Link
        testID="logo"
        href="/"
        navigationAction="navigate"
        accessibilityLabel={l`Splito - People`}
        accessibilityHint=""
        aria-disabled={isHome}
        disabled={isHome}
        style={[
          a.justify_center,
          {height: LARGE_ELEMENT_SIZE},
          !minimal && a.pl_md,
          web({cursor: isHome ? 'default' : 'pointer'}),
        ]}>
        {minimal ? <LogoMark size={32} /> : <Logo size={32} />}
      </Link>
    </View>
  )
}

interface NavItemProps {
  count?: string
  hasNew?: boolean
  href: string
  icons: {
    inactive: React.ComponentType<SVGIconProps>
    active: React.ComponentType<SVGIconProps>
  }
  label: string
  minimal: boolean
  navItem: NavClickItem
  onNavigateTab?: (tab: SidebarTab) => void
  testID?: string
}
function NavItem({
  count,
  hasNew,
  href,
  icons,
  label,
  minimal,
  navItem,
  onNavigateTab,
  testID,
}: NavItemProps) {
  const t = useTheme()
  const {t: l} = useLingui()
  const accessibilityLabel = label
  const ax = useAnalytics()

  const [pathName] = useMemo(() => router.matchPath(href), [href])
  const navigationState = useNavigationState(state => state)
  const currentRouteInfo = getCurrentRoute(navigationState)
  const tab = NAV_ITEM_TO_TAB[navItem]
  const isCurrent = isTab(currentRouteInfo.name, pathName)
  const isSelected =
    IS_NATIVE && tab
      ? getTabState(navigationState, tab) !== TabState.Outside
      : isCurrent
  const isRelated = currentRouteInfo.name.startsWith(pathName)
  const navigation = useNavigation<NavigationProp>()
  const onPressWrapped = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
      ax.metric('nav:click', {item: navItem, surface: 'leftNav'})
      if (e.ctrlKey || e.metaKey || e.altKey) {
        return
      }
      e.preventDefault?.()
      if (tab && onNavigateTab) {
        onNavigateTab(tab)
        return
      }
      // Splito screens have no soft reset yet, so pressing the current item is a no-op.
      if (!isCurrent) {
        const [screen, params] = router.matchPath(href)
        // @ts-expect-error TODO: type matchPath well enough that it can be plugged into navigation.navigate directly
        navigation.navigate(screen, params, {pop: true})
      }
    },
    [navigation, href, isCurrent, ax, navItem, onNavigateTab, tab],
  )

  const Icon =
    isSelected || (!IS_NATIVE && isRelated) ? icons.active : icons.inactive

  return (
    <PressableWithHover
      testID={testID}
      style={[
        a.flex_row,
        a.align_center,
        a.p_md,
        a.rounded_full,
        a.gap_sm,
        a.outline_inset_1,
        a.transition_color,
      ]}
      hoverStyle={t.atoms.bg_contrast_25}
      // @ts-expect-error the function signature differs on web -prf
      onPress={onPressWrapped}
      href={href}
      dataSet={{noUnderline: 1}}
      role="link"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={IS_NATIVE ? {selected: isSelected} : undefined}
      accessibilityHint="">
      <View
        style={[
          a.align_center,
          a.justify_center,
          {
            width: 24,
            height: 24,
          },
          a.z_10,
        ]}>
        <Icon aria-hidden={true} width={NAV_ICON_WIDTH} style={t.atoms.text} />
        {typeof count === 'string' && count ? (
          <View
            style={[
              a.absolute,
              a.inset_0,
              {right: -20}, // more breathing room
            ]}>
            <Text
              accessibilityLabel={l`${plural(count, {
                one: '# unread item',
                other: '# unread items',
              })}`}
              accessibilityHint=""
              accessible={true}
              numberOfLines={1}
              style={[
                a.absolute,
                a.text_xs,
                a.font_semi_bold,
                a.rounded_full,
                a.text_center,
                a.leading_tight,
                a.z_20,
                {
                  top: '-10%',
                  left: count.length === 1 ? 12 : 8,
                  backgroundColor: t.palette.primary_500,
                  color: t.palette.white,
                  lineHeight: a.text_sm.fontSize,
                  paddingHorizontal: 4,
                  paddingVertical: 1,
                  minWidth: 16,
                },
              ]}>
              {count}
            </Text>
          </View>
        ) : hasNew ? (
          <View
            style={[
              a.absolute,
              a.rounded_full,
              a.z_20,
              {
                backgroundColor: t.palette.primary_500,
                width: 8,
                height: 8,
                right: -2,
                top: -4,
              },
            ]}
          />
        ) : null}
      </View>
      {!minimal && (
        <View style={[a.flex_row, a.align_center, a.gap_sm]}>
          <Text style={[a.text_xl, isSelected ? a.font_bold : a.font_normal]}>
            {label}
          </Text>
        </View>
      )}
    </PressableWithHover>
  )
}

/* Bluesky's "New post" compose button, opening Add expense instead. */
function ComposeBtn({minimal}: {minimal: boolean}) {
  const navigation = useNavigation<NavigationProp>()
  const {t: l} = useLingui()

  const onPressCompose = () => navigation.navigate('AddExpense', {})

  const layout = getComposeButtonLayout({minimal, isNative: IS_NATIVE})

  return (
    <View style={layout.container}>
      <Button
        testID="sidebar-add"
        label={l`Add expense`}
        onPress={onPressCompose}
        size="large"
        color="primary"
        style={layout.button}>
        <ButtonIcon icon={PlusIcon} size={minimal ? 'lg' : 'sm'} />
        {!minimal && (
          <ButtonText>
            <Trans context="action">Add expense</Trans>
          </ButtonText>
        )}
      </Button>
    </View>
  )
}

export function DesktopLeftNav({
  onNavigateTab,
}: {
  routeName: string
  onNavigateTab?: (tab: SidebarTab) => void
}) {
  const {t: l} = useLingui()
  const {gtMobile} = useBreakpoints()
  const {leftNavMinimal, centerColumnOffset} = useLayoutBreakpoints()
  const insets = useSafeAreaInsets()

  if (!gtMobile) {
    return null
  }

  const content = (
    <>
      <LogoCard minimal={leftNavMinimal} />
      <NavItem
        testID="tab-people"
        label={l`People`}
        href="/"
        navItem="people"
        onNavigateTab={onNavigateTab}
        minimal={leftNavMinimal}
        icons={{
          inactive: PersonIcon,
          active: PersonFilledIcon,
        }}
      />
      <NavItem
        testID="tab-groups"
        label={l`Groups`}
        href="/groups"
        navItem="groups"
        onNavigateTab={onNavigateTab}
        minimal={leftNavMinimal}
        icons={{inactive: GroupIcon, active: GroupFilledIcon}}
      />
      <NavItem
        testID="tab-activity"
        label={l`Activity`}
        href="/activity"
        navItem="activity"
        onNavigateTab={onNavigateTab}
        minimal={leftNavMinimal}
        icons={{inactive: BellIcon, active: BellFilledIcon}}
      />
      <NavItem
        testID="tab-profile"
        label={l`Profile`}
        href="/profile"
        navItem="profile"
        onNavigateTab={onNavigateTab}
        minimal={leftNavMinimal}
        icons={{inactive: UserCircleIcon, active: UserCircleFilledIcon}}
      />
      <ComposeBtn minimal={leftNavMinimal} />
    </>
  )

  return (
    <View
      role="navigation"
      pointerEvents={IS_NATIVE ? 'box-none' : undefined}
      style={[
        a.fixed,
        a.top_0,
        a.p_lg,
        styles.leftNav,
        IS_NATIVE && {top: insets.top, bottom: insets.bottom},
        leftNavMinimal && [
          {width: LEFT_NAV_MINIMAL_WIDTH},
          !IS_NATIVE && a.h_full,
          a.align_center,
          web(a.overflow_x_hidden),
        ],
        web({maxHeight: '100vh', overflowY: 'auto', scrollbarWidth: 'thin'}),
        {
          transform: [
            {
              translateX:
                -(CENTER_COLUMN_WIDTH / 2) +
                (centerColumnOffset ? CENTER_COLUMN_OFFSET : 0),
            },
            {translateX: '-100%'},
            ...a.scrollbar_offset.transform,
          ],
        },
      ]}>
      {IS_NATIVE ? (
        <ScrollView style={[a.flex_1, a.w_full]}>{content}</ScrollView>
      ) : (
        content
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  leftNav: {
    left: '50%',
    width: LEFT_NAV_STANDARD_WIDTH,
  },
})
