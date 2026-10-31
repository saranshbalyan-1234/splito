import {expect, test} from 'bun:test'

import {noteTabSlide, slideDirection, takeTabSlide} from './tabSlide'

const ORDER = ['People', 'Groups', 'Analytics', 'Activity', 'Settings']

test('a tab to the right comes in from the right, one to the left from the left, along the bar order', () => {
  expect(slideDirection(ORDER, 'People', 'Analytics')).toBe('r')
  expect(slideDirection(ORDER, 'Activity', 'Groups')).toBe('l')
  expect(slideDirection(ORDER, 'Groups', 'Groups')).toBeUndefined()
  // From a page that is not in the bar (Settings section, a person): no slide.
  expect(slideDirection(ORDER, undefined, 'Groups')).toBeUndefined()
  expect(slideDirection(['Groups', 'People'], 'People', 'Groups')).toBe('l')
})

test('the next screen to focus takes the slide once; a stale note is dropped', () => {
  noteTabSlide('r', 1000)
  expect(takeTabSlide(1100)).toBe('r')
  expect(takeTabSlide(1100)).toBeUndefined()
  noteTabSlide('l', 1000)
  expect(takeTabSlide(2000)).toBeUndefined()
})
