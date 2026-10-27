// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/lib/hooks/useMinimalShellTransform.ts
import {interpolate, useAnimatedStyle} from 'react-native-reanimated'

import {useMinimalShellMode} from '#/state/shell/minimal-mode'
import {useShellLayout} from '#/state/shell/shell-layout'

// Keep these separated so that we only pay for useAnimatedStyle that gets used.

export function useMinimalShellFooterTransform() {
  const {footerMode, scrollMode} = useMinimalShellMode()
  const {footerHeight} = useShellLayout()

  const footerTransform = useAnimatedStyle(() => {
    const footerModeValue = Math.max(footerMode.get(), scrollMode.get())
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
  const {footerMode, scrollMode} = useMinimalShellMode()

  const fabTransform = useAnimatedStyle(() => {
    return {
      transform: [
        {
          translateY: interpolate(
            Math.max(footerMode.get(), scrollMode.get()),
            [0, 1],
            [-44, 0],
          ),
        },
      ],
    }
  })
  return fabTransform
}
