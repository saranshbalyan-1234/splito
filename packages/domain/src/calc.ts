import {type CurrencyCode, getCurrency, parseAmount} from './currency'
import {assertInRange, DomainError} from './errors'

/** Calculator operators as people type them: x, ×, * multiply; /, ÷ divide; -, − subtract. */
const OPS: Record<string, '+' | '-' | '*' | '/'> = {
  '+': '+',
  '-': '-',
  '−': '-',
  x: '*',
  X: '*',
  '×': '*',
  '*': '*',
  '/': '/',
  '÷': '/',
}
const TOKEN = /(\d[\d.,]*)|([+\-−xX×*/÷])/y

/** Spaces (also the no-break ones fr-FR groups with) and apostrophes (de-CH) only ever group digits. */
const normalize = (input: string) => input.replace(/[\s\u00a0\u202f'’]/g, '')

/** The decimal mark a locale writes: "," in de-DE and fr-FR, "." in en-IN and hi-IN. */
export function decimalMark(locale: string): '.' | ',' {
  const mark = new Intl.NumberFormat(locale)
    .formatToParts(1.5)
    .find(p => p.type === 'decimal')?.value
  return mark === ',' ? ',' : '.'
}

/**
 * One typed number to a plain decimal ("1.234,5" -> "1234.5"). The last "."
 * or "," is the decimal mark when it is the locale's own mark, or when the
 * digits after it fit the currency's scale and aren't three - so "1,200" is
 * 1200 and "12,50" is 12.50 whichever mark a decimal pad shows. Every other
 * mark groups digits.
 */
function plainNumber(num: string, scale: number, mark: '.' | ','): string {
  const last = Math.max(num.lastIndexOf('.'), num.lastIndexOf(','))
  if (last < 0) return num
  const tail = num.slice(last + 1)
  const isDecimal =
    tail.length > 0 &&
    (num[last] === mark || (tail.length <= scale && tail.length !== 3))
  const whole = (isDecimal ? num.slice(0, last) : num).replace(/[.,]/g, '')
  return isDecimal ? `${whole || '0'}.${tail}` : whole
}

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
 * `parseAmount`, so it is never silently rounded. `mark` is the number
 * locale's decimal mark (`decimalMark`); grouping marks are dropped.
 */
export function evaluateAmount(
  input: string,
  code: CurrencyCode,
  mark: '.' | ',' = '.',
): bigint {
  const s = normalize(input)
  const {scale} = getCurrency(code)
  if (!isExpression(s)) {
    const m = /^([-−]?)([\d.,]*\d[\d.,]*)$/.exec(s)
    if (!m) throw new DomainError('INVALID_AMOUNT')
    return parseAmount(`${m[1] ? '-' : ''}${plainNumber(m[2]!, scale, mark)}`, code)
  }

  const tokens: string[] = []
  TOKEN.lastIndex = 0
  while (TOKEN.lastIndex < s.length) {
    const m = TOKEN.exec(s)
    if (!m) throw new DomainError('INVALID_AMOUNT')
    tokens.push(m[1] ? plainNumber(m[1], scale, mark) : m[0])
  }
  // Must alternate number, operator, number ...
  tokens.forEach((tok, i) => {
    if ((i % 2 === 0) !== /^\d/.test(tok))
      throw new DomainError('INVALID_AMOUNT')
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
      total = {
        n: total.n * term.d + sign * term.n * total.d,
        d: total.d * term.d,
      }
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

/** One total per currency; currencies are never added together. */
export function sumByCurrency(xs: Iterable<{currency: string; amount: bigint}>): Record<string, bigint> {
  const out: Record<string, bigint> = {}
  for (const {currency, amount} of xs) out[currency] = (out[currency] ?? 0n) + amount
  return out
}

/** What is still unassigned of `total` after `parts` (negative when over-assigned). */
export function remainingMinor(total: bigint, parts: Iterable<bigint>): bigint {
  return total - sumMinor(parts)
}
