import {assertInRange, DomainError} from './errors'

export type CurrencyCode = string

/**
 * Zero minor units. Components compare against this instead of writing
 * `0n`: React Compiler skips any component with a BigInt literal
 * ("Handle BigIntLiteral expressions"), which leaves the money screens
 * unmemoized.
 */
export const ZERO = 0n

export interface CurrencyInfo {
  code: CurrencyCode
  scale: 0 | 2 | 3
  symbol: string
  name: string
}

const c = (code: string, scale: 0 | 2 | 3, symbol: string, name: string): CurrencyInfo => ({code, scale, symbol, name})

export const CURRENCIES: Readonly<Record<CurrencyCode, CurrencyInfo>> = Object.freeze(
  Object.fromEntries(
    [
      c('INR', 2, '₹', 'Indian Rupee'),
      c('USD', 2, '$', 'US Dollar'),
      c('EUR', 2, '€', 'Euro'),
      c('GBP', 2, '£', 'British Pound'),
      c('AED', 2, 'د.إ', 'UAE Dirham'),
      c('SGD', 2, 'S$', 'Singapore Dollar'),
      c('THB', 2, '฿', 'Thai Baht'),
      c('AUD', 2, 'A$', 'Australian Dollar'),
      c('CAD', 2, 'C$', 'Canadian Dollar'),
      c('CHF', 2, 'CHF', 'Swiss Franc'),
      c('CNY', 2, '¥', 'Chinese Yuan'),
      c('HKD', 2, 'HK$', 'Hong Kong Dollar'),
      c('NZD', 2, 'NZ$', 'New Zealand Dollar'),
      c('LKR', 2, 'Rs', 'Sri Lankan Rupee'),
      c('NPR', 2, 'Rs', 'Nepalese Rupee'),
      c('MYR', 2, 'RM', 'Malaysian Ringgit'),
      c('IDR', 2, 'Rp', 'Indonesian Rupiah'),
      c('JPY', 0, '¥', 'Japanese Yen'),
      c('KRW', 0, '₩', 'South Korean Won'),
      c('VND', 0, '₫', 'Vietnamese Dong'),
      c('KWD', 3, 'KD', 'Kuwaiti Dinar'),
      c('BHD', 3, 'BD', 'Bahraini Dinar'),
      c('OMR', 3, 'RO', 'Omani Rial'),
    ].map(i => [i.code, i]),
  ),
)

export function getCurrency(code: string): CurrencyInfo {
  const info = CURRENCIES[code]
  if (!info) throw new DomainError('UNKNOWN_CURRENCY')
  return info
}

const AMOUNT_RE = /^(-)?(\d+)(?:\.(\d+))?$/

/** Parses a plain decimal string ("12.34") into integer minor units. No grouping, no rounding. */
export function parseAmount(input: string, code: CurrencyCode): bigint {
  const {scale} = getCurrency(code)
  const m = AMOUNT_RE.exec(input.trim())
  if (!m) throw new DomainError('INVALID_AMOUNT')
  const [, sign, whole, frac = ''] = m
  if (frac.length > scale) throw new DomainError('TOO_MANY_DECIMALS')
  const minor = BigInt(whole! + frac.padEnd(scale, '0'))
  return assertInRange(sign ? -minor : minor)
}

/** Decimal string for minor units, e.g. 1234n (scale 2) -> "12.34". Never goes through float. */
export function toDecimalString(minor: bigint, scale: number): string {
  const neg = minor < 0n
  const digits = (neg ? -minor : minor).toString().padStart(scale + 1, '0')
  const whole = digits.slice(0, digits.length - scale)
  const frac = scale ? '.' + digits.slice(-scale) : ''
  return (neg ? '-' : '') + whole + frac
}

export function formatAmount(minor: bigint, code: CurrencyCode, locale: string): string {
  const {scale} = getCurrency(code)
  const fmt = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: code,
    minimumFractionDigits: scale,
    maximumFractionDigits: scale,
  })
  // Intl accepts exact decimal strings (ES2023), so large values never lose precision.
  return fmt.format(toDecimalString(minor, scale) as unknown as number)
}
