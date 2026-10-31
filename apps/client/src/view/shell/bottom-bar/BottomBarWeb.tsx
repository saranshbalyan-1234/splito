// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/view/shell/bottom-bar/BottomBarWeb.tsx
import {useCallback, useEffect, useState} from 'react'
import {View} from 'react-native'
import Animated from 'react-native-reanimated'
import {useLingui} from '@lingui/react'
import {useNavigationState} from '@react-navigation/native'
import {type NavItemId} from '@splito/sync'

import {useMinimalShellFooterTransform} from '#/lib/hooks/useMinimalShellTransform'
import {currentSection} from '#/lib/routes/section'
import {NAV_ITEM_HREF, NAV_ITEM_ROUTE} from '#/lib/routes/navigationItems'
import {useTabs} from '#/lib/routes/tabs'
import {useTourRef} from '#/lib/tour/registry'

import {useShellLayout} from '#/state/shell/shell-layout'
import {Link} from '#/view/com/util/Link'
import {noteTabSlide, slideDirection} from '#/lib/routes/tabSlide'
import {useShouldReduceMotion} from '#/motion/useShouldReduceMotion'
import {atoms as a, useTheme} from '#/alf'
import {
  describeUnread,
  useActivityBadge,
} from '#/components/activity/useActivityFeed'
import {MAX_LABELLED_TABS, NAV_LABELS, TabGlyph, TabLabel} from '#/components/TabGlyph'
import {Text} from '#/components/Typography'
import {useAnalytics} from '#/analytics'
import {styles} from './BottomBarStyles'

type NavItemValue = NavItemId

/** A net only: a pending highlight whose navigation was dropped is released after this. */
const PENDING_NET_MS = 3000

/*
 * Bluesky's signed-in mobile-web bottom bar with the items the `tabs`
 * preference picks from the shared nav list (Settings > Navigation), in its
 * order. There is
 * no centre button: Add expense is the FAB, as Bluesky's compose action is.
 */
export function BottomBarWeb() {
  const {_} = useLingui()
  const t = useTheme()
  const footerMinimalShellTransform = useMinimalShellFooterTransform()
  const {footerHeight} = useShellLayout()
  const tabs = useTabs()
  const iconWidth = 26
  const hasLabels = tabs.length <= MAX_LABELLED_TABS
  const activityBadge = useActivityBadge()
  /* Only the bar's own pages light up; under any other page the tab it was opened from stays lit. */
  const sections = tabs.map(tab => NAV_ITEM_ROUTE[tab])
  /*
   * The tab under the finger lights up in the press-in's own commit, before the page behind it switches (the
   * switch is a frame later and may be heavy on a phone): the bar never waits for its screen. Cleared when the
   * navigation state catches up; a modified press (new tab) never sets it.
   */
  const [pending, setPending] = useState<string | null>(null)
  useEffect(() => {
    if (!pending) return
    // It is set only by a press that navigates, so the navigation state catches up and clears it (below); this
    // is a net for a dispatch that was dropped, far longer than any switch takes.
    const id = setTimeout(() => setPending(null), PENDING_NET_MS)
    return () => clearTimeout(id)
  }, [pending])

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
          return (
            <NavItem
              key={tab}
              routeName={routeName}
              sections={sections}
              label={_(NAV_LABELS[tab])}
              href={href}
              navItem={tab}
              pending={pending}
              onPressStart={() => setPending(routeName)}
              onSettled={() => setPending(null)}
              hasLabels={hasLabels}
              notificationCount={
                tab === 'activity' ? activityBadge : undefined
              }>
              {({isActive}) => (
                <>
                  <TabGlyph tab={tab} isActive={isActive} size={iconWidth} />
                  {hasLabels && <TabLabel label={_(NAV_LABELS[tab])} isActive={isActive} />}
                </>
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
  /** The route a press-in is switching to (it lights up before the navigation state says so). */
  pending: string | null
  onPressStart: () => void
  onSettled: () => void
  /** The bar shows a label under each icon (5 items or fewer). */
  hasLabels: boolean
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
  pending,
  onPressStart,
  onSettled,
  hasLabels,
  hasNew,
  notificationCount,
  onLongPress,
}) => {
  const t = useTheme()
  const ax = useAnalytics()
  /* The guided tour points at the Groups tab (F-253). */
  const groupsTourRef = useTourRef('tab-groups')
  /* Under a page that is not in the bar (Settings, unless added) the tab it was opened from stays lit, as Bluesky's does. */
  const section = useNavigationState(state => currentSection(state, sections))
  const isReducedMotion = useShouldReduceMotion()

  const onBeforePress = useCallback(() => {
    ax.metric('nav:click', {item: navItem, surface: 'bottomBar'})
  }, [ax, navItem])

  const isActive = pending ? pending === routeName : section === routeName
  useEffect(() => {
    if (pending && pending === routeName && section === routeName) onSettled()
  }, [pending, routeName, section, onSettled])

  return (
    <Link
      ref={navItem === 'groups' ? groupsTourRef : undefined}
      testID={`tab-${navItem}`}
      href={href}
      style={[styles.ctrl, hasLabels && styles.ctrlLabelled, hasLabels ? a.pb_sm : a.pb_lg]}
      navigationAction="navigate"
      activateOnPressIn
      onActivated={() => {
        // The new screen slides in from the side it sits on in the bar (owner 174), unless motion is reduced.
        noteTabSlide(isReducedMotion ? undefined : slideDirection(sections, section, routeName))
        onPressStart()
      }}
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
