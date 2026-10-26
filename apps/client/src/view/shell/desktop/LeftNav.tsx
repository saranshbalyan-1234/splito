// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/view/shell/desktop/LeftNav.tsx
import {useCallback, useMemo} from 'react'
import {ScrollView, StyleSheet, View} from 'react-native'
import {useSafeAreaInsets} from 'react-native-safe-area-context'
import {type TabId} from '@splito/sync'
import {plural} from '@lingui/core/macro'
import {Trans, useLingui} from '@lingui/react/macro'
import {useNavigation, useNavigationState} from '@react-navigation/native'

import {
  getCurrentRoute,
  getTabState,
  isTab,
  TabState,
} from '#/lib/routes/helpers'
import {TAB_ROUTE, tabHref, useTabs} from '#/lib/routes/tabs'
import {type NavigationProp, type TabParams} from '#/lib/routes/types'
import {Link} from '#/view/com/util/Link'
import {PressableWithHover} from '#/view/com/util/PressableWithHover'
import {
  atoms as a,
  useBreakpoints,
  useLayoutBreakpoints,
  useTheme,
  web,
} from '#/alf'
import {useActivityBadge} from '#/components/activity/useActivityFeed'
import {LogoMark} from '#/components/brand/Logo'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import {
  Bell_Filled_Corner0_Rounded as BellFilledIcon,
  Bell_Stroke2_Corner0_Rounded as BellIcon,
} from '#/components/icons/Bell'
import {
  ChartPie_Filled_Corner0_Rounded as ChartPieFilledIcon,
  ChartPie_Stroke2_Corner0_Rounded as ChartPieIcon,
} from '#/components/icons/ChartPie'
import {type Props as SVGIconProps} from '#/components/icons/common'
import {
  Group3_Filled_Corner0_Rounded as GroupFilledIcon,
  Group3_Stroke2_Corner0_Rounded as GroupIcon,
} from '#/components/icons/Group'
import {
  HomeOpen_Filled_Corner0_Rounded as HomeFilledIcon,
  HomeOpen_Stoke2_Corner0_Rounded as HomeIcon,
} from '#/components/icons/HomeOpen'
import {PlusLarge_Stroke2_Corner0_Rounded as PlusIcon} from '#/components/icons/Plus'
import {
  SettingsGear2_Filled_Corner0_Rounded as SettingsFilledIcon,
  SettingsGear2_Stroke2_Corner0_Rounded as SettingsIcon,
} from '#/components/icons/Settings'
import {Text} from '#/components/Typography'
import {useAnalytics} from '#/analytics'
import {IS_NATIVE} from '#/env'
import {router} from '#/routes'
import {getComposeButtonLayout} from './composeButtonLayout'

/** The left nav's tab destinations; the tab navigator's route names on native. */
export type SidebarTab = keyof TabParams
type NavClickItem = TabId | 'settings'

const LARGE_ELEMENT_SIZE = 48
const NAV_ICON_WIDTH = 28
const NAV_ITEM_TO_TAB: Partial<Record<NavClickItem, SidebarTab>> = TAB_ROUTE
/** Detail routes whose section stays highlighted (filled icon), as Bluesky does for related pages. */
const PARENT_ITEM: Record<string, NavClickItem> = {
  Person: 'people',
  AddFriend: 'people',
  Group: 'groups',
  CreateGroup: 'groups',
  Settle: 'groups',
}

export const LEFT_NAV_STANDARD_WIDTH = 240
export const LEFT_NAV_MINIMAL_WIDTH = 80

/** The sidebar's width at the current window size (0 when it is hidden). */
export function useLeftNavWidth() {
  const {gtMobile} = useBreakpoints()
  const {leftNavMinimal} = useLayoutBreakpoints()
  if (!gtMobile) return 0
  return leftNavMinimal ? LEFT_NAV_MINIMAL_WIDTH : LEFT_NAV_STANDARD_WIDTH
}

/*
 * The Splito logo heads the sidebar (owner directive). It returns to People
 * and is inactive on People (spec: App shell).
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
    <View style={[a.pb_sm, !minimal && [a.w_full, a.align_start]]}>
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
          a.align_center,
          {height: LARGE_ELEMENT_SIZE, width: LARGE_ELEMENT_SIZE},
          web({cursor: isHome ? 'default' : 'pointer'}),
        ]}>
        <LogoMark size={34} />
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
  const isRelated =
    currentRouteInfo.name.startsWith(pathName) ||
    PARENT_ITEM[currentRouteInfo.name] === navItem
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
      // Splito screens have no soft reset, so pressing the current item is a no-op.
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
      testID={`tab-${navItem}`}
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
      aria-current={isSelected ? 'page' : undefined}
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

/* Bluesky's "New post" compose button, opening Add expense the way Bluesky opens its composer. */
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

/**
 * Bluesky's signed-in desktop/tablet sidebar, pinned to the window's left
 * edge (owner directive: sidebar plus full-width content, no centred column).
 */
export function DesktopLeftNav({
  onNavigateTab,
}: {
  routeName: string
  onNavigateTab?: (tab: SidebarTab) => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const {gtMobile} = useBreakpoints()
  const {leftNavMinimal} = useLayoutBreakpoints()
  const insets = useSafeAreaInsets()
  const tabs = useTabs()
  const activityBadge = useActivityBadge()

  if (!gtMobile) {
    return null
  }

  const tabItems: Record<
    TabId,
    {label: string; icons: NavItemProps['icons']}
  > = {
    people: {
      label: l`People`,
      icons: {inactive: HomeIcon, active: HomeFilledIcon},
    },
    groups: {
      label: l`Groups`,
      icons: {inactive: GroupIcon, active: GroupFilledIcon},
    },
    analytics: {
      label: l`Analytics`,
      icons: {inactive: ChartPieIcon, active: ChartPieFilledIcon},
    },
    activity: {
      label: l`Activity`,
      icons: {inactive: BellIcon, active: BellFilledIcon},
    },
  }

  /* Bluesky's account card is gone: the account avatar sits at the top right of the content (owner directive). */
  const content = (
    <>
      <View style={[!leftNavMinimal && a.w_full, leftNavMinimal && a.align_center]}>
        <LogoCard minimal={leftNavMinimal} />
        {tabs.map(tab => (
          <NavItem
            key={tab}
            label={tabItems[tab].label}
            href={tabHref(tab)}
            navItem={tab}
            onNavigateTab={onNavigateTab}
            minimal={leftNavMinimal}
            icons={tabItems[tab].icons}
            count={tab === 'activity' ? activityBadge : undefined}
          />
        ))}
        <NavItem
          label={l`Settings`}
          href="/settings"
          navItem="settings"
          minimal={leftNavMinimal}
          icons={{inactive: SettingsIcon, active: SettingsFilledIcon}}
        />
        <ComposeBtn minimal={leftNavMinimal} />
      </View>
    </>
  )

  return (
    <View
      role="navigation"
      pointerEvents={IS_NATIVE ? 'box-none' : undefined}
      style={[
        a.top_0,
        a.left_0,
        a.p_lg,
        a.justify_between,
        a.border_r,
        t.atoms.border_contrast_low,
        t.atoms.bg,
        styles.leftNav,
        IS_NATIVE
          ? [a.h_full, {paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16}]
          : [a.fixed, a.bottom_0],
        leftNavMinimal && [
          {width: LEFT_NAV_MINIMAL_WIDTH},
          a.align_center,
          web(a.overflow_x_hidden),
        ],
        web({maxHeight: '100vh', overflowY: 'auto', scrollbarWidth: 'thin'}),
      ]}>
      {IS_NATIVE ? (
        <ScrollView
          style={[a.flex_1, a.w_full]}
          contentContainerStyle={[a.flex_grow, a.justify_between]}>
          {content}
        </ScrollView>
      ) : (
        content
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  leftNav: {
    width: LEFT_NAV_STANDARD_WIDTH,
  },
})
