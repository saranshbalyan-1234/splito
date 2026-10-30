import {expect, test} from 'bun:test'
import {DEFAULT_CATEGORIES} from '@splito/sync'

import {findCategory, hasStockName, nameCategory} from './categoryLookup'

test('a known id is itself, hidden or not', () => {
  const food = DEFAULT_CATEGORIES.find(c => c.id === 'food')!
  expect(findCategory(DEFAULT_CATEGORIES, 'food')).toBe(food)
})

test('a gone id is the real Other, never a raw id or an empty name', () => {
  const other = DEFAULT_CATEGORIES.find(c => c.id === 'other')!
  expect(findCategory(DEFAULT_CATEGORIES, 'deleted-long-ago')).toBe(other)
  expect(findCategory(DEFAULT_CATEGORIES, '')).toBe(other)
})

test('with no Other in the list the stock one answers', () => {
  const noOther = DEFAULT_CATEGORIES.filter(c => c.id !== 'other')
  expect(findCategory(noOther, 'x').id).toBe('other')
})

test('only a built-in with its stock name follows the language', () => {
  const food = DEFAULT_CATEGORIES.find(c => c.id === 'food')!
  expect(hasStockName(food)).toBe(true)
  expect(hasStockName({...food, name: 'Dining out'})).toBe(false)
  expect(hasStockName({id: 'custom-1', name: food.name})).toBe(false)
})

test('the same category, id and name are the same object, so memoised children stay still', () => {
  const food = DEFAULT_CATEGORIES.find(c => c.id === 'food')!
  expect(nameCategory(food, 'food', 'Food')).toBe(nameCategory(food, 'food', 'Food'))
  expect(nameCategory(food, 'food', 'Food')).not.toBe(nameCategory(food, 'food', 'भोजन'))
  expect(nameCategory(food, 'food', 'भोजन')).toMatchObject({id: 'food', name: 'भोजन', color: food.color})
  expect(nameCategory(food, 'gone', 'Other').id).toBe('gone')
})
