// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/view/shell/Composer.web.tsx
import {useRef, useState} from 'react'
import {StyleSheet} from 'react-native'
import Animated from 'react-native-reanimated'
import * as DismissableLayer from '@radix-ui/react-dismissable-layer'
import * as FocusGuards from '@radix-ui/react-focus-guards'
import * as FocusScope from '@radix-ui/react-focus-scope'
import {RemoveScrollBar} from 'react-remove-scroll-bar'

import {OpenedContext} from '#/lib/hooks/useAfterTransition'
import {atoms as a, flatten, useTheme} from '#/alf'
import {
  DrawerHandle,
  DrawerScrim,
  useDrawer,
  useIsWebDrawer,
} from '#/components/Dialog/drawer.web'
import {Portal} from '#/components/Portal'

/**
 * Bluesky's web composer: a dimmed full-window layer with the composer
 * over it. Splito centres it like Bluesky's dialogs, and on phones it rises
 * from the bottom edge as Dialog's drawer (owner rule 7: one sheet layout):
 * handle, drag down to close (through `onDismiss`, so unsaved changes ask). Escape
 * and a click on the scrim ask the composer to close; clicks in nested
 * dialogs (pickers, prompts) are ignored, as upstream.
 *
 * Bluesky mounts its composer at the shell's top level. This is a route, so
 * it renders through the shell's portal outlet to sit above the sidebar.
 */
export function Outer({
  children,
  onDismiss,
  testID,
}: {
  children: React.ReactNode
  onDismiss: () => void
  testID?: string
}) {
  const t = useTheme()
  const isSheet = useIsWebDrawer()
  /* The rise (or the popup's zoom) has ended: deferred bodies in it mount now (owner 168). */
  const [opened, setOpened] = useState(false)
  const drawer = useDrawer({
    enabled: isSheet,
    onRequestClose: onDismiss,
    onOpened: () => setOpened(true),
  })
  const reduceMotionEnabled = drawer.reduceMotion
  /* Only a press that starts and ends on the scrim closes (not a text drag out of a field). */
  const pressStart = useRef<EventTarget | null>(null)

  FocusGuards.useFocusGuards()

  return (
    <Portal>
      <RemoveScrollBar />
      <FocusScope.FocusScope loop trapped asChild>
        <DismissableLayer.DismissableLayer
          role="dialog"
          aria-modal
          style={flatten([
            {position: 'fixed'},
            a.inset_0,
            // A drawer's scrim follows the sheet.
            !isSheet && {backgroundColor: '#000c'},
            a.flex,
            a.flex_col,
            a.align_center,
            !reduceMotionEnabled && !isSheet && a.fade_in,
          ])}
          onPointerDown={e => {
            pressStart.current = e.target
          }}
          onClick={e => {
            if (
              e.target === e.currentTarget &&
              pressStart.current === e.currentTarget
            )
              onDismiss()
          }}
          onFocusOutside={evt => evt.preventDefault()}
          onInteractOutside={evt => evt.preventDefault()}
          onDismiss={onDismiss}>
          {isSheet && (
            <DrawerScrim
              scrimStyle={drawer.scrimStyle}
              reduceMotion={reduceMotionEnabled}
            />
          )}
          <Animated.View
            testID={testID}
            onLayout={isSheet ? drawer.onLayout : undefined}
            style={[
              styles.container,
              t.atoms.bg,
              t.atoms.border_contrast_medium,
              isSheet
                ? [
                    drawer.frameStyle,
                    drawer.sheetFrameStyle,
                    reduceMotionEnabled && a.fade_in,
                  ]
                : !reduceMotionEnabled && [
                    a.zoom_fade_in,
                    {animationDelay: 0.1},
                    {animationFillMode: 'backwards'},
                  ],
              drawer.sheetStyle,
            ]}>
            {isSheet && <DrawerHandle handleProps={drawer.handleProps} />}
            <OpenedContext.Provider value={opened}>{children}</OpenedContext.Provider>
          </Animated.View>
        </DismissableLayer.DismissableLayer>
      </FocusScope.FocusScope>
    </Portal>
  )
}

const styles = StyleSheet.create({
  container: {
    marginTop: 'auto',
    marginBottom: 'auto',
    maxWidth: 600,
    width: '100%',
    paddingVertical: 0,
    borderRadius: 8,
    borderWidth: 1,
    maxHeight: 'calc(100% - (40px * 2))',
    overflow: 'hidden',
  },
})
