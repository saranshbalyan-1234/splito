import {
  amountInputText,
  type Charge,
  chargesOf,
  type ChargeKind,
  DomainError,
  evaluateAmount,
  parseBasisPoints,
  ZERO,
} from '@splito/domain'
import {type ChargePreset, type ChargeTemplate} from '@splito/sync'

import {type ExpenseForm} from '../form'

/** Where a charge applies, as the form holds it: tax class ids, or item keys. */
export type ChargeScopeForm =
  | {type: 'all'}
  | {type: 'classes'; classes: string[]}
  | {type: 'items'; items: string[]}

/** One charge row of the itemize editor (F-403), as typed text. Plain JSON, so a draft can keep it. */
export type ChargeForm = {
  key: string
  name: string
  kind: ChargeKind
  mode: 'percent' | 'amount'
  /** A percentage ("12.5") or an amount ("40"); blank is zero. */
  value: string
  scope: ChargeScopeForm
  stacksOn: 'items' | 'earlier'
  /** The prices already include this tax: it shows its portion and adds nothing. */
  inclusive: boolean
}

export const CHARGE_KINDS: ChargeKind[] = [
  'service',
  'tax',
  'packing',
  'delivery',
  'other',
  'discount',
]

export function emptyCharge(key: string): ChargeForm {
  return {
    key,
    name: '',
    kind: 'other',
    mode: 'percent',
    value: '',
    scope: {type: 'all'},
    stacksOn: 'items',
    inclusive: false,
  }
}

/** Basis points as percent text in the locale's decimal mark: 1250 is "12.5". */
export function bpText(bp: number, mark: '.' | ',' = '.'): string {
  const frac = String(bp % 100)
    .padStart(2, '0')
    .replace(/0$/, '')
  return `${Math.floor(bp / 100)}${bp % 100 ? mark + frac : ''}`
}

/** A preset's or merchant's charges as editable rows. */
export function chargesFromTemplates(
  templates: ChargeTemplate[],
  newKey: () => string,
  mark: '.' | ',' = '.',
): ChargeForm[] {
  return templates.map(t => ({
    key: newKey(),
    name: t.name,
    kind: t.kind,
    mode: t.mode,
    value: t.mode === 'percent' ? bpText(t.basisPoints ?? 0, mark) : '',
    scope: t.classes ? {type: 'classes', classes: [...t.classes]} : {type: 'all'},
    stacksOn: t.stacksOn,
    inclusive: t.inclusive ?? false,
  }))
}

/**
 * The rows as a reusable setup. Charges on single items belong to one bill
 * and are left out; a fixed amount is not kept (it is different each bill),
 * only its place in the list. ponytail: a rate that does not parse is saved as 0.
 */
export function templatesFromCharges(forms: ChargeForm[]): ChargeTemplate[] {
  return forms
    .filter(c => c.scope.type !== 'items' && c.name.trim())
    .map(c => {
      let basisPoints = 0
      if (c.mode === 'percent')
        try {
          basisPoints = parseBasisPoints(c.value)
        } catch {
          basisPoints = 0
        }
      return {
        name: c.name.trim(),
        kind: c.kind,
        mode: c.mode,
        ...(c.mode === 'percent' ? {basisPoints} : {}),
        ...(c.scope.type === 'classes' ? {classes: [...c.scope.classes]} : {}),
        stacksOn: c.stacksOn,
        ...(c.inclusive ? {inclusive: true} : {}),
      }
    })
}

/**
 * The rows as domain charges, in order. A bad rate or amount is reported
 * against `charge:<key>`; item scopes keep only items that are on the bill.
 */
export function chargesFromForms(
  forms: ChargeForm[],
  {
    currency,
    mark,
    shorthand,
    itemIds,
  }: {currency: string; mark: '.' | ','; shorthand: boolean; itemIds: ReadonlySet<string>},
): {charges: Charge[]; errors: Record<string, string>} {
  const errors: Record<string, string> = {}
  const charges: Charge[] = []
  for (const f of forms) {
    let value: Charge['value'] = {mode: 'amount', minor: ZERO}
    try {
      if (f.mode === 'percent')
        value = {mode: 'percent', basisPoints: parseBasisPoints(f.value)}
      else if (f.value.trim()) {
        const minor = evaluateAmount(f.value, currency, mark, {
          shorthand,
          reading: 'decimal',
        })
        if (minor < ZERO) throw new DomainError('NEGATIVE_AMOUNT')
        value = {mode: 'amount', minor}
      }
    } catch (e) {
      errors[`charge:${f.key}`] =
        e instanceof DomainError ? e.code : 'INVALID_AMOUNT'
    }
    charges.push({
      id: f.key,
      name: f.name.trim(),
      kind: f.kind,
      value,
      appliesTo:
        f.scope.type === 'items'
          ? {type: 'items', items: f.scope.items.filter(i => itemIds.has(i))}
          : f.scope,
      stacksOn: f.stacksOn,
      ...(f.inclusive && f.kind !== 'discount' ? {inclusive: true} : {}),
    })
  }
  return {charges, errors}
}

/** A stored expense's charges as editable rows (the amount in the locale's mark). */
export function formsFromCharges(
  charges: Charge[],
  currency: string,
  mark: '.' | ',' = '.',
): ChargeForm[] {
  return charges.map(c => ({
    key: c.id,
    name: c.name,
    kind: c.kind,
    mode: c.value.mode,
    value:
      c.value.mode === 'percent'
        ? bpText(c.value.basisPoints, mark)
        : c.value.minor === ZERO
          ? ''
          : amountInputText(c.value.minor, currency, mark),
    scope: c.appliesTo,
    stacksOn: c.stacksOn,
    inclusive: c.inclusive ?? false,
  }))
}

/**
 * A new itemised bill starts from the person's defaults (F-403): their default
 * preset when it is not Simple, else Simple with the default service charge.
 * A bill that already has items or a charge list is left alone.
 */
export function startItemize(
  f: ExpenseForm,
  {
    preset,
    serviceBasisPoints,
    newKey,
    mark,
  }: {
    preset: ChargePreset | undefined
    serviceBasisPoints: number
    newKey: () => string
    mark: '.' | ','
  },
): ExpenseForm {
  if (f.items.length > 0 || f.charges !== undefined) return f
  if (preset && preset.id !== 'simple')
    return {...f, charges: chargesFromTemplates(preset.charges, newKey, mark)}
  if (serviceBasisPoints > 0 && !f.service.trim())
    return {
      ...f,
      service: bpText(serviceBasisPoints, mark),
      adjustModes: {...f.adjustModes, service: 'percent'},
    }
  return f
}

/**
 * The Simple rows as typed (a rate or an amount each for tax, tip, service
 * and discount) as an editable charge list, so going to Custom keeps them.
 * A row that does not read yet is left out, as an empty one is.
 */
export function chargesFromSimple(
  f: ExpenseForm,
  {
    mark,
    shorthand,
    names,
  }: {
    mark: '.' | ','
    shorthand: boolean
    /** Row names in the person's language, by `chargesOf` id (tax, tip, service, discount). */
    names?: Partial<Record<'tax' | 'tip' | 'service' | 'discount', string>>
  },
): ChargeForm[] {
  const money = {tax: ZERO, tip: ZERO, service: ZERO, discount: ZERO}
  const rates: Partial<Record<keyof typeof money, number>> = {}
  for (const kind of ['tax', 'tip', 'service', 'discount'] as const) {
    try {
      if (f.adjustModes?.[kind] === 'percent') {
        const bp = parseBasisPoints(f[kind] ?? '')
        if (bp > 0) rates[kind] = bp
      } else if ((f[kind] ?? '').trim()) {
        money[kind] = evaluateAmount(f[kind], f.currency, mark, {
          shorthand,
          reading: 'decimal',
        })
      }
    } catch {
      // Not readable yet: the row is left out.
    }
  }
  return formsFromCharges(
    chargesOf({...money, rates}).map(c => ({
      ...c,
      name: names?.[c.id as keyof typeof money] ?? c.name,
    })),
    f.currency,
    mark,
  )
}
