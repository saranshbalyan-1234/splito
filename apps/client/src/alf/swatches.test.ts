/// <reference types="bun" />
import {expect, test} from 'bun:test'
import {DEFAULT_PALETTE} from '@bsky.app/alf'

import {contrastRatio} from '#/alf/util/colorGeneration'
import {ACCENTS, accentRamp, accentThemes, lightness} from './swatches'

test('Bluesky blue keeps the stock palette', () => {
  expect(accentThemes('#006AFF')).toBeUndefined()
  expect(accentThemes('#006aff')).toBeUndefined()
  expect(accentThemes(undefined)).toBeUndefined()
})

test('the accent is primary_500 in light, dark and dim', () => {
  const themes = accentThemes('#0B8263')!
  expect(themes.light.palette.primary_500).toBe('#0B8263')
  expect(themes.dark.palette.primary_500).toBe('#0B8263')
  expect(themes.dim.palette.primary_500).toBe('#0B8263')
  // Theme atoms are rebuilt from the new palette.
  expect(themes.light.atoms.text_link.color).not.toBe(
    DEFAULT_PALETTE.primary_500,
  )
})

test('every ramp runs light to dark around the accent', () => {
  for (const {hex} of ACCENTS) {
    const ramp = Object.values(accentRamp(hex, DEFAULT_PALETTE)).map(lightness)
    for (let i = 1; i < ramp.length; i++) {
      expect(ramp[i]!).toBeLessThanOrEqual(ramp[i - 1]! + 0.5)
    }
    expect(ramp[0]!).toBeGreaterThan(94)
    expect(ramp.at(-1)!).toBeLessThan(15)
  }
})

test('re-anchoring Bluesky blue on itself reproduces its ramp closely', () => {
  const ramp = accentRamp(DEFAULT_PALETTE.primary_500, DEFAULT_PALETTE)
  for (const [step, hex] of Object.entries(ramp)) {
    const stock = DEFAULT_PALETTE[step as keyof typeof ramp]
    expect(Math.abs(lightness(hex) - lightness(stock))).toBeLessThan(1.5)
  }
})

test('presets keep white button text readable (WCAG AA, 4.5:1)', () => {
  for (const {hex} of ACCENTS) {
    expect(contrastRatio(hex, '#FFFFFF')!).toBeGreaterThanOrEqual(4.5)
  }
})
