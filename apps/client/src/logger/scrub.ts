/**
 * Privacy scrubbers for everything the logger records (ARCHITECTURE 16.1):
 * no names, titles, notes, amounts, emails, phone numbers or link tokens
 * ever leave through telemetry. Pure, so they run twice where a vendor needs
 * it (breadcrumb and send), and never throw.
 */

const UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi
const URL = /\b([a-z][a-z0-9+.-]*:\/\/[^\s/?#]*)([^\s?#]*)(?:[?#]\S*)?/gi
// Phone numbers, grouped amounts, decimals and any run of 4+ digits.
const NUMBER = /\+?\d[\d -]{6,}\d|\d{1,3}(?:,\d{2,3})+(?:\.\d+)?|\d+\.\d+|\d{4,}/g
const PERSONAL_KEY = /(?:name|title|notes?|email|phone|amounts?|total|payers|shares|tax|tip|discount|service|upi(?:id)?|description|text|query|address)$/i

/** A path segment that names something (a uuid or a mixed token) becomes `:id` / `:token`. */
function scrubSegment(segment: string) {
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment)) return ':id'
  if (segment.length >= 8 && /\d/.test(segment) && /[a-z]/i.test(segment)) return ':token'
  return segment
}

/** A string with emails, link tokens, query strings, ids and numbers taken out; its shape stays readable. */
export function scrubText(s: string): string {
  return s
    .replace(URL, (_m, origin: string, path: string) => origin + path.split('/').map(scrubSegment).join('/'))
    .replace(EMAIL, '[email]')
    .replace(UUID, ':id')
    .replace(NUMBER, '[number]')
}

/** Metadata with personal keys redacted, every string scrubbed, money (bigint) removed. Never throws. */
export function scrubMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  const seen = new WeakSet<object>()
  const scrub = (value: unknown, key: string, depth: number): unknown => {
    if (PERSONAL_KEY.test(key) || typeof value === 'bigint') return '[redacted]'
    if (typeof value === 'string') return scrubText(value)
    if (value instanceof Error) return `${value.name}: ${scrubText(value.message)}`
    if (value === null || typeof value !== 'object') return typeof value === 'function' ? undefined : value
    if (seen.has(value)) return '[cycle]'
    if (depth > 5) return '[deep]'
    seen.add(value)
    if (Array.isArray(value)) return value.map(v => scrub(v, '', depth + 1))
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, scrub(v, k, depth + 1)]))
  }
  try {
    return scrub(metadata, '', 0) as Record<string, unknown>
  } catch {
    return {scrubFailed: true}
  }
}

export type Attributes = Record<string, string | number | boolean>

/** Metric attributes: enum-like strings, finite numbers and booleans only (16.3); anything else is dropped. */
export function scrubAttributes(attrs: Record<string, unknown>): Attributes {
  const out: Attributes = {}
  for (const [k, v] of Object.entries(attrs)) {
    if (typeof v === 'boolean' || (typeof v === 'number' && Number.isFinite(v))) out[k] = v
    else if (typeof v === 'string' && /^[A-Za-z0-9_.:-]{1,40}$/.test(v)) out[k] = v
  }
  return out
}

/** An opaque id (random letters and digits), never an email, phone number or name. */
export function isOpaqueId(id: string): boolean {
  return /^[A-Za-z0-9_-]{8,64}$/.test(id) && /\d/.test(id) && /[A-Za-z]/.test(id)
}
