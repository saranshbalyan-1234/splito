// Adapted from bluesky-social/social-app@4e4ad9c (MIT) — src/alf/breakpoints.ts
import {useMemo, useSyncExternalStore} from 'react'
import {useMediaQuery} from 'react-responsive'

import {type Breakpoint, BREAKPOINTS} from '#/alf/breakpoints.shared'

export {type Breakpoint, BreakpointWidthContext} from '#/alf/breakpoints.shared'

/*
 * One `matchMedia` list per width, shared by every reader. `react-responsive`'s hook made a query, a listener and
 * state per call, and `useBreakpoints` is called by rows and menus: three per row, 5 % of opening a 45-row list at 6x CPU.
 */
const minWidths = new Map<number, {matches: () => boolean; subscribe: (onChange: () => void) => () => void}>()
function minWidth(px: number) {
  let q = minWidths.get(px)
  if (!q) {
    const list = window.matchMedia(`(min-width: ${px}px)`)
    q = {
      matches: () => list.matches,
      subscribe: onChange => {
        list.addEventListener('change', onChange)
        return () => list.removeEventListener('change', onChange)
      },
    }
    minWidths.set(px, q)
  }
  return q
}
function useMinWidth(px: number) {
  const q = minWidth(px)
  return useSyncExternalStore(q.subscribe, q.matches, q.matches)
}

export function useBreakpoints(): Record<Breakpoint, boolean> & {
  activeBreakpoint: Breakpoint | undefined
} {
  const gtPhone = useMinWidth(BREAKPOINTS.phone)
  const gtMobile = useMinWidth(BREAKPOINTS.mobile)
  const gtTablet = useMinWidth(BREAKPOINTS.tablet)
  return useMemo(() => {
    let active: Breakpoint | undefined
    if (gtTablet) {
      active = 'gtTablet'
    } else if (gtMobile) {
      active = 'gtMobile'
    } else if (gtPhone) {
      active = 'gtPhone'
    }
    return {
      activeBreakpoint: active,
      gtPhone,
      gtMobile,
      gtTablet,
    }
  }, [gtPhone, gtMobile, gtTablet])
}

/**
 * Fine-tuned breakpoints for the shell layout
 */
export function useLayoutBreakpoints() {
  const leftNavMinimal = useMediaQuery({maxWidth: BREAKPOINTS.leftNavLabels - 1})
  return {
    rightNavVisible: false,
    centerColumnOffset: false,
    leftNavMinimal,
  }
}
