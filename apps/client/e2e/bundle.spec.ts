import {join} from 'node:path'

import {expect, test} from '@playwright/test'

import {readFiles, WDYR_MARKERS} from './bundleScan'

/*
 * F-242 acc 1: the exported (production-mode) bundle, the one every timing run
 * uses, carries none of why-did-you-render (ARCHITECTURE 17). It loads only
 * from the dev entry, `if (__DEV__) require(...)`, which Metro folds away.
 */
test('the exported bundle holds no why-did-you-render', () => {
  const files = readFiles(join(__dirname, '..', 'dist', '_expo', 'static', 'js', 'web'), /\.js$/)
  expect(files.length).toBeGreaterThan(0)
  for (const {file, text} of files) for (const marker of WDYR_MARKERS) expect(text, `${file} contains ${marker}`).not.toContain(marker)
})
