// Adapted from bluesky-social/social-app@4e4ad9c (MIT) — src/components/Toast/index.web.tsx
import {isValidElement} from 'react'
import {nanoid} from 'nanoid/non-secure'
import {toast as sonner, Toaster} from 'sonner'

import {useShouldReduceMotion} from '#/motion/useShouldReduceMotion'
import {atoms as a, useBreakpoints} from '#/alf'
import {HEADER_HEIGHT} from '#/components/Layout/const'
import {DURATION} from '#/components/Toast/const'
import {
  Icon as ToastIcon,
  Outer as ToastOuter,
  Text as ToastText,
  ToastConfigProvider,
} from '#/components/Toast/Toast'
import {type BaseToastOptions} from '#/components/Toast/types'

export {DURATION} from '#/components/Toast/const'
export * from '#/components/Toast/Toast'
export {type ToastType} from '#/components/Toast/types'

/**
 * Toasts are rendered in a global outlet, which is placed at the top of the
 * component tree. Owner 110 (ARCHITECTURE 26.8): rail and desktop stack at the
 * top right below the header line, phones sit at the top full width inside the
 * gutters below the safe area; newest on top, three at most. Swiping up (phone)
 * or right (corner) dismisses; sonner slides them in from the top.
 */
export function ToastOutlet() {
  const {gtMobile} = useBreakpoints()
  const isReduced = useShouldReduceMotion()
  const top = HEADER_HEIGHT.web + a.gap_sm.gap
  return (
    <>
      {isReduced && (
        // The `motion` preference (the OS setting is already honoured by sonner's own CSS).
        <style>{'[data-sonner-toast],[data-sonner-toast]*{transition:none!important;animation:none!important}'}</style>
      )}
      <Toaster
        position={gtMobile ? 'top-right' : 'top-center'}
        visibleToasts={3}
        swipeDirections={gtMobile ? ['right'] : ['top']}
        gap={a.gap_sm.gap}
        offset={{top, right: a.p_xl.padding, left: a.p_xl.padding}}
        mobileOffset={{
          top: `calc(env(safe-area-inset-top, 0px) + ${top}px)`,
          left: a.p_xl.padding,
          right: a.p_xl.padding,
        }}
      />
    </>
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
    sonner(
      <ToastConfigProvider id={id} type={type}>
        <ToastOuter>
          <ToastIcon />
          <ToastText>{content}</ToastText>
        </ToastOuter>
      </ToastConfigProvider>,
      {
        ...options,
        unstyled: true, // required on web
        id,
        duration: options?.duration ?? DURATION,
      },
    )
  } else if (isValidElement(content)) {
    sonner(
      <ToastConfigProvider id={id} type={type}>
        {content}
      </ToastConfigProvider>,
      {
        ...options,
        unstyled: true, // required on web
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
