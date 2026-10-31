import {expect, test} from 'bun:test'
import {readdirSync, readFileSync, statSync} from 'node:fs'
import {join} from 'node:path'

/**
 * Pull to refresh is built once in `List` and `Layout.Content` (owners 167, 169, 170), so a full screen gets it by
 * scrolling with one of them. This lists every screen file that opens a `Layout.Screen` and fails on one that scrolls
 * with neither, which would be a full screen that cannot be pulled.
 */
const SCREENS = join(import.meta.dir, '../../screens')
/** A screen that only redirects scrolls nothing. */
const NO_SCROLL = new Set(['Search/index.tsx'])

function files(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? files(path) : /\.tsx$/.test(name) ? [path] : []
  })
}

test('every full screen scrolls with List or Layout.Content', () => {
  const missing = files(SCREENS)
    .filter(path => /Layout\.Screen|<TabScreen/.test(readFileSync(path, 'utf8')))
    .filter(path => !/util\/List'|Layout\.Content/.test(readFileSync(path, 'utf8')))
    .map(path => path.slice(SCREENS.length + 1))
    .filter(path => !NO_SCROLL.has(path))
  expect(missing).toEqual([])
})
