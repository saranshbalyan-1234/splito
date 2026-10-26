import {CURRENCIES, type CurrencyCode, getCurrency, parseAmount} from './currency'
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

/** Indian and Western shorthand: 2k, 1.5L / lakh / lac, 1.2cr / crore, 2.5m / mn. Longest spellings first. */
const SUFFIX = 'lakhs|lakh|lacs|lac|crores|crore|cr|mn|k|l|m'
const MULTIPLIER: Record<string, bigint> = {k: 1000n, l: 100000n, lac: 100000n, lacs: 100000n, lakh: 100000n, lakhs: 100000n, cr: 10000000n, crore: 10000000n, crores: 10000000n, m: 1000000n, mn: 1000000n}
const TOKEN = new RegExp(`(\\d[\\d.,]*)(${SUFFIX})?|([+\\-−xX×*/÷])`, 'iy')
const EXPRESSION = new RegExp(`\\d\\s*(?:(?:${SUFFIX})\\s*)?[+\\-−xX×*/÷]`, 'i')
const PLAIN = new RegExp(`^([-−]?)([\\d.,]*\\d[\\d.,]*)(${SUFFIX})?$`, 'i')

/** Options for reading typed amounts (`evaluateAmount`). */
export type AmountOptions = {
  /** Read 2k, 1.5L, 1cr, 2m (the `amount.shorthand` preference); on unless turned off. */
  shorthand?: boolean
  /** How the person resolved an ambiguous "1,234" (`amountReadings`). */
  reading?: 'decimal' | 'grouped'
}

/*
 * Currency marks a pasted amount may carry ("₹1,20,000.50", "Rs. 1,200",
 * "1.234,50 €", "USD 12"): any currency sign, every code and symbol word in
 * `CURRENCIES` (longest first, so "HK$" goes before "$"), and "Rs.". Letters
 * around them must not be letters, so shorthand like "1.5L" is never eaten.
 */
const escape = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const MARKS = [
  'Rs.',
  ...Object.values(CURRENCIES).flatMap(c => [c.code, c.symbol]),
]
  .filter((x, i, xs) => xs.indexOf(x) === i)
  .sort((x, y) => y.length - x.length)
const CURRENCY_MARK = new RegExp(`(?<![A-Za-z])(?:${MARKS.map(escape).join('|')})(?![A-Za-z])|\\p{Sc}`, 'giu')

/**
 * Drops what an amount field can never hold - currency signs, codes and
 * symbol words from a paste - and keeps everything else exactly as typed.
 */
export function cleanAmountText(input: string): string {
  const out = input.replace(CURRENCY_MARK, '')
  return out === input ? input : out.trim()
}

/*
 * Devanagari, Arabic-Indic and Persian digits read as 0-9; the Arabic
 * decimal and thousands marks read as "." and ",".
 */
const DIGIT_BASES = [0x966, 0x660, 0x6f0]
function asciiDigits(input: string): string {
  return input.replace(/[\u0966-\u096f\u0660-\u0669\u06f0-\u06f9\u066b\u066c]/g, ch => {
    const c = ch.charCodeAt(0)
    if (c === 0x66b) return '.'
    if (c === 0x66c) return ','
    const base = DIGIT_BASES.find(b => c >= b && c <= b + 9)!
    return String(c - base)
  })
}

/** Spaces (also the no-break ones fr-FR groups with) and apostrophes (de-CH) only ever group digits. */
const normalize = (input: string) => asciiDigits(cleanAmountText(input)).replace(/[\s\u00a0\u202f'’]/g, '')

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
  return EXPRESSION.test(input)
}

type Ratio = {n: bigint; d: bigint}

function toRatio(num: string, suffix?: string): Ratio {
  const [whole, frac = ''] = num.split('.')
  const n = BigInt(whole! + frac) * (suffix ? MULTIPLIER[suffix.toLowerCase()]! : 1n)
  return {n, d: 10n ** BigInt(frac.length)}
}

/**
 * A plain "1,234" or "1.234" where the one mark is the locale's decimal mark
 * and exactly three digits follow: it may be a thousands group or three
 * decimals. Returns both readings in minor units (`decimal` only when the
 * currency has three decimals), or null when the input is not ambiguous.
 * The amount field asks "Did you mean ...?" instead of guessing.
 */
export function amountReadings(
  input: string,
  code: CurrencyCode,
  mark: '.' | ',' = '.',
): {grouped: bigint; decimal?: bigint} | null {
  const m = /^([-−]?)([1-9]\d{0,2})([.,])(\d{3})$/.exec(normalize(input))
  if (!m || m[3] !== mark) return null
  const sign = m[1] ? '-' : ''
  const {scale} = getCurrency(code)
  const grouped = parseAmount(`${sign}${m[2]}${m[4]}`, code)
  return scale >= 3
    ? {grouped, decimal: parseAmount(`${sign}${m[2]}.${m[4]}`, code)}
    : {grouped}
}

/**
 * Evaluates the amount field ("1200+300", "250 x 3", "100/3", "1.5L",
 * "₹1,20,000.50", "१२००") into minor units, exactly: operands are
 * rationals, `x` and `/` bind tighter than `+` and `-`, and only a sum's
 * final result is rounded (half away from zero) to the currency's minor
 * unit. A plain number is never rounded: one with too many decimals, even
 * after shorthand, is TOO_MANY_DECIMALS. `mark` is the number locale's
 * decimal mark (`decimalMark`); grouping marks and currency marks are
 * dropped; an ambiguous "1,234" throws AMBIGUOUS_AMOUNT until
 * `options.reading` says which it is.
 */
export function evaluateAmount(
  input: string,
  code: CurrencyCode,
  mark: '.' | ',' = '.',
  {shorthand = true, reading}: AmountOptions = {},
): bigint {
  const s = normalize(input)
  const {scale} = getCurrency(code)
  if (!isExpression(s)) {
    const m = PLAIN.exec(s)
    if (!m || (m[3] && !shorthand)) throw new DomainError('INVALID_AMOUNT')
    const sign = m[1] ? '-' : ''
    if (!m[3]) {
      const readings = amountReadings(s, code, mark)
      if (readings) {
        if (!reading) throw new DomainError('AMBIGUOUS_AMOUNT')
        const v = readings[reading]
        if (v === undefined) throw new DomainError('TOO_MANY_DECIMALS')
        return v
      }
      return parseAmount(`${sign}${plainNumber(m[2]!, scale, mark)}`, code)
    }
    const {n, d} = toRatio(plainNumber(m[2]!, scale, mark), m[3])
    const scaled = n * 10n ** BigInt(scale)
    if (scaled % d !== 0n) throw new DomainError('TOO_MANY_DECIMALS')
    return assertInRange(sign ? -scaled / d : scaled / d)
  }

  const tokens: Array<{num: string; suffix?: string} | string> = []
  TOKEN.lastIndex = 0
  while (TOKEN.lastIndex < s.length) {
    const m = TOKEN.exec(s)
    if (!m || (m[2] && !shorthand)) throw new DomainError('INVALID_AMOUNT')
    tokens.push(m[1] ? {num: plainNumber(m[1], scale, mark), suffix: m[2]} : m[0])
  }
  // Must alternate number, operator, number ...
  tokens.forEach((tok, i) => {
    if ((i % 2 === 0) !== (typeof tok !== 'string'))
      throw new DomainError('INVALID_AMOUNT')
  })
  if (tokens.length % 2 === 0) throw new DomainError('INCOMPLETE')

  const operand = (i: number) => {
    const tok = tokens[i] as {num: string; suffix?: string}
    return toRatio(tok.num, tok.suffix)
  }
  let total: Ratio = {n: 0n, d: 1n}
  let sign = 1n
  let term = operand(0)
  for (let i = 1; i < tokens.length; i += 2) {
    const op = OPS[tokens[i] as string]!
    const next = operand(i + 1)
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

/**
 * How much of `total` is assigned when `remaining` is left, from 0 to 1
 * (display only: a progress bar's width, never money).
 */
export function assignedFraction(total: bigint, remaining: bigint): number {
  if (total <= 0n) return 0
  if (remaining <= 0n) return 1
  if (remaining >= total) return 0
  return Number(((total - remaining) * 10000n) / total) / 10000
}
