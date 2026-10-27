// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/view/shell/index.tsx
import {useEffect} from 'react'
import {useWindowDimensions, View} from 'react-native'
import {Drawer} from 'react-native-drawer-layout'
import {SystemBars} from 'react-native-edge-to-edge'
import * as SystemUI from 'expo-system-ui'
import {BottomSheetOutlet, BottomSheetProvider} from '@bsky.app/bottom-sheet'
import {useLingui} from '@lingui/react/macro'
import {useNavigationState} from '@react-navigation/native'

import {isStateAtTabRoot} from '#/lib/routes/helpers'
import {useDialogFullyExpandedCountContext} from '#/state/dialogs'
import {useIsDrawerOpen, useSetDrawerOpen} from '#/state/shell'
import {SearchAskProvider} from '#/features/searchAsk/SearchAskProvider'
import {DrawerContent} from '#/navigation/Drawer'
import {FeedbackProvider} from '#/features/feedback/FeedbackProvider'
import {RoutesContainer, TabsNavigator} from '#/navigation/Navigation'
import {atoms as a, select, useBreakpoints, useTheme} from '#/alf'
import {Outlet as PortalOutlet} from '#/components/Portal'
import {IS_ANDROID, IS_IOS, IS_LIQUID_GLASS} from '#/env'

/* As upstream: the drawer is the navigator's layout, so it can read the navigation state. */
function drawerLayout({children}: {children: React.ReactNode}) {
  return (
    /* Inside the navigator, so a search result can navigate; one drawer for every page. */
    <SearchAskProvider>
      <DrawerLayout>{children}</DrawerLayout>
    </SearchAskProvider>
  )
}

/*
 * Bluesky's native shell also mounts the composer, global dialogs,
 * push-notification and OTA hooks and account status screens. Splito has
 * none of those yet, so the navigator, drawer and portal outlets remain; the
 * system bars are mounted in Shell below, as upstream. Upstream's native
 * App.tsx holds BottomSheetProvider; Splito's App.tsx also serves web, so the
 * native shell holds it: without it every Dialog sheet fails to render.
 */
function ShellInner() {
  return (
    <FeedbackProvider>
      <View style={[a.h_full]}>
        <TabsNavigator layout={drawerLayout} />
      </View>
      <PortalOutlet />
      <BottomSheetOutlet />
    </FeedbackProvider>
  )
}

/*
 * Bluesky's drawer layout. Upstream closes the drawer at tablet widths,
 * where its sidebar takes over; Splito's avatar opens it at every width
 * (owner directive), so only the swipe-to-open stays phone-only.
 */
function DrawerLayout({children}: {children: React.ReactNode}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const isDrawerOpen = useIsDrawerOpen()
  const setIsDrawerOpen = useSetDrawerOpen()
  const winDim = useWindowDimensions()
  const {gtMobile} = useBreakpoints()

  const canGoBack = useNavigationState(state => !isStateAtTabRoot(state))
  const swipeEnabled = !gtMobile && !canGoBack

  return (
    <Drawer
      renderDrawerContent={() => <DrawerContent />}
      drawerStyle={{width: Math.min(400, winDim.width * 0.8)}}
      configureGestureHandler={handler => {
        if (swipeEnabled || isDrawerOpen) {
          if (isDrawerOpen) {
            return {...handler, activeOffsetX: [-1, 1]}
          } else {
            return {
              ...handler,
              /*
               * Any movement to the left is a pager swipe, so fail the drawer
               * gesture immediately.
               */
              failOffsetX: -1,
              /*
               * Don't rush declaring that a movement to the right is a drawer
               * swipe. It could be a vertical scroll, or a slow horizontal
               * swipe on a row (APP-2119 upstream), so require more travel
               * before claiming on Android.
               */
              activeOffsetX: IS_ANDROID ? 20 : 5,
            }
          }
        } else {
          /*
           * Fail the gesture immediately and skip the edge peek on touch-down.
           * This seems more reliable than the `swipeEnabled` prop alone, which
           * may freeze after toggling off/on.
           */
          return {
            ...handler,
            onBegin: undefined,
            failOffsetX: [0, 0],
            failOffsetY: [0, 0],
          }
        }
      }}
      open={isDrawerOpen}
      onOpen={() => setIsDrawerOpen(true)}
      onClose={() => setIsDrawerOpen(false)}
      overlayAccessibilityLabel={l`Close drawer menu`}
      swipeEdgeWidth={winDim.width}
      swipeMinVelocity={100}
      swipeMinDistance={10}
      drawerType={IS_IOS ? 'slide' : 'front'}
      overlayStyle={{
        backgroundColor: select(t.name, {
          light: 'rgba(0, 57, 117, 0.1)',
          dark: IS_ANDROID
            ? 'rgba(16, 133, 254, 0.1)'
            : 'rgba(1, 82, 168, 0.1)',
          dim: 'rgba(10, 13, 16, 0.8)',
        }),
      }}>
      {children}
    </Drawer>
  )
}

export function Shell() {
  const t = useTheme()
  const fullyExpandedCount = useDialogFullyExpandedCountContext()

  /* Upstream's setSystemUITheme (src/alf/util/systemUI.ts): the root view shows behind the keyboard and sheets on Android. */
  useEffect(() => {
    if (!IS_ANDROID) return
    SystemUI.setBackgroundColorAsync(t.atoms.bg.backgroundColor).catch(() => {
      /* Rejects with 'The current activity is no longer available' - no big deal. */
    })
  }, [t])

  return (
    <View testID="mobileShellView" style={[a.h_full, t.atoms.bg]}>
      <SystemBars
        hidden={{statusBar: false, navigationBar: false}}
        style={{
          statusBar:
            t.name !== 'light' ||
            (IS_IOS && !IS_LIQUID_GLASS && fullyExpandedCount > 0)
              ? 'light'
              : 'dark',
          navigationBar: t.name !== 'light' ? 'light' : 'dark',
        }}
      />
      <BottomSheetProvider>
        <RoutesContainer>
          <ShellInner />
        </RoutesContainer>
      </BottomSheetProvider>
    </View>
  )
}
