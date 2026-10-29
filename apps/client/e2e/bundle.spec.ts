import {readdirSync, readFileSync} from 'node:fs'
import {join} from 'node:path'

import {expect, test} from '@playwright/test'

/*
 * F-242 acc 1: the exported (production-mode) bundle, the one every timing run
 * uses, carries none of why-did-you-render (ARCHITECTURE 17). It loads only
 * from the dev entry, `if (__DEV__) require(...)`, which Metro folds away.
 */
test('the exported bundle holds no why-did-you-render', () => {
  const dir = join(__dirname, '..', 'dist', '_expo', 'static', 'js', 'web')
  const files = readdirSync(dir).filter(f => f.endsWith('.js'))
  expect(files.length).toBeGreaterThan(0)
  for (const f of files) {
    const js = readFileSync(join(dir, f), 'utf8')
    expect(js, f).not.toContain('wdyrStore')
    expect(js, f).not.toContain('__wdyr')
    expect(js, f).not.toContain('whyDidYouRender')
  }
})
