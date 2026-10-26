import {type CurrencyCode, getCurrency, parseAmount} from './currency'
import {assertInRange, DomainError} from './errors'

/** Calculator operators as people type them: x, ×, * multiply; /, ÷ divide; -, − subtract. */
const OPS: Record<string, '+' | '-' | '*' | '/'> = {'+': '+', '-': '-', '−': '-', x: '*', X: '*', '×': '*', '*': '*', '/': '/', '÷': '/'}
const TOKEN = /(\d+(?:\.\d+)?)|([+\-−xX×*/÷])/y

/** Grouping commas and spaces carry no meaning in an amount ("1,20,000"). */
const normalize = (input: string) => input.replace(/[\s,]/g, '')

/** True when the input has an operator, i.e. the amount field should show a computed result. */
export function isExpression(input: string): boolean {
  return /\d\s*[+\-−xX×*/÷]/.test(input)
}

type Ratio = {n: bigint; d: bigint}

function toRatio(num: string): Ratio {
  const [whole, frac = ''] = num.split('.')
  return {n: BigInt(whole! + frac), d: 10n ** BigInt(frac.length)}
}

/**
 * Evaluates the amount field's inline calculator ("1200+300", "250 x 3",
 * "100/3") into minor units, exactly: operands are rationals, `x` and `/` bind
 * tighter than `+` and `-`, and only the final result is rounded (half away
 * from zero) to the currency's minor unit. A plain number goes through
 * `parseAmount`, so it is never silently rounded.
 */
export function evaluateAmount(input: string, code: CurrencyCode): bigint {
  const s = normalize(input)
  if (!isExpression(s)) return parseAmount(s, code)
  const {scale} = getCurrency(code)

  const tokens: string[] = []
  TOKEN.lastIndex = 0
  while (TOKEN.lastIndex < s.length) {
    const m = TOKEN.exec(s)
    if (!m) throw new DomainError('INVALID_AMOUNT')
    tokens.push(m[0])
  }
  // Must alternate number, operator, number ...
  tokens.forEach((tok, i) => {
    if ((i % 2 === 0) !== /^\d/.test(tok)) throw new DomainError('INVALID_AMOUNT')
  })
  if (tokens.length % 2 === 0) throw new DomainError('INCOMPLETE')

  let total: Ratio = {n: 0n, d: 1n}
  let sign = 1n
  let term = toRatio(tokens[0]!)
  for (let i = 1; i < tokens.length; i += 2) {
    const op = OPS[tokens[i]!]!
    const next = toRatio(tokens[i + 1]!)
    if (op === '*') term = {n: term.n * next.n, d: term.d * next.d}
    else if (op === '/') {
      if (next.n === 0n) throw new DomainError('DIVIDE_BY_ZERO')
      term = {n: term.n * next.d, d: term.d * next.n}
    } else {
      total = {n: total.n * term.d + sign * term.n * total.d, d: total.d * term.d}
      sign = op === '+' ? 1n : -1n
      term = next
    }
  }
  total = {n: total.n * term.d + sign * term.n * total.d, d: total.d * term.d}

  const scaled = (total.n < 0n ? -total.n : total.n) * 10n ** BigInt(scale)
  const rounded = (2n * scaled + total.d) / (2n * total.d)
  return assertInRange(total.n < 0n ? -rounded : rounded)
}

/** Percent text ("33.33") to integer basis points (3333); empty is 0. Two decimals at most, 0 to 100. */
export function parseBasisPoints(input: string): number {
  const s = input.trim()
  if (!s) return 0
  const m = /^(\d{1,3})(?:\.(\d{1,2}))?$/.exec(s)
  if (!m) throw new DomainError('INVALID_PERCENT')
  const bp = Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0'))
  if (bp > 10000) throw new DomainError('INVALID_PERCENT')
  return bp
}

export function sumMinor(xs: Iterable<bigint>): bigint {
  let s = 0n
  for (const x of xs) s += x
  return s
}

/** Each person's net position on one expense: what they paid minus their share (> 0: they are owed). */
export function expenseNet(e: {payers: Record<string, bigint>; shares: Record<string, bigint>}): Record<string, bigint> {
  const net: Record<string, bigint> = {}
  for (const [id, v] of Object.entries(e.payers)) net[id] = (net[id] ?? 0n) + v
  for (const [id, v] of Object.entries(e.shares)) net[id] = (net[id] ?? 0n) - v
  return net
}

/** What is still unassigned of `total` after `parts` (negative when over-assigned). */
export function remainingMinor(total: bigint, parts: Iterable<bigint>): bigint {
  return total - sumMinor(parts)
}
