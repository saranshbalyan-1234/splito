// Adapted from bluesky-social/social-app@4e4ad9c (MIT) — src/alf/themes.ts
import {
  createThemes,
  DEFAULT_PALETTE,
  DEFAULT_SUBDUED_PALETTE,
} from '@bsky.app/alf'

/**
 * Splito emerald-teal ramp. Unused for now: the shell ships Bluesky's palette
 * as-is; this becomes an optional accent in Settings later.
 */
export const SPLITO_PRIMARY = {
  primary_25: '#F2FBF8',
  primary_50: '#E3F6EF',
  primary_100: '#C4ECDD',
  primary_200: '#97DEC4',
  primary_300: '#5FCBA5',
  primary_400: '#2FB487',
  primary_500: '#0F9D76',
  primary_600: '#0B8263',
  primary_700: '#08674F',
  primary_800: '#065140',
  primary_900: '#053E31',
  primary_950: '#032A21',
  primary_975: '#021A15',
}

const DEFAULT_THEMES = createThemes({
  defaultPalette: DEFAULT_PALETTE,
  subduedPalette: DEFAULT_SUBDUED_PALETTE,
})

export const themes = {
  lightPalette: DEFAULT_THEMES.light.palette,
  darkPalette: DEFAULT_THEMES.dark.palette,
  dimPalette: DEFAULT_THEMES.dim.palette,
  light: DEFAULT_THEMES.light,
  dark: DEFAULT_THEMES.dark,
  dim: DEFAULT_THEMES.dim,
}

/**
 * @deprecated use ALF and access palette from `useTheme()`
 */
export const lightPalette = DEFAULT_THEMES.light.palette
/**
 * @deprecated use ALF and access palette from `useTheme()`
 */
export const darkPalette = DEFAULT_THEMES.dark.palette
/**
 * @deprecated use ALF and access palette from `useTheme()`
 */
export const dimPalette = DEFAULT_THEMES.dim.palette
/**
 * @deprecated use ALF and access theme from `useTheme()`
 */
export const light = DEFAULT_THEMES.light
/**
 * @deprecated use ALF and access theme from `useTheme()`
 */
export const dark = DEFAULT_THEMES.dark
/**
 * @deprecated use ALF and access theme from `useTheme()`
 */
export const dim = DEFAULT_THEMES.dim
