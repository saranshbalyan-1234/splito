import {expect, test} from 'bun:test'

import {amountSize, overviewColumns} from './overviewGrid'

test('columns follow the balanced rule, capped by what the width fits', () => {
  const wide = 1000
  expect([1, 2, 3, 4, 5, 6, 7, 9].map(n => overviewColumns(wide, n))).toEqual([1, 2, 3, 2, 3, 3, 3, 3])
  expect([1, 2, 3, 4, 6].map(n => overviewColumns(358, n))).toEqual([1, 1, 1, 1, 1]) // 390 px phone
  expect([1, 2, 3, 4, 6].map(n => overviewColumns(568, n))).toEqual([1, 2, 2, 2, 2]) // 600 px
  expect(overviewColumns(0, 3)).toBe(1)
})

test('amounts shrink to text_lg, then stay there', () => {
  expect(amountSize('₹1.00', 200)).toBe('text_3xl')
  expect(amountSize('₹3,07,786.00', 150)).toBe('text_xl')
  expect(amountSize('₹3,07,786,000,000.00', 100)).toBe('text_lg')
})
