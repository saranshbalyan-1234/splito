import {describe, expect, test} from 'bun:test'

import {capitalizeName} from '../src/name'

describe('capitalizeName', () => {
  test.each([
    ['saransh balyan', 'Saransh Balyan'],
    ['  saransh   balyan \n', 'Saransh Balyan'],
    ['McDonald', 'McDonald'],
    ['mcDonald o', 'McDonald O'],
    ["d'souza", "D'souza"],
    ["D'Souza", "D'Souza"],
    ['anne-marie', 'Anne-Marie'],
    ['Anne-marie smith', 'Anne-Marie Smith'],
    ['élise', 'Élise'],
    ['𐐨𐐯 x', '𐐀𐐯 X'], // Deseret: the first code point is a surrogate pair
    ['सारांश शर्मा', 'सारांश शर्मा'],
    ['', ''],
    ['   ', ''],
  ])('%j -> %j', (input, want) => {
    expect(capitalizeName(input)).toBe(want)
  })

  test('is idempotent', () => {
    expect(capitalizeName(capitalizeName('o neil-smith'))).toBe('O Neil-Smith')
  })
})
