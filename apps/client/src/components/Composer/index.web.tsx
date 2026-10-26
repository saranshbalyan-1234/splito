// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/view/shell/Composer.web.tsx
import {StyleSheet, View} from 'react-native'
import * as DismissableLayer from '@radix-ui/react-dismissable-layer'
import * as FocusGuards from '@radix-ui/react-focus-guards'
import * as FocusScope from '@radix-ui/react-focus-scope'
import {RemoveScrollBar} from 'react-remove-scroll-bar'

import {useShouldReduceMotion} from '#/motion/useShouldReduceMotion'
import {atoms as a, flatten, useBreakpoints, useTheme} from '#/alf'
import {Portal} from '#/components/Portal'

export {TopBar} from './TopBar'

const BOTTOM_BAR_HEIGHT = 61

/**
 * Bluesky's web composer: a dimmed full-window layer with the composer
 * centred near the top (full width above the bottom bar on phones). Escape
 * asks the composer to cancel; outside clicks are ignored, as upstream.
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
  const {gtMobile} = useBreakpoints()
  const reduceMotionEnabled = useShouldReduceMotion()

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
          onFocusOutside={evt => evt.preventDefault()}
          onInteractOutside={evt => evt.preventDefault()}
          onDismiss={onDismiss}>
          <View
            testID={testID}
            style={[
              styles.container,
              !gtMobile && styles.containerMobile,
              t.atoms.bg,
              t.atoms.border_contrast_medium,
              !reduceMotionEnabled && [
                a.zoom_fade_in,
                {animationDelay: 0.1},
                {animationFillMode: 'backwards'},
              ],
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
    marginTop: 50,
    maxWidth: 600,
    width: '100%',
    paddingVertical: 0,
    borderRadius: 8,
    marginBottom: 0,
    borderWidth: 1,
    maxHeight: 'calc(100% - (40px * 2))',
    overflow: 'hidden',
  },
  /* Splito: on phones the composer fills the height, as Bluesky's native composer does (owner: full-screen on phones). */
  containerMobile: {
    flex: 1,
    borderRadius: 0,
    marginBottom: BOTTOM_BAR_HEIGHT,
    maxHeight: `calc(100% - ${BOTTOM_BAR_HEIGHT}px)`,
  },
})
