// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/view/shell/Composer.web.tsx
import {useRef} from 'react'
import {StyleSheet, View} from 'react-native'
import * as DismissableLayer from '@radix-ui/react-dismissable-layer'
import * as FocusGuards from '@radix-ui/react-focus-guards'
import * as FocusScope from '@radix-ui/react-focus-scope'
import {RemoveScrollBar} from 'react-remove-scroll-bar'

import {useShouldReduceMotion} from '#/motion/useShouldReduceMotion'
import {atoms as a, flatten, useTheme, web} from '#/alf'
import {SLIDE_UP, useIsSheet} from '#/components/FormSheet/shared'
import {Portal} from '#/components/Portal'

/**
 * Bluesky's web composer: a dimmed full-window layer with the composer
 * over it. Splito centres it like Bluesky's dialogs, and on phones it rises
 * from the bottom edge as a sheet (owner rule 7: one sheet layout). Escape
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
  const isSheet = useIsSheet()
  const reduceMotionEnabled = useShouldReduceMotion()
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
            {backgroundColor: '#000c'},
            a.flex,
            a.flex_col,
            a.align_center,
            !reduceMotionEnabled && a.fade_in,
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
          <View
            testID={testID}
            style={[
              styles.container,
              isSheet && styles.containerSheet,
              t.atoms.bg,
              t.atoms.border_contrast_medium,
              !reduceMotionEnabled &&
                (isSheet
                  ? web({animation: SLIDE_UP})
                  : [
                      a.zoom_fade_in,
                      {animationDelay: 0.1},
                      {animationFillMode: 'backwards'},
                    ]),
            ]}>
            {children}
          </View>
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
  /* Splito: on phones the composer is a sheet from the bottom edge, as the dialog sheets are. */
  containerSheet: {
    marginBottom: 0,
    maxWidth: '100%',
    maxHeight: 'calc(100% - 48px)',
    borderWidth: 0,
    borderTopWidth: 1,
    borderRadius: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
})
