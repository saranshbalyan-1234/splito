import {expect, test} from 'bun:test'

import {decode, encode} from '../src/codec'

test('bigint round-trip, nested', () =>
  expect(decode(encode({a: 10n ** 15n, b: [1n, -2n], c: 'x', d: null}))).toEqual({a: 10n ** 15n, b: [1n, -2n], c: 'x', d: null}))
test('plain numbers stay plain JSON', () => expect(encode({n: 1.5})).toBe('{"n":1.5}'))
test('object that merely looks like a tag with extra keys is left alone', () =>
  expect(decode('{"$bigint":"1","x":2}')).toEqual({$bigint: '1', x: 2}))
