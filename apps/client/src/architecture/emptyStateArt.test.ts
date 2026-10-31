/// <reference types="bun" />
import {expect, test} from 'bun:test'
import {existsSync, readFileSync} from 'node:fs'
import {join} from 'node:path'

import {ILLUSTRATIONS} from '#/motion/illustrations'
import {REPO_ROOT, sourceFiles} from './scan'

/*
 * F-260 (owners 146, 172): every empty state is the one `EmptyState`, with original art about its own screen.
 * The prop is required by the type; this reads the source so a call site that dodges the type (a cast, an
 * `any` spread) or a piece of art nobody uses still fails.
 */

const CLIENT = join(REPO_ROOT, 'apps/client')

/** Every `<EmptyState ...>` opening tag in the client, as source text (braces balanced, so `=>` inside a prop is fine). */
function emptyStateTags() {
  const tags: {file: string; tag: string}[] = []
  for (const file of sourceFiles()) {
    if (!file.startsWith('apps/client/src/') || file.endsWith('view/com/util/EmptyState.tsx')) continue
    const src = readFileSync(join(REPO_ROOT, file), 'utf8')
    for (const m of src.matchAll(/<EmptyState\b/g)) {
      let depth = 0
      let i = m.index! + m[0].length
      for (; i < src.length; i++) {
        const ch = src[i]
        if (ch === '{') depth++
        else if (ch === '}') depth--
        else if (ch === '>' && depth === 0 && src[i - 1] !== '=') break
      }
      tags.push({file, tag: src.slice(m.index!, i + 1)})
    }
  }
  return tags
}

test('every EmptyState call site names its illustration', () => {
  const tags = emptyStateTags()
  expect(tags.length).toBeGreaterThan(15)
  const missing = tags.filter(({tag}) => !/\billustration=/.test(tag)).map(t => t.file)
  expect(missing).toEqual([])
})

test('no other component draws its own empty state (the Ask empty state used to)', () => {
  const own = sourceFiles()
    .filter(f => f.startsWith('apps/client/src/') && !f.endsWith('view/com/util/EmptyState.tsx'))
    .filter(f => /function EmptyState\b/.test(readFileSync(join(REPO_ROOT, f), 'utf8')))
  expect(own).toEqual([])
})

test('every illustration has a light and a dark file, 240 x 240, and a resting frame inside it', () => {
  for (const [name, art] of Object.entries(ILLUSTRATIONS)) {
    for (const file of [`${name}.json`, `${name}-dark.json`]) {
      const path = join(CLIENT, 'assets/lottie', file)
      expect(existsSync(path)).toBe(true)
      const json = JSON.parse(readFileSync(path, 'utf8')) as {w: number; h: number; op: number}
      expect([json.w, json.h, json.op]).toEqual([240, 240, art.frames])
    }
    expect(art.staticFrame).toBeGreaterThanOrEqual(0)
    expect(art.staticFrame).toBeLessThan(art.frames)
  }
})

test('every empty-* illustration is used by a screen, and every name used exists', () => {
  const used = new Set<string>()
  for (const file of sourceFiles()) {
    if (!file.startsWith('apps/client/src/')) continue
    const src = readFileSync(join(REPO_ROOT, file), 'utf8')
    for (const m of src.matchAll(/['"](empty-[a-z-]+)['"]/g)) used.add(m[1]!)
  }
  const names = Object.keys(ILLUSTRATIONS)
  expect(names.filter(n => n.startsWith('empty-') && !used.has(n))).toEqual([])
  expect([...used].filter(n => !names.includes(n))).toEqual([])
})

test('no illustration JSON is imported statically (it would land in the start-up bundle)', () => {
  const eager = sourceFiles()
    .filter(f => f.startsWith('apps/client/src/'))
    .filter(f => /(?:^|\n)\s*(?:import\b[^\n]*|const\b[^\n]*require\()['"][^'"]*assets\/lottie\//.test(readFileSync(join(REPO_ROOT, f), 'utf8')))
  expect(eager).toEqual([])
})
