import {join} from 'node:path'

import {expect, test} from '@playwright/test'

import {readFiles, WDYR_MARKERS} from '../e2e/bundleScan'

/*
 * F-242 acc 1: the PRODUCTION web build (`build-web`'s export, built by this
 * config) carries none of why-did-you-render or its report store, and no
 * @welldone-software package reaches a shipped file. `e2e/bundle.spec.ts` checks
 * the e2e export the same way.
 */
test('the production build holds no why-did-you-render', () => {
  const files = readFiles(join(__dirname, '..', 'dist-pwa'), /\.(js|html|json)$/)
  expect(files.length).toBeGreaterThan(0)
  for (const {file, text} of files) for (const marker of WDYR_MARKERS) expect(text, `${file} contains ${marker}`).not.toContain(marker)
})

/*
 * F-250: the PREVIEW export (what Render serves for review; a production build is refused) carries the dev sign-in the review
 * needs and none of the e2e-only hooks. `e2e/authConfig.spec.ts` checks that production refuses to build at all.
 */
test('the preview build has the dev sign-in and no e2e hooks', () => {
  const text = readFiles(join(__dirname, '..', 'dist-pwa'), /\.js$/).map(f => f.text).join('\n')
  for (const marker of ['continue-dev-account', 'dev-banner', 'devpassword']) expect(text, `preview export lacks ${marker}`).toContain(marker)
  for (const marker of ['seedAccount', 'seedLegacy']) expect(text, `preview export holds the e2e hook ${marker}`).not.toContain(marker)
})
