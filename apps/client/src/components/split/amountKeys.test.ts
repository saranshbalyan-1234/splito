import {describe, expect, test} from 'bun:test'

import {type AmountKey, applyAmountKey} from './amountKeys'

const INR = {scale: 2, mark: '.' as const}
/** Types keys one after another at the caret, from an empty field. */
function type(
  keys: AmountKey[],
  opts: {scale: number; mark: '.' | ','} = INR,
  start = '',
) {
  let text = start
  let caret = start.length
  for (const k of keys) {
    const r = applyAmountKey(text, {start: caret, end: caret}, k, opts)
    if (r) ({text, caret} = r)
  }
  return text
}

describe('amount keypad (Expensify BigNumberPad behaviour)', () => {
  test('digits, 000 and the decimal mark', () => {
    expect(type(['1', '2', '000'])).toBe('12000')
    expect(type(['1', 'mark', '5'])).toBe('1.5')
    expect(type(['mark', '5'])).toBe('0.5')
  })
  test('the locale decimal mark, once per number', () => {
    expect(type(['1', 'mark', '5'], {scale: 2, mark: ','})).toBe('1,5')
    expect(type(['1', 'mark', '5', 'mark', '0'])).toBe('1.50')
  })
  test('no more decimals than the currency has', () => {
    expect(type(['9', 'mark', '9', '9', '9'])).toBe('9.99')
    expect(type(['9', 'mark', '000'])).toBe('9.')
    expect(type(['5', 'mark'], {scale: 0, mark: '.'})).toBe('5')
    expect(type(['5', 'mark', '1', '2', '3', '4'], {scale: 3, mark: '.'})).toBe(
      '5.123',
    )
  })
  test('000 needs a number in front', () => {
    expect(type(['000'])).toBe('')
    expect(type(['0', '000'])).toBe('0')
  })
  test('operators make a sum; a second operator replaces the first', () => {
    expect(type(['1', '2', '0', '0', '+', '3', '0', '0'])).toBe('1200 + 300')
    expect(type(['5', '+', '×', '2'])).toBe('5 × 2')
    expect(type(['+'])).toBe('')
  })
  test('each number in a sum has its own decimal mark', () =>
    expect(type(['1', 'mark', '5', '+', '2', 'mark', '5'])).toBe('1.5 + 2.5'))
  test('delete removes a digit, or a whole operator with its spaces', () => {
    expect(type(['1', '2', 'delete'])).toBe('1')
    expect(type(['1', '+', 'delete'])).toBe('1')
    expect(type(['delete'])).toBe('')
  })
  test('keys go in at the caret and replace a selection', () => {
    expect(applyAmountKey('1200', {start: 1, end: 1}, '5', INR)).toEqual({
      text: '15200',
      caret: 2,
    })
    expect(applyAmountKey('1200', {start: 0, end: 4}, '9', INR)).toEqual({
      text: '9',
      caret: 1,
    })
    expect(applyAmountKey('1200', {start: 1, end: 3}, 'delete', INR)).toEqual({
      text: '10',
      caret: 1,
    })
  })
})
