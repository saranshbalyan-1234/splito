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

/*
 * F-264 / owner 185: the launch mark breathes. The web launch screen is CSS in index.html (before any script); the
 * native one is a JS screen that must sit exactly where the native splash does.
 */
test('the web launch mark breathes from CSS alone, with a reduced-motion pulse', () => {
  const html = readFileSync(join(client, 'public/index.html'), 'utf8')
  expect(html).toMatch(/@keyframes launchBreathe[^@]*scale\(1\)[^@]*scale\(1\.08\)/)
  expect(html).toMatch(/#launch-mark img \{[^}]*animation: launchBreathe 1\.2s ease-in-out infinite/)
  expect(html).toMatch(/prefers-reduced-motion: reduce\) \{ #launch-mark img \{ animation: launchPulse/)
  // Outside #root, so the app renders underneath and the fade-out shifts nothing; no script is needed to animate.
  expect(html).toMatch(/<div id="root"><\/div>\s*<!--[\s\S]*?-->\s*<div id="launch"/)
  expect(html).not.toMatch(/<script/)
  expect(html).toMatch(new RegExp(`prefers-color-scheme: dark\\) \\{ #launch \\{ background: ${dimBg}`, 'i'))
})

test('the native launch screen draws what the native splash draws', () => {
  const config = readFileSync(join(client, 'app.config.ts'), 'utf8')
  const screen = readFileSync(join(client, 'src/components/LaunchScreen/index.tsx'), 'utf8')
  expect(config).toContain('imageWidth: 200')
  expect(screen).toContain('LOGO_WIDTH = 200')
  expect(config).toContain("image: './assets/brand/splash-mark.png'")
  expect(config).toContain("image: './assets/brand/splash-mark-dark.png'")
  expect(screen).toContain("require('../../../assets/brand/splash-mark.png')")
  expect(screen).toContain("require('../../../assets/brand/splash-mark-dark.png')")
  expect(themes.light.atoms.bg.backgroundColor).toBe('#FFFFFF')
  expect(config).toContain("backgroundColor: '#FFFFFF'")
})
