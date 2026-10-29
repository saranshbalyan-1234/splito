/// <reference types="bun" />
import {expect, test} from 'bun:test'

import {contrastRatio} from '#/alf/util/colorGeneration'
import {themes} from './themes'

/* Unsynced rows draw their default text in text_contrast_medium (owner 111): it must stay AA on every surface a row sits on. */
test('text_contrast_medium is WCAG AA (4.5:1) on every surface in light, Dim and dark', () => {
  for (const name of ['light', 'dim', 'dark'] as const) {
    const atoms = themes[name].atoms
    const text = atoms.text_contrast_medium.color
    for (const bg of [atoms.bg, atoms.bg_contrast_25, atoms.bg_contrast_50]) {
      expect(contrastRatio(text, bg.backgroundColor)!).toBeGreaterThanOrEqual(4.5)
    }
  }
})
