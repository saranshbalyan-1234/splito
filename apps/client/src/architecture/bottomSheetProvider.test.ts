import {expect, test} from 'bun:test'
import {readFileSync} from 'node:fs'
import {join} from 'node:path'

/*
 * A native sheet reads its portal from `BottomSheetProvider`; with none the context default `{}` reaches React as
 * an element type and crashes ("Element type is invalid ... BottomSheetNativeComponent", Remind me, 2026-10-29).
 * RemindHost mounts above the Shell, outside the Shell's provider, so App.tsx must give it its own.
 */
test('RemindHost (sheets mounted above the Shell) sits inside a BottomSheetProvider with an outlet', () => {
  const app = readFileSync(join(import.meta.dir, '../App.tsx'), 'utf8')
  const wrapped = /<BottomSheetProvider>[\s\S]*<RemindHost \/>[\s\S]*<BottomSheetOutlet \/>[\s\S]*<\/BottomSheetProvider>/
  expect(app).toMatch(wrapped)
})

test('the native sheet refuses a missing provider with a clear error, not a React type crash', () => {
  const src = readFileSync(join(import.meta.dir, '../../modules/bottom-sheet/src/BottomSheetNativeComponent.tsx'), 'utf8')
  expect(src).toContain('!isComponentType(Portal)')
  expect(src).toContain('You need to wrap your component tree with a <BottomSheetPortalProvider>')
})
