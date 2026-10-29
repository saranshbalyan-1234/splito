// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/view/shell/desktop/LeftNav.tsx
// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/view/shell/desktop/Feeds.tsx (RecentGroups)
import {useCallback, useEffect, useMemo, useState} from 'react'
import {
  type LayoutChangeEvent,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'
import {useSafeAreaInsets} from 'react-native-safe-area-context'
import {
  formatAmount,
  magnitude,
  ZERO,
} from '@splito/domain'
import {type Group, isGroupInactive, type NavItemId} from '@splito/sync'

import {useHiddenGroups} from '#/data/groupVisibility'
import {Trans, useLingui} from '@lingui/react/macro'
import {useLingui as useLinguiCore} from '@lingui/react'
import {useNavigation, useNavigationState} from '@react-navigation/native'

import {
  getCurrentRoute,
  getTabState,
  isTab,
  TabState,
} from '#/lib/routes/helpers'
import {currentSection} from '#/lib/routes/section'
import {NAV_ITEM_HREF, splitNavigationItems} from '#/lib/routes/navigationItems'
import {TAB_ROUTE, useTabs} from '#/lib/routes/tabs'
import {
  type NavigationProp,
  type State,
  type TabParams,
} from '#/lib/routes/types'
import {useNumberLocale} from '#/locale/numberLocale'
import {
  useEntities,
  useGroupActivity,
  useMe,
  useMyGroupBalances,
  usePref,
} from '#/data/hooks'
import {Link} from '#/view/com/util/Link'
import {PressableWithHover} from '#/view/com/util/PressableWithHover'
import {
  atoms as a,
  platform,
  tokens,
  useBreakpoints,
  useLayoutBreakpoints,
  useTheme,
  utils,
  web,
} from '#/alf'
import {Logo} from '#/components/brand/Logo'
import {
  describeUnread,
  useActivityBadge,
} from '#/components/activity/useActivityFeed'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import {GroupAvatar} from '#/components/groups/GroupAvatar'
import {ChevronRight_Stroke2_Corner0_Rounded as ChevronRightIcon} from '#/components/icons/Chevron'
import {type Props as SVGIconProps} from '#/components/icons/common'
import {PlusLarge_Stroke2_Corner0_Rounded as PlusIcon} from '#/components/icons/Plus'
import {HEADER_HEIGHT} from '#/components/Layout/const'
import {NavFooterLinks} from '#/components/NavFooterLinks'
import {useSearchAsk} from '#/components/SearchAsk/context'
import {SyncToned} from '#/components/SyncTone'
import {GLYPHS, NAV_LABELS} from '#/components/TabGlyph'
import {Text} from '#/components/Typography'
import {useAnalytics} from '#/analytics'
import {IS_NATIVE} from '#/env'
import {useShouldReduceMotion} from '#/motion/useShouldReduceMotion'
import {router} from '#/routes'
import {sortGroups} from '#/screens/Groups/filter'
import {getComposeButtonLayout} from './composeButtonLayout'

/** The left nav's tab destinations; the tab navigator's route names on native. */
export type SidebarTab = keyof TabParams
type NavClickItem = NavItemId

const LARGE_ELEMENT_SIZE = 48
const NAV_ICON_WIDTH = 28
const NAV_ITEM_TO_TAB: Partial<Record<NavClickItem, SidebarTab>> = TAB_ROUTE
const LOGO_SIZE = 40
const RECENT_GROUPS = 5
const INDICATOR_HEIGHT = 24

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
 * The Splito logo heads the sidebar (owner directive), with the wordmark
 * beside the mark except on the icon rail. It returns Home and is
 * inactive on Home (spec: App shell). Its row is the header's height from
 * the top edge, so the logo sits on the header's centre line.
 */
function LogoCard({minimal}: {minimal: boolean}) {
  const {t: l} = useLingui()
  const currentRouteName = useNavigationState(state => {
    if (!state) {
      return 'Home'
    }
    return getCurrentRoute(state).name
  })
  const isHome = isTab(currentRouteName, 'Home')

  return (
    <View
      style={[
        a.justify_center,
        // A little air above the mark (owner 126).
        a.mt_md,
        platform({
          native: {height: HEADER_HEIGHT.native},
          web: {height: HEADER_HEIGHT.web},
        }),
        !minimal && [a.w_full, a.align_center],
      ]}>
      <Link
        testID="logo"
        href="/"
        navigationAction="navigate"
        accessibilityLabel={l`Splito - Home`}
        accessibilityHint=""
        aria-disabled={isHome}
        disabled={isHome}
        style={[
          a.flex_row,
          a.align_center,
          // The mark's centre lines up with the nav glyphs' centres below it.
          !minimal && {marginLeft: tokens.space.md + 12 - LOGO_SIZE / 2},
          web({cursor: isHome ? 'default' : 'pointer'}),
        ]}>
        <Logo size={LOGO_SIZE} />
      </Link>
    </View>
  )
}

/*
 * What pressing a nav item does, for the sidebar rows: Ask Splito opens the Search & Ask drawer, a tab switches tab on
 * native, anything else navigates (pressing the current page is a no-op,
 * as Splito screens have no soft reset).
 */
function useOpenNavItem(onNavigateTab?: (tab: SidebarTab) => void) {
  const navigation = useNavigation<NavigationProp>()
  const searchAsk = useSearchAsk()
  return (navItem: NavClickItem, href: string, isCurrent: boolean) => {
    const tab = NAV_ITEM_TO_TAB[navItem]
    if (navItem === 'ask') {
      searchAsk.open({mode: 'ask'})
    } else if (tab && onNavigateTab) {
      onNavigateTab(tab)
    } else if (!isCurrent) {
      const [screen, params] = router.matchPath(href)
      // @ts-expect-error TODO: type matchPath well enough that it can be plugged into navigation.navigate directly
      navigation.navigate(screen, params, {pop: true})
    }
  }
}

interface NavItemProps {
  count?: string
  hasNew?: boolean
  href: string
  icons: {
    inactive: React.ComponentType<SVGIconProps>
    active: React.ComponentType<SVGIconProps>
  }
  isSelected: boolean
  label: string
  minimal: boolean
  navItem: NavClickItem
  onLayout: (e: LayoutChangeEvent) => void
  onNavigateTab?: (tab: SidebarTab) => void
}
function NavItem({
  count,
  hasNew,
  href,
  icons,
  isSelected,
  label,
  minimal,
  navItem,
  onLayout,
  onNavigateTab,
}: NavItemProps) {
  const t = useTheme()
  const accessibilityLabel = label
  const ax = useAnalytics()

  const [pathName] = useMemo(() => router.matchPath(href), [href])
  const currentRouteInfo = useNavigationState(state => getCurrentRoute(state))
  const isCurrent = isTab(currentRouteInfo.name, pathName)
  const openNavItem = useOpenNavItem(onNavigateTab)
  const onPressWrapped = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
      ax.metric('nav:click', {item: navItem, surface: 'leftNav'})
      if (e.ctrlKey || e.metaKey || e.altKey) {
        return
      }
      e.preventDefault?.()
      openNavItem(navItem, href, isCurrent)
    },
    [href, isCurrent, ax, navItem, openNavItem],
  )

  const Icon = isSelected ? icons.active : icons.inactive

  return (
    <PressableWithHover
      testID={`tab-${navItem}`}
      onLayout={onLayout}
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
              testID={`nav-badge-${navItem}`}
              accessibilityLabel={describeUnread(count)}
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
                  // The pulse is only empty at its top right: start past the downstroke, end above the label's cap height ('30+' too).
                  top: -10,
                  left: 16,
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

/*
 * Owner rule 12: a bar beside the active item springs to the newly selected
 * one, as Bluesky's pager TabBar indicator follows the selected tab (its
 * layouts-then-animated-style approach). Written for Splito: Bluesky's
 * sidebar has no indicator.
 */
function ActiveIndicator({
  layout,
}: {
  layout: {y: number; height: number} | undefined
}) {
  const t = useTheme()
  const reduceMotion = useShouldReduceMotion()
  const y = useSharedValue(-1)
  const target = layout ? layout.y + (layout.height - INDICATOR_HEIGHT) / 2 : -1
  /* The first placement and reduced motion jump; later moves spring. */
  useEffect(() => {
    if (target < 0) return
    y.set(
      y.get() < 0 || reduceMotion
        ? target
        : withSpring(target, {damping: 20, stiffness: 260, mass: 0.6}),
    )
  }, [y, target, reduceMotion])
  const style = useAnimatedStyle(() => ({
    opacity: y.get() < 0 ? 0 : 1,
    transform: [{translateY: Math.max(y.get(), 0)}],
  }))
  if (!layout) return null
  return (
    <Animated.View
      testID="sidebar-indicator"
      pointerEvents="none"
      style={[
        a.absolute,
        {
          top: 0,
          // Flush with the sidebar's left edge, in the container's padding.
          left: -tokens.space.lg,
          width: 4,
          height: INDICATOR_HEIGHT,
          borderTopRightRadius: 4,
          borderBottomRightRadius: 4,
          backgroundColor: t.palette.primary_500,
        },
        style,
      ]}
    />
  )
}

/*
 * Bluesky's "New post" compose button, opening Add expense the way Bluesky
 * opens its composer. As upstream mentions the profile being viewed, it
 * prefills the friend or group whose page is open.
 */
function ComposeBtn({minimal}: {minimal: boolean}) {
  const navigation = useNavigation<NavigationProp>()
  const {t: l} = useLingui()

  const onPressCompose = () => {
    const routes = navigation.getState()?.routes
    const current = routes?.[routes.length - 1]
    const params = (current?.params ?? {}) as {
      personId?: string
      groupId?: string
    }
    navigation.navigate(
      'AddExpense',
      current?.name === 'Person'
        ? {personId: params.personId}
        : current?.name === 'Group'
          ? {groupId: params.groupId}
          : {},
    )
  }

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

/* A spoken list in the app language; Hermes has no Intl.ListFormat, so phones fall back to commas (ponytail: add a polyfill if a language needs its own "and"). */
function joinList(items: string[], locale: string): string {
  return typeof Intl.ListFormat === 'function'
    ? new Intl.ListFormat(locale, {style: 'long', type: 'conjunction'}).format(items)
    : items.join(', ')
}

/*
 * Bluesky's pinned-feeds list (src/view/shell/desktop/Feeds.tsx: FeedItem
 * rows and the "More feeds" link) as the five most recently active groups,
 * each with my balance in it.
 */
export function RecentGroups() {
  const t = useTheme()
  const {t: l, i18n} = useLingui()
  const locale = useNumberLocale()
  const me = useMe()
  const groups = useEntities<Group>('group')
  const myBalances = useMyGroupBalances()
  const groupActivity = useGroupActivity()
  const hidden = useHiddenGroups()
  const [defaultCurrency = 'INR'] = usePref('defaultCurrency')
  const route = useNavigationState(state => getCurrentRoute(state))
  const openGroupId =
    route.name === 'Group'
      ? (route.params as {groupId?: string} | undefined)?.groupId
      : undefined

  const recent = useMemo(() => {
    if (!me || !groups || !myBalances || !groupActivity) return []
    const live = groups.filter(g => !isGroupInactive(g.data) && !hidden.has(g.id))
    const balances = myBalances
    return sortGroups(
      live.map(g => ({
        id: g.id,
        name: g.data.name,
        kind: g.data.kind,
        balances: balances[g.id] ?? {},
        members: [],
        syncStatus: g.syncStatus,
      })),
      'recent',
      {
        currency: defaultCurrency,
        activity: groupActivity,
      },
    ).slice(0, RECENT_GROUPS)
  }, [me, groups, myBalances, groupActivity, defaultCurrency, hidden])

  if (recent.length === 0) return null

  return (
    <View testID="sidebar-recent-groups" style={[a.pt_2xl, {gap: 2}]}>
      <Text
        style={[
          a.px_md,
          a.pb_xs,
          a.text_sm,
          a.font_semi_bold,
          a.leading_snug,
          t.atoms.text_contrast_medium,
        ]}>
        <Trans>Recently active groups</Trans>
      </Text>
      {recent.map(group => {
        const current = group.id === openGroupId
        /* One chip per open currency, never added together (§ 26.13, audit M12). */
        const open = Object.keys(group.balances)
          .sort()
          .filter(c => group.balances[c] !== ZERO)
        const spoken = open
          .map(c => {
            const amount = group.balances[c]!
            return amount > ZERO
              ? l`you are owed ${formatAmount(amount, c, locale)}`
              : l`you owe ${formatAmount(magnitude(amount), c, locale)}`
          })
        // Joined in the app language ("you owe €7.00 and you are owed ₹63,000.00").
        const spokenList = joinList(spoken, i18n.locale)
        return (
          <Link
            key={group.id}
            testID={`sidebar-group-${group.name}`}
            href={`/groups/${group.id}`}
            asAnchor
            anchorNoUnderline
            accessibilityLabel={
              open.length > 0
                ? l`${group.name}, ${spokenList}`
                : l`${group.name}, settled up`
            }
            accessibilityHint=""
            hoverStyle={t.atoms.bg_contrast_25}
            style={[
              a.flex_row,
              a.align_center,
              a.gap_sm,
              a.rounded_sm,
              a.transition_color,
              a.px_md,
              {paddingVertical: 6},
              current && {backgroundColor: t.palette.primary_50},
            ]}>
            <SyncToned status={group.syncStatus} style={[a.flex_1, a.flex_row, a.align_center, a.gap_sm]}>
            <GroupAvatar kind={group.kind} name={group.name} size={24} />
            <Text
              emoji
              numberOfLines={1}
              style={[
                a.flex_1,
                a.text_md,
                a.leading_snug,
                current ? [t.atoms.text, a.font_semi_bold] : t.atoms.text,
              ]}>
              {group.name}
            </Text>
            {open.length > 0 ? (
              <View
                testID={`sidebar-group-balance-${group.name}`}
                style={[a.align_end, a.flex_shrink_0, {gap: 2}]}>
                {open.map(currency => {
                  const amount = group.balances[currency]!
                  const color =
                    amount > ZERO
                      ? t.palette.positive_600
                      : t.palette.negative_500
                  return (
                    <Text
                      key={currency}
                      testID={`sidebar-group-balance-${group.name}-${currency}`}
                      numberOfLines={1}
                      style={[
                        a.text_xs,
                        a.font_semi_bold,
                        a.rounded_full,
                        {
                          color,
                          backgroundColor: utils.alpha(
                            color,
                            t.scheme === 'light' ? 0.1 : 0.18,
                          ),
                          paddingHorizontal: 6,
                          paddingVertical: 2,
                          fontVariant: ['tabular-nums'],
                        },
                      ]}>
                      {(amount > ZERO ? '+' : '−') +
                        formatAmount(magnitude(amount), currency, locale)}
                    </Text>
                  )
                })}
              </View>
            ) : (
              <Text
                style={[
                  a.text_xs,
                  a.leading_snug,
                  t.atoms.text_contrast_medium,
                ]}>
                <Trans>settled</Trans>
              </Text>
            )}
            </SyncToned>
          </Link>
        )
      })}
      <Link
        testID="sidebar-groups-all"
        href="/groups"
        navigationAction="navigate"
        accessibilityLabel={l`See all groups`}
        accessibilityHint=""
        hoverStyle={t.atoms.bg_contrast_25}
        style={[
          a.flex_row,
          a.align_center,
          a.gap_sm,
          a.self_start,
          a.rounded_sm,
          a.transition_color,
          a.px_md,
          {paddingVertical: 6},
        ]}>
        <View
          style={[
            a.align_center,
            a.justify_center,
            a.rounded_xs,
            t.atoms.bg_contrast_50,
            {width: 24, height: 24},
          ]}>
          <ChevronRightIcon
            style={{width: 16, height: 16}}
            fill={t.atoms.text_contrast_medium.color}
          />
        </View>
        <Text style={[a.text_md, a.leading_snug, t.atoms.text_contrast_medium]}>
          <Trans>See all</Trans>
        </Text>
      </Link>
    </View>
  )
}

/* Which item is lit: a pushed page keeps its section lit, as Bluesky's tabs do. */
function selectedItem(
  state: State | undefined,
  items: {navItem: NavClickItem; href: string}[],
  section = currentSection(state),
) {
  return items.find(({navItem, href}) => {
    const tab = NAV_ITEM_TO_TAB[navItem]
    return IS_NATIVE && tab
      ? getTabState(state, tab) !== TabState.Outside
      : router.matchPath(href)[0] === section
  })?.navItem
}

/**
 * Bluesky's signed-in desktop/tablet sidebar, pinned to the window's left
 * edge (owner directive: sidebar plus full-width content, no centred column).
 * The logo, account card, nav, compose pill and recent groups scroll; the
 * footer stays pinned at the bottom.
 */
export function DesktopLeftNav({
  onNavigateTab,
}: {
  routeName: string
  onNavigateTab?: (tab: SidebarTab) => void
}) {
  const t = useTheme()
  const {_} = useLinguiCore()
  const {gtMobile} = useBreakpoints()
  const {leftNavMinimal} = useLayoutBreakpoints()
  const insets = useSafeAreaInsets()
  const activityBadge = useActivityBadge()
  /*
   * Web lights an item from the section alone (a string), so a `Sheet` marker pushed or popped over the page does not
   * re-render the sidebar; native keeps the whole state for the tab check.
   */
  const navigationState = useNavigationState(state => (IS_NATIVE ? state : undefined))
  const section = useNavigationState(state => currentSection(state))
  const tabs = useTabs()
  const [layouts, setLayouts] = useState<
    Partial<Record<NavClickItem, {y: number; height: number}>>
  >({})

  if (!gtMobile) {
    return null
  }

  /*
   * The one shared list (26.3), every item always (owner 155): the order chosen in Settings > Navigation (what is on,
   * then what is off, in the shared order); the on/off choice shapes only the phone bar. No "More".
   */
  const {on, off} = splitNavigationItems(tabs)
  const toItem = (id: NavClickItem) => ({
    navItem: id,
    label: _(NAV_LABELS[id]),
    href: NAV_ITEM_HREF[id] ?? '',
    icons: {inactive: GLYPHS[id].icon, active: GLYPHS[id].filled},
    count: id === 'activity' ? activityBadge : undefined,
  })
  const items = [...on, ...off].map(toItem)
  const selected = selectedItem(navigationState, items, section)
  const onItemLayout = (navItem: NavClickItem) => (e: LayoutChangeEvent) => {
    const {y, height} = e.nativeEvent.layout
    setLayouts(prev =>
      prev[navItem]?.y === y && prev[navItem]?.height === height
        ? prev
        : {...prev, [navItem]: {y, height}},
    )
  }

  return (
    <View
      role="navigation"
      pointerEvents={IS_NATIVE ? 'box-none' : undefined}
      style={[
        a.top_0,
        a.left_0,
        a.border_r,
        t.atoms.border_contrast_low,
        t.atoms.bg,
        styles.leftNav,
        IS_NATIVE
          ? [
              a.h_full,
              {paddingTop: insets.top, paddingBottom: insets.bottom + 16},
            ]
          : [a.fixed, a.bottom_0],
        leftNavMinimal && [
          {width: LEFT_NAV_MINIMAL_WIDTH},
          web(a.overflow_x_hidden),
        ],
      ]}>
      <ScrollView
        style={[a.flex_1, a.w_full, web({scrollbarWidth: 'thin'})]}
        contentContainerStyle={[
          // No top padding: the logo row lines up with the header row.
          a.px_lg,
          a.pb_lg,
          leftNavMinimal && a.align_center,
        ]}>
        <LogoCard minimal={leftNavMinimal} />
        <View style={[a.pt_sm]} />
        <View style={[a.relative, !leftNavMinimal && a.w_full]}>
          <ActiveIndicator layout={selected ? layouts[selected] : undefined} />
          {items.map(item => (
            <NavItem
              key={item.navItem}
              {...item}
              isSelected={item.navItem === selected}
              minimal={leftNavMinimal}
              onLayout={onItemLayout(item.navItem)}
              onNavigateTab={
                NAV_ITEM_TO_TAB[item.navItem] ? onNavigateTab : undefined
              }
            />
          ))}
        </View>
        <ComposeBtn minimal={leftNavMinimal} />
      </ScrollView>
      {/* The drawer's footer links, pinned at the bottom (26.5); the icon rail has no room, its drawer has them. */}
      {!leftNavMinimal && (
        <NavFooterLinks
          style={[a.pr_md, a.pt_md, web(a.pb_lg), {paddingLeft: 16}]}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  leftNav: {
    width: LEFT_NAV_STANDARD_WIDTH,
  },
})
