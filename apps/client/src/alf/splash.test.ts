import {expect, test} from 'bun:test'
import {readFileSync} from 'node:fs'
import {join} from 'node:path'

import {themes} from '#/alf/themes'

/*
 * ARCHITECTURE 26.11 / F-1711: in dark mode the native splash and the web
 * launch screen use ALF Dim's background, never pure black.
 */
const client = join(import.meta.dir, '../..')
const dimBg = themes.dim.atoms.bg.backgroundColor as string

test('the native dark splash takes the Dim background', () => {
  const config = readFileSync(join(client, 'app.config.ts'), 'utf8')
  expect(config).toContain(`DIM_BACKGROUND = '${dimBg}'`)
  expect(config).toMatch(/dark: \{[^}]*backgroundColor: DIM_BACKGROUND/s)
  expect(config).not.toContain('#000000')
})

test('the web launch screen takes the Dim background in dark mode', () => {
  const html = readFileSync(join(client, 'public/index.html'), 'utf8')
  expect(html).toMatch(
    new RegExp(`prefers-color-scheme: dark\\) \\{ body \\{ background: ${dimBg}`, 'i'),
  )
})
