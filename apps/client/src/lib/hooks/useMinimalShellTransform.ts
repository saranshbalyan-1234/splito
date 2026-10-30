// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/lib/hooks/useMinimalShellTransform.ts
import {interpolate, useAnimatedStyle} from 'react-native-reanimated'

import {useMinimalShellMode} from '#/state/shell/minimal-mode'
import {useShellLayout} from '#/state/shell/shell-layout'

// Keep these separated so that we only pay for useAnimatedStyle that gets used.
// Splito (ARCHITECTURE 26.4, owner 87): only the header scrolls away; the bottom
// bar and FAB stay put while scrolling and follow `footerMode` alone, as upstream.

export function useMinimalShellFooterTransform() {
  const {footerMode} = useMinimalShellMode()
  const {footerHeight} = useShellLayout()

  const footerTransform = useAnimatedStyle(() => {
    const footerModeValue = footerMode.get()
    return {
      pointerEvents: footerModeValue === 0 ? 'auto' : 'none',
      opacity: Math.pow(1 - footerModeValue, 2),
      transform: [
        {
          translateY: interpolate(
            footerModeValue,
            [0, 1],
            [0, footerHeight.get()],
          ),
        },
      ],
    }
  })

  return footerTransform
}

export function useMinimalShellFabTransform() {
  const {footerMode} = useMinimalShellMode()

  const fabTransform = useAnimatedStyle(() => {
    return {
      transform: [
        {
          translateY: interpolate(
            footerMode.get(),
            [0, 1],
            [-50, 0],
          ),
        },
      ],
    }
  })
  return fabTransform
}
