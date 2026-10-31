// Adapted from bluesky-social/social-app@4e4ad9c (MIT) — src/components/Layout/index.tsx
import {memo, useCallback, useContext, useMemo, useRef} from 'react'
import {
  type StyleProp,
  View,
  type ViewProps,
  type ViewStyle,
} from 'react-native'
import Animated, {
  type AnimatedRef,
  type AnimatedScrollViewProps,
  useAnimatedStyle,
} from 'react-native-reanimated'
import {useSafeAreaInsets} from 'react-native-safe-area-context'
import {useFocusEffect} from '@react-navigation/native'

import {RouteFAB} from '#/components/RouteFAB'

import {useEnableMinimalShellModeForScreen} from '#/state/shell'
import {useShowShell} from '#/state/shell/minimal-mode'
import {useShellLayout} from '#/state/shell/shell-layout'
import {takeTabSlide} from '#/lib/routes/tabSlide'
import {OpenedContext} from '#/lib/hooks/useAfterTransition'
import {useScreenOpened} from '#/lib/hooks/useScreenOpened'
import {usePullToRefresh} from '#/lib/refresh/usePullToRefresh'
import {useRefreshControl} from '#/lib/refresh/useRefreshControl'
import {useIsWithinSplitView} from '#/lib/splitView'
import {
  atoms as a,
  useBreakpoints,
  useTheme,
  web,
} from '#/alf'
import {shouldCenterNativeTabletContent} from '#/alf/breakpoints.shared'
import {useDialogContext} from '#/components/Dialog'
import {
  CENTER_COLUMN_WIDTH,
} from '#/components/Layout/const'
import {ScrollbarOffsetContext} from '#/components/Layout/context'
import {
  HeaderModeProvider,
  MainScrollProvider,
} from '#/components/Layout/MainScrollProvider'
import {IS_IPAD, IS_WEB} from '#/env'
import {ScreenExitingProvider, useScreenExitScope} from '#/motion/listAnimations'

export * from '#/components/Layout/const'
export * as Header from '#/components/Layout/Header'

export type ScreenProps = React.ComponentProps<typeof View> & {
  style?: StyleProp<ViewStyle>
  noInsetTop?: boolean
  minimalShell?: boolean
  /** Skip the centered desktop-width borders for immersive content. */
  fullBleed?: boolean
}

/**
 * Outermost component of every screen
 */
export const Screen = memo(function Screen({
  style,
  noInsetTop,
  minimalShell = false,
  fullBleed: _fullBleed = false,
  children,
  ...props
}: ScreenProps) {
  const {top} = useSafeAreaInsets()
  const {isWithinSplitView} = useIsWithinSplitView()

  useEnableMinimalShellModeForScreen({enabled: minimalShell})
  /* Native: heavy bodies in this screen mount after its transition ends (owner 168); undefined on web. */
  const opened = useScreenOpened()
  /* Rows of a page that is leaving skip their web exit animations (owner 189, ARCHITECTURE 17.1). */
  const exiting = useScreenExitScope()
  /* A tab switch or a page opening shows the header, bottom bar and FAB again (ARCHITECTURE 26.4). */
  const showShell = useShowShell()
  /* Web: a bar tap's slide plays on the screen it opens (owner 174; CSS on `data-tab-in`, no render, tabSlide.ts). */
  const rootRef = useRef<HTMLDivElement>(null)
  useFocusEffect(
    useCallback(() => {
      showShell()
      if (!IS_WEB) return
      const direction = takeTabSlide()
      const el = rootRef.current
      if (!direction || !el) return
      el.dataset.tabIn = direction
      const clear = () => delete el.dataset.tabIn
      el.addEventListener('animationend', clear, {once: true})
      const net = setTimeout(clear, 400)
      return () => clearTimeout(net)
    }, [showShell]),
  )

  /*
   * Bluesky draws the centre column's side borders here. Splito's content
   * fills the space beside the sidebar, whose own border separates them.
   * Each screen owns its header's hide-on-scroll state (Header.Sticky).
   */
  return (
    <View
      // @ts-expect-error web only: the DOM node (the tab slide sets `data-tab-in` on it)
      ref={rootRef}
      // The pull to refresh handler (web) takes a touch only inside a screen.
      dataSet={{screen: ''}}
      style={[
        a.util_screen_outer,
        {paddingTop: noInsetTop ? 0 : top},
        isWithinSplitView && {maxHeight: '100%'},
        style,
      ]}
      {...props}>
      <ScreenExitingProvider value={exiting}>
        <HeaderModeProvider>
          <MainScrollProvider>
            <OpenedContext.Provider value={opened}>{children}</OpenedContext.Provider>
          </MainScrollProvider>
          {/* The FAB is decided here, once, from the route (owner 190, § 26.6); a screen can only hold it back. */}
          <RouteFAB />
        </HeaderModeProvider>
      </ScreenExitingProvider>
    </View>
  )
})

export type ContentProps = AnimatedScrollViewProps & {
  style?: StyleProp<ViewStyle>
  contentContainerStyle?: StyleProp<ViewStyle>
  ignoreTabletLayoutOffset?: boolean
  ref?: AnimatedRef<Animated.ScrollView>
}

/**
 * Default scroll view for simple pages
 */
export const Content = memo(function Content({
  children,
  style,
  contentContainerStyle,
  centerContent,
  ignoreTabletLayoutOffset,
  automaticallyAdjustsScrollIndicatorInsets,
  refreshControl: ownRefreshControl,
  ref,
  ...props
}: ContentProps) {
  const t = useTheme()
  const {footerHeight} = useShellLayout()
  const {isWithinSplitView} = useIsWithinSplitView()
  const {gtMobile} = useBreakpoints()
  const {isWithinDialog} = useDialogContext()
  const {isWithinOffsetView} = useContext(ScrollbarOffsetContext)
  const centerOnTablet = shouldCenterNativeTabletContent({
    gtMobile,
    isWithinDialog,
    isWithinSplitView,
    isWithinOffsetView,
  })
  const isWithinContainedTabletSurface =
    isWithinDialog || isWithinSplitView || isWithinOffsetView
  const usesSystemScrollIndicatorInsets =
    gtMobile && !isWithinContainedTabletSurface
  const offsetContext = useMemo(() => ({isWithinOffsetView: true}), [])
  /* Pull to refresh on every page (owners 167, 169, 170), as `List`; web pulls through `PullSurface` below. */
  const refreshControl = useRefreshControl({enabled: !isWithinDialog && !ownRefreshControl})
  const pull = usePullToRefresh({enabled: !isWithinDialog && !isWithinSplitView && !ownRefreshControl})

  // note - if we ever make the footer transparent in any way,
  // we'll need to change this to use contentInsets/scrollIndicatorInsets
  // on iOS and contentContainerStyle padding on Android -sfn
  const animatedStyle = useAnimatedStyle(() => {
    return {
      marginBottom: footerHeight.get(),
    }
  })

  const scrollView = (
    <Animated.ScrollView
      ref={ref}
      id="content"
      centerContent={centerOnTablet ? false : centerContent}
      automaticallyAdjustsScrollIndicatorInsets={
        automaticallyAdjustsScrollIndicatorInsets ??
        (usesSystemScrollIndicatorInsets || isWithinContainedTabletSurface
          ? undefined
          : false)
      }
      indicatorStyle={t.scheme === 'dark' ? 'white' : 'black'}
      refreshControl={ownRefreshControl ?? refreshControl}
      // Header taps scroll to the top on iPadOS 26, see `List`
      scrollsToTop={IS_IPAD ? false : undefined}
      style={[
        a.w_full,
        animatedStyle,
        isWithinSplitView &&
          web({
            flex: 1,
            overflowY: 'scroll',
            scrollbarWidth: 'thin',
            scrollbarColor: `${t.palette.contrast_100} transparent`,
          }),
        style,
      ]}
      contentContainerStyle={[
        centerOnTablet && {
          width: '100%',
          maxWidth: CENTER_COLUMN_WIDTH,
          alignSelf: 'center',
        },
        /* UIKit centering would also add horizontal insets to the column. */
        centerOnTablet && centerContent && [a.flex_grow, a.justify_center],
        contentContainerStyle,
      ]}
      {...props}>
      {IS_WEB ? (
        <>
          {pull.indicator}
          <Center ref={pull.contentRef} ignoreTabletLayoutOffset={ignoreTabletLayoutOffset}>
            {/* @ts-expect-error web only -esb */}
            {children}
          </Center>
        </>
      ) : (
        children
      )}
    </Animated.ScrollView>
  )

  return IS_WEB ? (
    scrollView
  ) : (
    <ScrollbarOffsetContext.Provider value={offsetContext}>
      {scrollView}
    </ScrollbarOffsetContext.Provider>
  )
})

/**
 * Bluesky's centring wrapper. Splito's content is full width beside the
 * sidebar (owner directive), so this only provides the offset context that
 * adapted components read.
 */
export const Center = memo(function LayoutCenter({
  children,
  style,
  ignoreTabletLayoutOffset: _ignoreTabletLayoutOffset,
  ...props
}: ViewProps & {ignoreTabletLayoutOffset?: boolean; ref?: React.Ref<React.ComponentRef<typeof View>>}) {
  const ctx = useMemo(() => ({isWithinOffsetView: true}), [])
  return (
    <View style={[a.w_full, style]} {...props}>
      <ScrollbarOffsetContext.Provider value={ctx}>
        {children}
      </ScrollbarOffsetContext.Provider>
    </View>
  )
})
