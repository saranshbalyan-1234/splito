import {useRef} from 'react'
import {View, type ViewProps} from 'react-native'

import {atoms as a, tokens, useTheme, web} from '#/alf'
import {shouldDismissSheet} from './drag'

/** Bluesky's native sheet handle (`Dialog.Handle`), drawn for the phone-width web sheet. */
export function WebHandle() {
  const t = useTheme()
  return (
    <View
      aria-hidden
      style={[a.absolute, a.w_full, a.align_center, a.z_10, {height: 20}]}>
      <View
        style={[
          a.rounded_sm,
          {
            top: tokens.space._2xl / 2 - 2.5,
            width: 35,
            height: 5,
            backgroundColor: t.palette.contrast_975,
            opacity: 0.5,
          },
        ]}
      />
    </View>
  )
}

/*
 * Phone-width web has no bottom-sheet module, so the handle and top bar
 * track the pointer themselves: the sheet follows the finger, then closes
 * (asking first when there are changes) or springs back. The transform is
 * written to the sheet's element directly so a drag never re-renders React.
 */
export function useSheetDrag({
  isEnabled,
  isDirty,
  reduceMotion,
  onDismiss,
}: {
  isEnabled: boolean
  isDirty: boolean
  reduceMotion: boolean
  onDismiss: () => void
}): ViewProps {
  const state = useRef<{el: HTMLElement; y0: number; t0: number} | null>(null)
  if (!isEnabled) return {}
  const settle = (el: HTMLElement, transform: string) => {
    el.style.transition = reduceMotion
      ? 'none'
      : 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)'
    el.style.transform = transform
  }
  /* DOM pointer events: react-native-web passes them through untyped. */
  const handlers = {
    style: web({touchAction: 'none', cursor: 'grab'}),
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
      const target = e.target as HTMLElement
      /* The close button is a button, not a grip. */
      if (target.closest('button,[role="button"]')) return
      const el = (e.currentTarget as HTMLElement).closest(
        '[role="dialog"]',
      ) as HTMLElement | null
      if (!el) return
      e.currentTarget.setPointerCapture?.(e.pointerId)
      el.style.transition = 'none'
      state.current = {el, y0: e.clientY, t0: performance.now()}
    },
    onPointerMove: (e: React.PointerEvent<HTMLElement>) => {
      const s = state.current
      if (!s) return
      s.el.style.transform = `translateY(${Math.max(0, e.clientY - s.y0)}px)`
    },
    onPointerUp: (e: React.PointerEvent<HTMLElement>) => {
      const s = state.current
      state.current = null
      if (!s) return
      const dy = e.clientY - s.y0
      const velocity = dy / Math.max(1, performance.now() - s.t0)
      if (!shouldDismissSheet({dy, height: s.el.offsetHeight, velocity})) {
        settle(s.el, '')
      } else if (isDirty) {
        settle(s.el, '')
        onDismiss()
      } else {
        settle(s.el, 'translateY(100%)')
        setTimeout(onDismiss, reduceMotion ? 0 : 200)
      }
    },
    onPointerCancel: () => {
      const s = state.current
      state.current = null
      if (s) settle(s.el, '')
    },
  }
  return handlers as unknown as ViewProps
}
