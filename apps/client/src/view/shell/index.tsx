// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/view/shell/index.tsx
import {useEffect} from 'react'
import {useWindowDimensions, View} from 'react-native'
import {Drawer} from 'react-native-drawer-layout'
import {useNavigationState} from '@react-navigation/native'

import {isStateAtTabRoot} from '#/lib/routes/helpers'
import {useIsDrawerOpen, useSetDrawerOpen} from '#/state/shell'
import {RoutesContainer, TabsNavigator} from '#/navigation/Navigation'
import {atoms as a, select, useBreakpoints, useTheme} from '#/alf'
import {Outlet as PortalOutlet} from '#/components/Portal'
import {IS_ANDROID, IS_IOS} from '#/env'
import {DrawerContent} from './Drawer'

/*
 * Bluesky's native shell also mounts the composer, global dialogs,
 * push-notification and OTA hooks, system bars and account status screens.
 * Splito has none of those yet, so the navigator, the drawer and the portal
 * outlet remain.
 */
function ShellInner() {
  return (
    <>
      <View style={[a.h_full]}>
        <TabsNavigator layout={drawerLayout} />
      </View>
      <PortalOutlet />
    </>
  )
}

function drawerLayout({children}: {children: React.ReactNode}) {
  return <DrawerLayout>{children}</DrawerLayout>
}

function renderDrawerContent() {
  return <DrawerContent />
}

/*
 * As Bluesky: swiping right opens the drawer on a phone at a tab's root.
 * Bluesky closes it when the tablet sidebar shows; Splito's account avatar
 * opens it on tablets too (owner directive), so only the swipe is gated.
 */
function DrawerLayout({children}: {children: React.ReactNode}) {
  const t = useTheme()
  const isDrawerOpen = useIsDrawerOpen()
  const setIsDrawerOpen = useSetDrawerOpen()
  const winDim = useWindowDimensions()
  const {gtMobile} = useBreakpoints()
  const canGoBack = useNavigationState(state => !isStateAtTabRoot(state))
  const swipeEnabled = !gtMobile && !canGoBack

  useEffect(() => {
    // Leaving the tab roots (a push from inside the drawer) never leaves it open.
    if (canGoBack && isDrawerOpen) setIsDrawerOpen(false)
  }, [canGoBack, isDrawerOpen, setIsDrawerOpen])

  return (
    <Drawer
      renderDrawerContent={renderDrawerContent}
      drawerStyle={{width: Math.min(400, winDim.width * 0.8)}}
      configureGestureHandler={handler => {
        if (swipeEnabled) {
          if (isDrawerOpen) {
            return {...handler, activeOffsetX: [-1, 1]}
          } else {
            return {
              ...handler,
              // Any movement to the left is a row swipe, so fail the drawer gesture immediately.
              failOffsetX: -1,
              // Require more travel on Android, where a slow vertical scroll can look like a swipe.
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
      swipeEdgeWidth={winDim.width}
      swipeMinVelocity={100}
      swipeMinDistance={10}
      drawerType={IS_IOS ? 'slide' : 'front'}
      overlayStyle={{
        backgroundColor: select(t.name, {
          light: 'rgba(0, 57, 117, 0.1)',
          dark: IS_ANDROID ? 'rgba(16, 133, 254, 0.1)' : 'rgba(1, 82, 168, 0.1)',
          dim: 'rgba(10, 13, 16, 0.8)',
        }),
      }}>
      {children}
    </Drawer>
  )
}

export function Shell() {
  const t = useTheme()
  return (
    <View testID="mobileShellView" style={[a.h_full, t.atoms.bg]}>
      <RoutesContainer>
        <ShellInner />
      </RoutesContainer>
    </View>
  )
}
