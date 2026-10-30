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

/*
 * F-250: the PREVIEW export (what Render serves for review; a production build is refused) carries the dev sign-in the review
 * needs and none of the e2e-only hooks. `e2e/authConfig.spec.ts` checks that production refuses to build at all.
 */
test('the preview build has the dev sign-in and no e2e hooks', () => {
  const dist = join(__dirname, '..', 'dist-pwa')
  const walk = (dir: string): string[] =>
    readdirSync(dir, {withFileTypes: true}).flatMap(e => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]))
  const text = walk(dist)
    .filter(f => /\.js$/.test(f))
    .map(f => readFileSync(f, 'utf8'))
    .join('\n')
  for (const marker of ['continue-dev-account', 'dev-banner', 'devpassword']) expect(text, `preview export lacks ${marker}`).toContain(marker)
  for (const marker of ['seedAccount', 'seedLegacy']) expect(text, `preview export holds the e2e hook ${marker}`).not.toContain(marker)
})
