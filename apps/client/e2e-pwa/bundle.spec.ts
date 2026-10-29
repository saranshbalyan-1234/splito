import {readdirSync, readFileSync} from 'node:fs'
import {join} from 'node:path'

import {expect, test} from '@playwright/test'

/*
 * F-242 acc 1: the PRODUCTION web build (`build-web`'s export, built by this
 * config) carries none of why-did-you-render or its report store, and no
 * @welldone-software package reaches a shipped file. `e2e/bundle.spec.ts` checks
 * the e2e export the same way.
 */
test('the production build holds no why-did-you-render', () => {
  const dist = join(__dirname, '..', 'dist-pwa')
  const walk = (dir: string): string[] =>
    readdirSync(dir, {withFileTypes: true}).flatMap(e =>
      e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
    )
  const files = walk(dist).filter(f => /\.(js|html|json)$/.test(f))
  expect(files.length).toBeGreaterThan(0)
  for (const f of files) {
    const text = readFileSync(f, 'utf8')
    for (const marker of [
      'wdyrStore',
      '__wdyr',
      'whyDidYouRender',
      '@welldone-software',
    ])
      expect(text, `${f} contains ${marker}`).not.toContain(marker)
  }
})
