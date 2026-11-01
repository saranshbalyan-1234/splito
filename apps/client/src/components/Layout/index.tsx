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
import {useFocusEffect, useNavigation} from '@react-navigation/native'

import {RouteFAB} from '#/components/RouteFAB'

import {useEnableMinimalShellModeForScreen} from '#/state/shell'
import {useShowShell} from '#/state/shell/minimal-mode'
import {useShellLayout} from '#/state/shell/shell-layout'
import {takeStackSlide} from '#/lib/routes/stackSlide'
import {takeTabPress} from '#/lib/routes/tabSlide'
import {OpenedContext} from '#/lib/hooks/useAfterTransition'
import {useScreenOpened} from '#/lib/hooks/useScreenOpened'
import {usePullToRefresh} from '#/lib/refresh/usePullToRefresh'
import {useRefreshControl} from '#/lib/refresh/useRefreshControl'
import {useIsWithinSplitView} from '#/lib/splitView'
import {
  atoms as a,
  isMinWidth,
  useBreakpoints,
  useTheme,
  web,
} from '#/alf'
import {BREAKPOINTS, shouldCenterNativeTabletContent} from '#/alf/breakpoints.shared'
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
import {useReadReducedMotion} from '#/motion/useShouldReduceMotion'

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
  /*
   * Web: a bar tap's slide plays on the screen it opens (owner 174; `data-tab-in`, tabSlide.ts), and on a phone a push
   * or a Back slides like a native stack (owner 227; `data-stack-in`, stackSlide.ts). Both are CSS in index.html, run
   * by the compositor: an attribute on this node, no render.
   */
  const rootRef = useRef<HTMLDivElement>(null)
  const readReducedMotion = useReadReducedMotion()
  /* The same navigation object useFocusEffect reads; its stack's state is read when the screen gains focus (the root
   * container is not ready yet when the first screen focuses, so it is not asked). */
  const navigation = useNavigation()
  useFocusEffect(
    useCallback(() => {
      showShell()
      if (!IS_WEB) return
      const tab = takeTabPress()
      const stack = takeStackSlide({
        state: navigation.getState(),
        isTabSwitch: tab !== undefined,
        isPhoneWidth: !isMinWidth(BREAKPOINTS.mobile),
      })
      const el = rootRef.current
      if (!el) return
      if (tab?.direction) playSlide(el, 'tabIn', tab.direction, 400)
      else if (stack && !readReducedMotion()) playSlide(el, 'stackIn', stack, 500)
    }, [showShell, readReducedMotion, navigation]),
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

/* The slide each screen root is playing, so a late timer of an older one never ends a newer one. */
const playing = new WeakMap<HTMLElement, object>()

/**
 * Sets a slide's attribute until its animation ends, is cancelled (the screen was hidden first) or a safety timer
 * runs out (it never started). The focus effect's cleanup does not undo it: that effect runs again as a pushed
 * screen settles (its first commit), and undoing there cut the push slide off before its first frame.
 */
function playSlide(el: HTMLElement, key: 'tabIn' | 'stackIn', value: string, netMs: number) {
  const token = {}
  playing.set(el, token)
  delete el.dataset.tabIn
  delete el.dataset.stackIn
  el.dataset[key] = value
  const clear = () => {
    el.removeEventListener('animationend', onEnd)
    el.removeEventListener('animationcancel', onEnd)
    if (playing.get(el) !== token) return
    playing.delete(el)
    delete el.dataset[key]
  }
  /* Only our own slide: a spinner or shimmer inside the page bubbles its animation events here too. */
  const onEnd = (e: AnimationEvent) => {
    if (e.animationName.startsWith('splito-tab-in') || e.animationName.startsWith('splito-stack')) clear()
  }
  el.addEventListener('animationend', onEnd)
  el.addEventListener('animationcancel', onEnd)
  setTimeout(clear, netMs)
}

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
