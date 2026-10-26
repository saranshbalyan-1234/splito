import {
  createThemes,
  DEFAULT_PALETTE,
  DEFAULT_SUBDUED_PALETTE,
  type Palette,
} from '@bsky.app/alf'
import {PREFS} from '@splito/sync'

import {hexToRgb, lighten} from '#/alf/util/colorGeneration'

/**
 * Accent presets for Settings > Appearance. Each keeps white text at 4.5:1
 * or better. Red-orange and amber are left out: next to the money red they
 * read as "you owe". Emerald stays as the owner's optional accent.
 */
export const ACCENTS = [
  {id: 'blue', hex: PREFS.accent.default},
  {id: 'emerald', hex: '#0B8263'},
  {id: 'indigo', hex: '#4F46E5'},
  {id: 'violet', hex: '#7C3AED'},
  {id: 'pink', hex: '#DB2777'},
  {id: 'graphite', hex: '#475569'},
] as const

export type AccentId = (typeof ACCENTS)[number]['id']

/** Colours offered when recolouring an expense category. */
export const CATEGORY_COLORS = [
  '#f97316',
  '#ef4444',
  '#ec4899',
  '#a855f7',
  '#8b5cf6',
  '#6366f1',
  '#0ea5e9',
  '#14b8a6',
  '#22c55e',
  '#84cc16',
  '#eab308',
  '#64748b',
  '#94a3b8',
  '#78716c',
] as const

const STEPS = [
  'primary_25',
  'primary_50',
  'primary_100',
  'primary_200',
  'primary_300',
  'primary_400',
  'primary_500',
  'primary_600',
  'primary_700',
  'primary_800',
  'primary_900',
  'primary_950',
  'primary_975',
] as const

/** HSL lightness, 0-100. */
export function lightness(hex: string): number {
  const rgb = hexToRgb(hex)
  if (!rgb) return 50
  return (
    ((Math.max(rgb.r, rgb.g, rgb.b) + Math.min(rgb.r, rgb.g, rgb.b)) /
      2 /
      255) *
    100
  )
}

/**
 * Bluesky's primary ramp re-anchored on `hex`: each step keeps the accent's
 * hue and saturation, and its distance from the 500 step is scaled from
 * Bluesky's own ramp (lighter steps toward white, darker toward black), so
 * tints, hovers and dark-mode inversions keep Bluesky's rhythm.
 */
export function accentRamp(
  hex: string,
  base: Palette,
): Pick<Palette, (typeof STEPS)[number]> {
  const anchor = lightness(hex)
  const base500 = lightness(base.primary_500)
  const ramp = {} as Record<(typeof STEPS)[number], string>
  for (const step of STEPS) {
    if (step === 'primary_500') {
      ramp[step] = hex
      continue
    }
    const l = lightness(base[step])
    const target =
      l > base500
        ? 100 - ((100 - anchor) * (100 - l)) / (100 - base500)
        : (anchor * l) / base500
    ramp[step] = lighten(hex, target - anchor)
  }
  return ramp
}

function buildThemes(hex: string) {
  const {light, dark, dim} = createThemes({
    defaultPalette: {...DEFAULT_PALETTE, ...accentRamp(hex, DEFAULT_PALETTE)},
    subduedPalette: {
      ...DEFAULT_SUBDUED_PALETTE,
      ...accentRamp(hex, DEFAULT_SUBDUED_PALETTE),
    },
  })
  return {
    light,
    dark,
    dim,
    lightPalette: light.palette,
    darkPalette: dark.palette,
    dimPalette: dim.palette,
  }
}

/* One entry: the same object back for the same accent keeps ALF's context value stable. */
let cache: {hex: string; themes: ReturnType<typeof buildThemes>} | undefined

/**
 * ALF themes for an accent, or undefined for Bluesky blue so the default
 * stays Bluesky's palette exactly.
 */
export function accentThemes(hex: string | undefined) {
  if (!hex || hex.toLowerCase() === PREFS.accent.default.toLowerCase()) {
    return undefined
  }
  if (cache?.hex !== hex) cache = {hex, themes: buildThemes(hex)}
  return cache.themes
}
