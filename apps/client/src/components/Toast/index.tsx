// Adapted from bluesky-social/social-app@4e4ad9c (MIT) — src/components/Toast/index.tsx
import {isValidElement} from 'react'
import {View} from 'react-native'
import {nanoid} from 'nanoid/non-secure'
import {FadeIn, FadeOut} from 'react-native-reanimated'
import {toast as sonner, Toaster} from 'sonner-native'

import {useShouldReduceMotion} from '#/motion/useShouldReduceMotion'
import {atoms as a} from '#/alf'
import {HEADER_HEIGHT} from '#/components/Layout/const'
import {space} from '#/alf/tokens'
import {DURATION, TOAST_MAX_WIDTH} from '#/components/Toast/const'
import {
  Icon as ToastIcon,
  Outer as BaseOuter,
  Text as ToastText,
  ToastConfigProvider,
} from '#/components/Toast/Toast'
import {type BaseToastOptions} from '#/components/Toast/types'

export {DURATION} from '#/components/Toast/const'
export {Action, Icon, Text, ToastConfigProvider} from '#/components/Toast/Toast'
export {type ToastType} from '#/components/Toast/types'

/**
 * Toasts are rendered in a global outlet, which is placed at the top of the
 * component tree.
 */
export function ToastOutlet() {
  const isReduced = useShouldReduceMotion()
  /*
   * Owner 110: top of the screen below the safe area (sonner-native's top-center),
   * three at most, swiped up to dismiss; the X is in every toast (Toast.tsx).
   * Reduced motion swaps the slide for an instant appearance.
   */
  return (
    <Toaster
      pauseWhenPageIsHidden
      position="top-center"
      visibleToasts={3}
      swipeToDismissDirection="up"
      gap={a.gap_sm.gap}
      /* Below the header line, so a toast never covers the header's actions (F-243). */
      offset={HEADER_HEIGHT.native + a.gap_sm.gap}
      animation={
        isReduced ? {enter: FadeIn.duration(1), exit: FadeOut.duration(1)} : undefined
      }
    />
  )
}

export function Outer({children}: {children: React.ReactNode}) {
  return (
    <View
      style={[
        a.px_xl,
        a.w_full,
        {
          maxWidth: TOAST_MAX_WIDTH + space.xl * 2,
          alignSelf: 'center',
        },
      ]}>
      <BaseOuter>{children}</BaseOuter>
    </View>
  )
}

/**
 * Access the full Sonner API
 */
export const api = sonner

/**
 * Our base toast API, using the `Toast` export of this file.
 */
export function show(
  content: React.ReactNode,
  {type = 'default', ...options}: BaseToastOptions = {},
) {
  const id = nanoid()

  if (typeof content === 'string') {
    sonner.custom(
      <ToastConfigProvider id={id} type={type}>
        <Outer>
          <ToastIcon />
          <ToastText>{content}</ToastText>
        </Outer>
      </ToastConfigProvider>,
      {
        ...options,
        id,
        duration: options?.duration ?? DURATION,
      },
    )
  } else if (isValidElement(content)) {
    sonner.custom(
      <ToastConfigProvider id={id} type={type}>
        {content}
      </ToastConfigProvider>,
      {
        ...options,
        id,
        duration: options?.duration ?? DURATION,
      },
    )
  } else {
    throw new Error(
      `Toast can be a string or a React element, got ${typeof content}`,
    )
  }
  // Splito: the id, so a long-running toast (a progress line) can be dismissed when its work ends.
  return id
}
