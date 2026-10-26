// Adapted from bluesky-social/social-app@4e4ad9c (MIT) — src/alf/breakpoints.shared.ts
import {createContext} from 'react'

export type Breakpoint = 'gtPhone' | 'gtMobile' | 'gtTablet'

export const BREAKPOINTS = {
  phone: 500,
  mobile: 800,
  tablet: 1300,
  rightNav: 1100,
  /** Splito: the sidebar shows labels from here up, an icon rail below (owner directive). */
  leftNavLabels: 1000,
} as const

/** The available width inside a native sheet or other contained surface. */
export const BreakpointWidthContext = createContext<number | undefined>(
  undefined,
)

export function getBreakpoints(width: number): Record<Breakpoint, boolean> & {
  activeBreakpoint: Breakpoint | undefined
} {
  const gtPhone = width >= BREAKPOINTS.phone
  const gtMobile = width >= BREAKPOINTS.mobile
  const gtTablet = width >= BREAKPOINTS.tablet

  return {
    gtPhone,
    gtMobile,
    gtTablet,
    activeBreakpoint: gtTablet
      ? 'gtTablet'
      : gtMobile
        ? 'gtMobile'
        : gtPhone
          ? 'gtPhone'
          : undefined,
  }
}

/*
 * Splito's shell is the sidebar plus full-width content (owner directive), so
 * there is no right rail and no centred column to offset.
 */
export function getLayoutBreakpoints(width: number) {
  return {
    rightNavVisible: false,
    centerColumnOffset: false,
    leftNavMinimal: width < BREAKPOINTS.leftNavLabels,
  }
}

/**
 * Bluesky centres tablet content in a 600px column. Splito's content fills
 * the space beside the sidebar on every platform (owner directive), so this
 * is always false; it stays so adapted components keep their upstream shape.
 */
export function shouldCenterNativeTabletContent(_opts: {
  gtMobile: boolean
  isWithinDialog: boolean
  isWithinSplitView: boolean
  isWithinOffsetView: boolean
  disabled?: boolean
}) {
  return false
}
