// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/view/shell/index.web.tsx
import {useEffect, useLayoutEffect, useState} from 'react'
import {StyleSheet, TouchableWithoutFeedback, View} from 'react-native'
import {useLingui} from '@lingui/react/macro'
import * as FocusScope from '@radix-ui/react-focus-scope'
import {RemoveScrollBar} from 'react-remove-scroll-bar'

import {useIsDrawerOpen, useSetDrawerOpen} from '#/state/shell'
import {FlatNavigator, RoutesContainer} from '#/navigation/Navigation'
import {atoms as a, flatten, select, useTheme} from '#/alf'
import {Outlet as PortalOutlet} from '#/components/Portal'
import {DrawerContent} from './Drawer'

/*
 * Bluesky's web shell also mounts the composer, global dialogs (sign-in,
 * report, muted words ...), age-assurance and account status screens.
 * Splito has none of those, so the navigator, the drawer and the portal
 * outlet remain.
 */
function ShellInner() {
  return (
    <>
      <FlatNavigator layout={drawerLayout} />
      <PortalOutlet />
    </>
  )
}

function drawerLayout({children}: {children: React.ReactNode}) {
  return <DrawerLayout>{children}</DrawerLayout>
}

/*
 * Bluesky shows this drawer only below the tablet breakpoint (the sidebar
 * covers wider windows). Splito's account avatar opens it at every width
 * (owner directive), so it is not gated on `gtTablet`. Escape closes it and
 * focus stays inside while it is open, as in Bluesky's web dialogs.
 */
function DrawerLayout({children}: {children: React.ReactNode}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const showDrawer = useIsDrawerOpen()
  const setDrawerOpen = useSetDrawerOpen()
  const [showDrawerDelayedExit, setShowDrawerDelayedExit] = useState(showDrawer)

  useLayoutEffect(() => {
    if (showDrawer !== showDrawerDelayedExit) {
      if (showDrawer) {
        setShowDrawerDelayedExit(true)
      } else {
        const timeout = setTimeout(() => {
          setShowDrawerDelayedExit(false)
        }, 160)
        return () => clearTimeout(timeout)
      }
    }
  }, [showDrawer, showDrawerDelayedExit])

  useEffect(() => {
    if (!showDrawer) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [showDrawer, setDrawerOpen])

  return (
    <>
      {children}
      {showDrawerDelayedExit && (
        <>
          <RemoveScrollBar />
          <TouchableWithoutFeedback
            onPress={ev => {
              // Only close if press happens outside of the drawer
              if (ev.target === ev.currentTarget) {
                setDrawerOpen(false)
              }
            }}
            accessibilityLabel={l`Close drawer menu`}
            accessibilityHint="">
            <View
              testID="drawer-scrim"
              style={[
                styles.drawerMask,
                {
                  backgroundColor: showDrawer
                    ? select(t.name, {
                        light: 'rgba(0, 57, 117, 0.1)',
                        dark: 'rgba(1, 82, 168, 0.1)',
                        dim: 'rgba(10, 13, 16, 0.8)',
                      })
                    : 'transparent',
                },
                a.transition_color,
              ]}>
              <FocusScope.FocusScope loop trapped={showDrawer} asChild>
                <View
                  // As in Bluesky's web Dialog: FocusScope's slot needs one flat style object.
                  style={flatten([
                    styles.drawerContainer,
                    showDrawer ? a.slide_in_left : a.slide_out_left,
                  ])}>
                  <DrawerContent />
                </View>
              </FocusScope.FocusScope>
            </View>
          </TouchableWithoutFeedback>
        </>
      )}
    </>
  )
}

export function Shell() {
  const t = useTheme()
  return (
    <View style={[a.util_screen_outer, t.atoms.bg]}>
      <RoutesContainer>
        <ShellInner />
      </RoutesContainer>
    </View>
  )
}

const styles = StyleSheet.create({
  drawerMask: {
    ...a.fixed,
    width: '100%',
    height: '100%',
    top: 0,
    left: 0,
    zIndex: 50,
  },
  drawerContainer: {
    display: 'flex',
    ...a.fixed,
    top: 0,
    left: 0,
    height: '100%',
    width: 330,
    maxWidth: '80%',
  },
})
