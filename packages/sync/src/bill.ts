import type {ChargeKind} from '@splito/domain'

/* Itemize tax classes and charge setups (F-403): the shapes the bill.* preferences hold. Plain JSON, no bigint. */

/** A tax class items can carry (Food, Alcohol ...). Built-in ids stay; names are the user's to change. */
export interface TaxClass {
  id: string
  name: string
  order: number
  hidden: boolean
}

export const DEFAULT_TAX_CLASSES: TaxClass[] = [
  ['standard', 'Standard'],
  ['food', 'Food'],
  ['soft', 'Soft drinks'],
  ['alcohol', 'Alcohol'],
  ['other', 'Other'],
].map(([id, name], order) => ({id: id!, name: name!, order, hidden: false}))

/**
 * A charge without a bill's items: a rate (or, for `amount`, a blank to fill
 * in) and the classes it applies to (absent: all items). Charges scoped to
 * single items are specific to one bill and never saved in a setup.
 */
export interface ChargeTemplate {
  name: string
  kind: ChargeKind
  mode: 'percent' | 'amount'
  /** Percent charges: integer basis points. */
  basisPoints?: number
  classes?: string[]
  stacksOn: 'items' | 'earlier'
  inclusive?: boolean
}

export interface ChargePreset {
  id: string
  name: string
  charges: ChargeTemplate[]
}

/** The one-tap setups. `simple` has no list: it is the four plain rows (tax, tip, service, discount). */
export const DEFAULT_CHARGE_PRESETS: ChargePreset[] = [
  {id: 'simple', name: 'Simple', charges: []},
  {
    id: 'restaurant-india',
    name: 'Restaurant India',
    charges: [
      {name: 'Service charge', kind: 'service', mode: 'percent', basisPoints: 1000, stacksOn: 'items'},
      {name: 'GST', kind: 'tax', mode: 'percent', basisPoints: 500, classes: ['standard', 'food', 'soft', 'other'], stacksOn: 'earlier'},
      {name: 'Liquor VAT', kind: 'tax', mode: 'percent', basisPoints: 2000, classes: ['alcohol'], stacksOn: 'earlier'},
    ],
  },
  {
    id: 'restaurant-eu',
    name: 'Restaurant EU',
    charges: [
      {name: 'VAT 10%', kind: 'tax', mode: 'percent', basisPoints: 1000, classes: ['food'], stacksOn: 'items', inclusive: true},
      {name: 'VAT 20%', kind: 'tax', mode: 'percent', basisPoints: 2000, classes: ['standard', 'soft', 'alcohol', 'other'], stacksOn: 'items', inclusive: true},
      {name: 'Tip', kind: 'other', mode: 'amount', stacksOn: 'items'},
    ],
  },
  {
    id: 'us-tip',
    name: 'US tip',
    charges: [
      {name: 'Sales tax', kind: 'tax', mode: 'percent', basisPoints: 800, stacksOn: 'items'},
      {name: 'Tip', kind: 'other', mode: 'percent', basisPoints: 1800, stacksOn: 'items'},
    ],
  },
]

/** A bill setup remembered for a merchant: `key` is the normalised expense title. Most recent first. */
export interface MerchantSetup {
  key: string
  /** The title as it was typed, for the "Save as preset for ..." and suggestion lines. */
  name: string
  charges: ChargeTemplate[]
}

/** The merchant memory keeps this many setups, most recent first. */
export const MERCHANT_SETUPS_MAX = 200

/** Expense title to merchant key: lower case, single spaces. */
export function merchantKey(title: string): string {
  return title.trim().replace(/\s+/g, ' ').toLowerCase()
}

const isStr = (v: unknown, max = 64): v is string => typeof v === 'string' && v.length > 0 && v.length <= max
const KINDS: readonly string[] = ['service', 'tax', 'packing', 'delivery', 'other', 'discount']

export function isTaxClasses(v: unknown): v is TaxClass[] {
  return (
    Array.isArray(v) &&
    v.length > 0 &&
    v.length <= 50 &&
    new Set(v.map(c => c?.id)).size === v.length &&
    v.some(c => c?.id === 'standard') &&
    v.every(c => isStr(c?.id) && isStr(c?.name) && Number.isInteger(c?.order) && typeof c?.hidden === 'boolean')
  )
}

export function isChargeTemplate(c: unknown): c is ChargeTemplate {
  const t = c as ChargeTemplate | null
  return (
    typeof t === 'object' &&
    t !== null &&
    isStr(t.name) &&
    KINDS.includes(t.kind) &&
    (t.mode === 'percent' || t.mode === 'amount') &&
    (t.mode === 'amount' || (Number.isInteger(t.basisPoints) && t.basisPoints! >= 0 && t.basisPoints! <= 100_00)) &&
    (t.classes === undefined || (Array.isArray(t.classes) && t.classes.length > 0 && t.classes.length <= 50 && t.classes.every(x => isStr(x)))) &&
    (t.stacksOn === 'items' || t.stacksOn === 'earlier') &&
    (t.inclusive === undefined || typeof t.inclusive === 'boolean')
  )
}

const areTemplates = (v: unknown): v is ChargeTemplate[] => Array.isArray(v) && v.length <= 12 && v.every(isChargeTemplate)

export function isChargePresets(v: unknown): v is ChargePreset[] {
  return (
    Array.isArray(v) &&
    v.length > 0 &&
    v.length <= 50 &&
    new Set(v.map(p => p?.id)).size === v.length &&
    v.every(p => isStr(p?.id) && isStr(p?.name) && areTemplates(p?.charges))
  )
}

export function isMerchantSetups(v: unknown): v is MerchantSetup[] {
  return (
    Array.isArray(v) &&
    v.length <= MERCHANT_SETUPS_MAX &&
    new Set(v.map(m => m?.key)).size === v.length &&
    v.every(m => isStr(m?.key, 120) && isStr(m?.name, 120) && areTemplates(m?.charges))
  )
}

/** The service charge new Simple bills start with, in basis points: 0 is off. */
export const SERVICE_CHARGE_CHOICES = [0, 500, 1000, 1250, 1500] as const
