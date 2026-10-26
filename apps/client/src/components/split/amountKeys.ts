/*
 * Key handling for the amount keypad (F-310), after Expensify App's
 * BigNumberPad / NumberWithSymbolForm (MIT): a key is inserted at the
 * selection, "<" deletes before the caret (or the selected range), and a key
 * that would make the number invalid - a second decimal mark, more decimals
 * than the currency has - is dropped, so the field never holds a value the
 * pad could not have produced. Behaviour re-implemented, no source copied.
 * Operators are Splito's (the amount field is also a calculator).
 */

/** Every key the keypad has. */
export type AmountKey =
  | '0'
  | '1'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | '000'
  | 'mark'
  | '+'
  | '−'
  | '×'
  | '÷'
  | 'delete'

export type Selection = {start: number; end: number}

const OPERATOR = /[+\-−×÷*/xX]/
/** An operator with the spaces the keypad puts around it, at the end of a string. */
const TRAILING_OPERATOR = /\s*[+\-−×÷*/xX]\s*$/

function isOperatorAt(text: string, i: number) {
  // A leading minus is a sign, not an operator.
  return i > 0 && OPERATOR.test(text[i]!)
}

/** Where the number around `at` starts and ends (between operators). */
function operandBounds(text: string, at: number) {
  let start = at
  while (start > 0 && !isOperatorAt(text, start - 1)) start--
  let end = at
  while (end < text.length && !isOperatorAt(text, end)) end++
  return {start, end}
}

/**
 * The text and caret after one keypad key, or null when the key is refused.
 * `mark` is the locale's decimal mark, `scale` the currency's decimals.
 */
export function applyAmountKey(
  text: string,
  selection: Selection,
  key: AmountKey,
  {scale, mark}: {scale: number; mark: '.' | ','},
): {text: string; caret: number} | null {
  const start = Math.min(selection.start, selection.end, text.length)
  const end = Math.min(Math.max(selection.start, selection.end), text.length)
  const before = text.slice(0, start)
  const after = text.slice(end)

  if (key === 'delete') {
    if (start !== end) return {text: before + after, caret: start}
    if (start === 0) return null
    const op = TRAILING_OPERATOR.exec(before)
    const cut = op && op.index > 0 ? op.index : start - 1
    return {text: text.slice(0, cut) + after, caret: cut}
  }

  if (key === '+' || key === '−' || key === '×' || key === '÷') {
    const head = before.replace(TRAILING_OPERATOR, '')
    if (!/\d/.test(head)) return null
    const inserted = ` ${key} `
    const tail = after.replace(/^\s*[+\-−×÷*/xX]?\s*/, '')
    return {text: head + inserted + tail, caret: head.length + inserted.length}
  }

  // A digit, "000" or the decimal mark: judged against the number it lands in.
  const bounds = operandBounds(text, start)
  const operand = text.slice(bounds.start, bounds.end)
  const operandBefore = text.slice(bounds.start, start)
  const markAt = operand.indexOf(mark)

  if (key === 'mark') {
    if (scale === 0 || markAt >= 0) return null
    const inserted = /\d$/.test(operandBefore) ? mark : `0${mark}`
    return {text: before + inserted + after, caret: start + inserted.length}
  }

  if (key === '000' && !/[1-9]/.test(operandBefore)) return null
  if (markAt >= 0 && start > bounds.start + markAt) {
    const decimals = operand.slice(markAt + 1).replace(/\D/g, '').length
    if (decimals + key.length > scale) return null
  }
  return {text: before + key + after, caret: start + key.length}
}
