// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/view/shell/index.web.tsx
import {useEffect, useLayoutEffect, useRef, useState} from 'react'
import {StyleSheet, TouchableWithoutFeedback, View} from 'react-native'
import {useLingui} from '@lingui/react/macro'
import * as DismissableLayer from '@radix-ui/react-dismissable-layer'
import {useFocusGuards} from '@radix-ui/react-focus-guards'
import * as FocusScope from '@radix-ui/react-focus-scope'
import {RemoveScrollBar} from 'react-remove-scroll-bar'

import {useIsDrawerOpen, useSetDrawerOpen} from '#/state/shell'
import {SearchAskProvider} from '#/features/searchAsk/SearchAskProvider'
import {OPENED_FALLBACK_MS, OpenedContext} from '#/lib/hooks/useAfterTransition'
import {DrawerContent} from '#/navigation/Drawer'
import {FeedbackProvider} from '#/features/feedback/FeedbackProvider'
import {FlatNavigator, RoutesContainer} from '#/navigation/Navigation'
import {atoms as a, flatten, select, useTheme} from '#/alf'
import {DemoBusy} from '#/components/DemoBusy'
import {Outlet as PortalOutlet} from '#/components/Portal'
import {useShouldReduceMotion} from '#/motion/useShouldReduceMotion'

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
 * Bluesky's web shell also mounts the composer, global dialogs (sign-in,
 * report, muted words ...), age-assurance and account status screens.
 * Splito has none of those, so the navigator, the drawer and the portal
 * outlet remain.
 */
function ShellInner() {
  return (
    <FeedbackProvider>
      <FlatNavigator layout={drawerLayout} />
      <PortalOutlet />
      <DemoBusy />
    </FeedbackProvider>
  )
}

/*
 * Bluesky only shows this drawer below the tablet breakpoint, where its
 * hamburger lives. Splito has no hamburger and no swipe for it (owner 216: iOS Safari's own left-edge swipe is Back,
 * and the two fought); the avatar opens Profile and the drawer opens only by its address (`?drawer=menu`). Focus is
 * trapped in the
 * panel and Escape closes it, as in Splito's web dialogs.
 */
function DrawerLayout({children}: {children: React.ReactNode}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const isDrawerOpen = useIsDrawerOpen()
  const setDrawerOpen = useSetDrawerOpen()
  const shouldReduceMotion = useShouldReduceMotion()
  const showDrawer = isDrawerOpen
  const [showDrawerDelayedExit, setShowDrawerDelayedExit] = useState(showDrawer)

  useLayoutEffect(() => {
    if (showDrawer !== showDrawerDelayedExit) {
      if (showDrawer) {
        setShowDrawerDelayedExit(true)
      } else {
        const timeout = setTimeout(
          () => {
            setShowDrawerDelayedExit(false)
          },
          shouldReduceMotion ? 0 : 160,
        )
        return () => clearTimeout(timeout)
      }
    }
  }, [showDrawer, showDrawerDelayedExit, shouldReduceMotion])

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
              <DrawerPanel
                isOpen={showDrawer}
                shouldAnimate={!shouldReduceMotion}
                onDismiss={() => setDrawerOpen(false)}
              />
            </View>
          </TouchableWithoutFeedback>
        </>
      )}
    </>
  )
}

function DrawerPanel({
  isOpen,
  shouldAnimate,
  onDismiss,
}: {
  isOpen: boolean
  shouldAnimate: boolean
  onDismiss: () => void
}) {
  const {t: l} = useLingui()
  useFocusGuards()
  /*
   * The slide decides when the menu mounts (owner 168): the panel and its scrim move first, the items follow
   * `animationend`. A timer opens it anyway; without animation it is open as drawn.
   */
  const [opened, setOpened] = useState(!shouldAnimate)
  const panel = useRef<React.ComponentRef<typeof View>>(null)
  useEffect(() => {
    if (!shouldAnimate || !isOpen) return
    const node = panel.current as unknown as HTMLElement | null
    const done = () => setOpened(true)
    // The panel's own slide, not an animation that bubbles up from something inside it.
    const onEnd = (e: Event) => e.target === node && done()
    node?.addEventListener('animationend', onEnd)
    const id = setTimeout(done, OPENED_FALLBACK_MS)
    return () => {
      node?.removeEventListener('animationend', onEnd)
      clearTimeout(id)
    }
  }, [shouldAnimate, isOpen])
  return (
    <FocusScope.FocusScope loop asChild trapped={isOpen}>
      <View
        ref={panel}
        role="dialog"
        aria-modal={true}
        aria-label={l`Menu`}
        // Radix's Slot spreads the style, so it must be one object.
        style={flatten([
          styles.drawerContainer,
          shouldAnimate && (isOpen ? a.slide_in_left : a.slide_out_left),
        ])}>
        <DismissableLayer.DismissableLayer
          onEscapeKeyDown={onDismiss}
          onPointerDownOutside={ev => ev.preventDefault()}
          onFocusOutside={ev => ev.preventDefault()}
          style={{height: '100%', display: 'flex', flexDirection: 'column'}}>
          <OpenedContext.Provider value={opened}>
            <DrawerContent />
          </OpenedContext.Provider>
        </DismissableLayer.DismissableLayer>
      </View>
    </FocusScope.FocusScope>
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
    // Above the sticky headers (z 10), which Bluesky's mobile drawer never meets.
    zIndex: 50,
    width: '100%',
    height: '100%',
    top: 0,
    left: 0,
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
