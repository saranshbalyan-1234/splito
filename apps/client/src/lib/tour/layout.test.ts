import {expect, test} from 'bun:test'

import {cardWidth, GUTTER, holePath, placeCard, spotlightOf} from './layout'

const phone = {width: 390, height: 844}
const desktop = {width: 1440, height: 900}
const card = {width: 320, height: 160}

test('the cut-out grows by the padding; round shapes follow their own size, rows get a fixed corner', () => {
  const fab = spotlightOf({x: 310, y: 700, width: 56, height: 56}, 'round')
  expect(fab.rect).toEqual({x: 304, y: 694, width: 68, height: 68})
  expect(fab.radius).toBe(34)
  expect(spotlightOf({x: 0, y: 100, width: 390, height: 72}, 'rect').radius).toBe(14)
})

test('the FAB in the lower right: the card goes above and stays inside the gutters', () => {
  const {rect} = spotlightOf({x: 310, y: 700, width: 56, height: 56}, 'round')
  const place = placeCard(rect, phone, card)
  expect(place.placement).toBe('above')
  expect(place.x).toBeGreaterThanOrEqual(GUTTER)
  expect(place.x + card.width).toBeLessThanOrEqual(phone.width - GUTTER)
  expect(place.y + card.height).toBeLessThanOrEqual(rect.y)
})

test('a row near the top: the card goes below it', () => {
  const place = placeCard({x: 0, y: 140, width: 390, height: 70}, phone, card)
  expect(place.placement).toBe('below')
  expect(place.y).toBe(140 + 70 + 12)
})

test('the sidebar pill on desktop: the card sits beside it, on its right', () => {
  const place = placeCard({x: 20, y: 400, width: 180, height: 56}, desktop, card)
  expect(place.placement).toBe('right')
  expect(place.x).toBe(20 + 180 + 12)
})

test('the card is as wide as 340 allows and never wider than a 320 px phone less its gutters', () => {
  expect(cardWidth(1440)).toBe(340)
  expect(cardWidth(320)).toBe(288)
})

test('the hole path has the screen as its outer contour and the cut-out as its inner one', () => {
  const spot = spotlightOf({x: 100, y: 200, width: 50, height: 50}, 'round')
  const d = holePath({width: 390, height: 844}, spot)
  expect(d.startsWith('M0 0H390V844H0Z')).toBe(true)
  expect(d.match(/Z/g)?.length).toBe(2)
  expect(d).toContain('A31 31 0 0 1')
})

test('with no side that fits, the roomiest is used and the card is clamped on screen', () => {
  const tiny = {width: 300, height: 300}
  const place = placeCard({x: 10, y: 10, width: 280, height: 280}, tiny, {width: 280, height: 200})
  expect(place.x).toBeGreaterThanOrEqual(GUTTER)
  expect(place.y).toBeGreaterThanOrEqual(GUTTER)
})
