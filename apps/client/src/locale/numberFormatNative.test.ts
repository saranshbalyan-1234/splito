/// <reference types="bun" />
import {expect, test} from 'bun:test'
import {PREFS} from '@splito/sync'

/*
 * F-115 M17: native loads formatjs polyfills with locale data for a few
 * languages only. Every Number format option must format under it with its
 * own marks, or the preference silently does nothing on iOS and Android.
 * The polyfill replaces global Intl, so this runs in a child process.
 */
const OPTIONS = ['en-IN', 'en-US', 'de-DE', 'fr-FR', 'hi-IN']

const script = `
import '#/locale/i18n'
const out = {}
for (const loc of ${JSON.stringify(OPTIONS)}) {
  out[loc] = new Intl.NumberFormat(loc).format(1234567.5)
  out[loc + ':eur'] = new Intl.NumberFormat(loc, {style: 'currency', currency: 'EUR'}).format(1234.5)
}
console.log(JSON.stringify(out))
`

test('every Number format option formats with its own marks under the native polyfill', () => {
  const run = Bun.spawnSync(['bun', '-e', script], {
    cwd: import.meta.dir + '/../..',
    stderr: 'pipe',
  })
  const out = JSON.parse(run.stdout.toString()) as Record<string, string>
  expect(out['en-IN']).toBe('12,34,567.5')
  expect(out['hi-IN']).toBe('12,34,567.5')
  expect(out['en-US']).toBe('1,234,567.5')
  expect(out['de-DE']).toBe('1.234.567,5')
  expect(out['de-DE:eur']?.replace(/\s/g, ' ')).toBe('1.234,50 €')
  expect(out['en-IN:eur']).toBe('€1,234.50')
  // fr uses a narrow no-break space (U+202F) between groups.
  expect(out['fr-FR']?.replace(/[  ]/g, ' ')).toBe('1 234 567,5')
})

test('the test covers every option the preference offers', () => {
  for (const v of ['en-IN', 'en-US', 'de-DE', 'fr-FR'])
    expect(PREFS.numberLocale.validate(v)).toBe(true)
})
