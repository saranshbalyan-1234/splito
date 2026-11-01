import {beforeEach, expect, test} from 'bun:test'
import {readFileSync} from 'node:fs'
import {join} from 'node:path'

import {
  OVERLAY_ROUTES,
  isBrowserSwipe,
  noteTouchEnd,
  noteTouchMove,
  noteTouchStart,
  resetStackSlide,
  snapshotOf,
  stackMotion,
  takeStackSlide,
} from './stackSlide'

type R = {key: string; name: string}
const r = (key: string, name = 'Person'): R => ({key, name})
const state = (routes: R[], index = routes.length - 1) =>
  ({routes, index}) as never

beforeEach(() => resetStackSlide())

test('a new page on top of the one it was opened from is a push; going back down is a pop', () => {
  const a = snapshotOf(state([r('people', 'People')]))
  const b = snapshotOf(state([r('people', 'People'), r('profile', 'Profile')]))
  expect(stackMotion(a, b)).toBe('push')
  expect(stackMotion(b, a)).toBe('pop')
  // Two pages back at once (navigate down the stack) is still a Back.
  const c = snapshotOf(
    state([
      r('people', 'People'),
      r('profile', 'Profile'),
      r('s', 'SettingsSection'),
    ]),
  )
  expect(stackMotion(c, a)).toBe('pop')
})

test('a reset, a replace, the first load and the same page are not stack moves', () => {
  const a = snapshotOf(state([r('people', 'People'), r('p1')]))
  expect(stackMotion(undefined, a)).toBeUndefined()
  expect(stackMotion(a, a)).toBeUndefined()
  // Replace: the page on top changed, the one below it did not grow a page.
  expect(
    stackMotion(a, snapshotOf(state([r('people', 'People'), r('p2')]))),
  ).toBeUndefined()
  // A reset to a new chain (a refresh's recorded state missing).
  expect(stackMotion(a, snapshotOf(state([r('x', 'Groups')])))).toBeUndefined()
})

test('overlays (composers, sheet markers) are neither side of a slide', () => {
  const page = snapshotOf(state([r('people', 'People')]))
  // A composer on top: no snapshot, so the page's own state stays the reference.
  expect(
    snapshotOf(state([r('people', 'People'), r('c', 'AddExpense')])),
  ).toBeUndefined()
  // A push made from a page with a sheet marker over it counts from the page.
  const pushed = snapshotOf(
    state([r('people', 'People'), r('m', 'Sheet'), r('p1')]),
  )
  expect(pushed).toEqual({keys: ['people', 'p1'], index: 1})
  expect(stackMotion(page, pushed)).toBe('push')
})

test('a tab press, a wide window and a browser swipe play no stack slide, but the state is still recorded', () => {
  const a = state([r('people', 'People')])
  const b = state([r('people', 'People'), r('profile', 'Profile')])
  expect(
    takeStackSlide({state: a, isTabSwitch: false, isPhoneWidth: true}),
  ).toBeUndefined()
  expect(
    takeStackSlide({state: b, isTabSwitch: true, isPhoneWidth: true}),
  ).toBeUndefined()
  expect(
    takeStackSlide({state: a, isTabSwitch: false, isPhoneWidth: false}),
  ).toBeUndefined()
  expect(
    takeStackSlide({state: b, isTabSwitch: false, isPhoneWidth: true}),
  ).toBe('push')
  expect(
    takeStackSlide({state: a, isTabSwitch: false, isPhoneWidth: true}),
  ).toBe('pop')
})

test('a touch from the left edge that moves right, or that the browser cancels, marks a browser swipe', () => {
  noteTouchStart(8, 390)
  noteTouchMove(60)
  expect(isBrowserSwipe(1000)).toBe(true)
  noteTouchEnd(false, 1000)
  expect(isBrowserSwipe(1600)).toBe(true)
  expect(isBrowserSwipe(1800)).toBe(false)

  noteTouchStart(10, 390)
  noteTouchEnd(true, 5000)
  expect(isBrowserSwipe(6500)).toBe(true)

  // Safari's right-edge Forward swipe too.
  noteTouchStart(385, 390)
  noteTouchMove(300)
  expect(isBrowserSwipe()).toBe(true)
})

test('a tap near the edge (the header avatar, Back) keeps its slide; so does a touch away from the edges', () => {
  noteTouchStart(20, 390)
  noteTouchMove(24)
  noteTouchEnd(false, 1000)
  expect(isBrowserSwipe(1100)).toBe(false)
  noteTouchStart(200, 390)
  noteTouchMove(300)
  expect(isBrowserSwipe()).toBe(false)
  // Two fingers are a pinch, not a swipe.
  noteTouchStart(5, 390, 2)
  noteTouchMove(80)
  expect(isBrowserSwipe()).toBe(false)
})

test('a pop during a browser swipe is not animated', () => {
  const a = state([r('people', 'People')])
  const b = state([r('people', 'People'), r('profile', 'Profile')])
  takeStackSlide({state: a, isTabSwitch: false, isPhoneWidth: true})
  takeStackSlide({state: b, isTabSwitch: false, isPhoneWidth: true})
  noteTouchStart(4, 390)
  noteTouchEnd(true, 1000)
  expect(
    takeStackSlide({
      state: a,
      isTabSwitch: false,
      isPhoneWidth: true,
      now: 1300,
    }),
  ).toBeUndefined()
})

test('the overlay list is every web route drawn over its page (COMPOSER_WEB in Navigation.tsx)', () => {
  const src = readFileSync(
    join(import.meta.dir, '../../navigation/Navigation.tsx'),
    'utf8',
  )
  const flat = src.slice(src.indexOf('export function FlatNavigator'))
  const overlays = flat
    .split('<Flat.Screen')
    .slice(1)
    .filter(block =>
      block.slice(0, block.indexOf('/>')).includes('COMPOSER_WEB'),
    )
    .map(block => /name="(\w+)"/.exec(block)![1])
  expect(new Set(overlays)).toEqual(new Set(OVERLAY_ROUTES))
})
