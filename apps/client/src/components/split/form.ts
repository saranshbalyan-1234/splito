import {
  computeShares,
  DomainError,
  evaluateAmount,
  getCurrency,
  parseBasisPoints,
  parseLocalDate,
  remainingMinor,
  type SplitInput,
  sumMinor,
  toDecimalString,
  validateExpense,
} from '@splito/domain'
import {type Expense, type ExpenseDraft} from '@splito/sync'

/** The split modes the form offers; `adjusted` is "equal with adjustments". */
export type SplitMode =
  'equal' | 'exact' | 'percent' | 'shares' | 'adjusted' | 'items'
export const SPLIT_MODES: SplitMode[] = [
  'equal',
  'exact',
  'percent',
  'shares',
  'adjusted',
  'items',
]

export type ItemForm = {
  key: string
  name: string
  amount: string
  people: string[]
}

/**
 * Everything the Add/Edit expense form holds, as typed text. Plain JSON (no
 * bigint), so a draft can sit in device storage as is.
 */
export type ExpenseForm = {
  title: string
  /** Raw amount text; may be a calculator expression ("1200+300"). */
  amount: string
  currency: string
  date: string
  category: string
  /** Set once the person picks a category, so auto-suggest stops overriding it. */
  isCategoryPicked: boolean
  groupId: string | null
  /** Everyone on the expense (payers and the people splitting), me first. */
  people: string[]
  payerMode: 'single' | 'multiple'
  payer: string
  paid: Record<string, string>
  mode: SplitMode
  /** Equal and adjusted modes: people on the expense who are not splitting it. */
  excluded: string[]
  exact: Record<string, string>
  percent: Record<string, string>
  /** Whole-number weights; missing means 1. */
  shares: Record<string, number>
  adjust: Record<string, string>
  items: ItemForm[]
  tax: string
  tip: string
  discount: string
  notes: string
}

export function emptyForm({
  me,
  currency,
  date,
  people,
  groupId,
  mode,
  category = 'other',
}: {
  me: string
  currency: string
  date: string
  people: string[]
  groupId: string | null
  mode: SplitMode
  category?: string
}): ExpenseForm {
  return {
    title: '',
    amount: '',
    currency,
    date,
    category,
    isCategoryPicked: false,
    groupId,
    people: [me, ...people.filter(p => p !== me)],
    payerMode: 'single',
    payer: me,
    paid: {},
    mode,
    excluded: [],
    exact: {},
    percent: {},
    shares: {},
    adjust: {},
    items: [],
    tax: '',
    tip: '',
    discount: '',
    notes: '',
  }
}

const money = (minor: bigint, scale: number) => toDecimalString(minor, scale)
const blankIfZero = (minor: bigint, scale: number) =>
  minor === 0n ? '' : money(minor, scale)
const percentText = (bp: number) =>
  `${Math.floor(bp / 100)}${
    bp % 100
      ? '.' +
        String(bp % 100)
          .padStart(2, '0')
          .replace(/0$/, '')
      : ''
  }`

/** The edit form for a stored expense; `evaluateForm` of the result rebuilds the same split. */
export function formFromExpense(e: Expense, me: string): ExpenseForm {
  const {scale} = getCurrency(e.currency)
  const people = [
    ...new Set([me, ...Object.keys(e.payers), ...Object.keys(e.shares)]),
  ].filter(p => p !== me || me in e.payers || me in e.shares)
  const payerIds = Object.keys(e.payers)
  const single = payerIds.length === 1 && e.payers[payerIds[0]!] === e.total
  const s = e.split
  const form: ExpenseForm = {
    ...emptyForm({
      me,
      currency: e.currency,
      date: e.date,
      people,
      groupId: e.groupId,
      mode: s.mode,
      category: e.category,
    }),
    people,
    title: e.title,
    amount: money(e.total, scale),
    isCategoryPicked: true,
    payerMode: single ? 'single' : 'multiple',
    payer: single ? payerIds[0]! : (payerIds[0] ?? me),
    paid: single
      ? {}
      : Object.fromEntries(
          Object.entries(e.payers).map(([k, v]) => [k, money(v, scale)]),
        ),
    notes: e.notes,
  }
  switch (s.mode) {
    case 'equal':
    case 'adjusted':
      form.excluded = people.filter(p => !s.participants.includes(p))
      if (s.mode === 'adjusted')
        form.adjust = Object.fromEntries(
          Object.entries(s.adjustments).map(([k, v]) => [k, money(v, scale)]),
        )
      break
    case 'exact':
      form.exact = Object.fromEntries(
        Object.entries(s.amounts).map(([k, v]) => [k, money(v, scale)]),
      )
      break
    case 'percent':
      form.percent = Object.fromEntries(
        Object.entries(s.basisPoints).map(([k, v]) => [k, percentText(v)]),
      )
      break
    case 'shares':
      form.shares = Object.fromEntries(people.map(p => [p, s.shares[p] ?? 0]))
      break
    case 'items':
      form.items = s.items.map(i => ({
        key: i.id,
        name: i.name ?? '',
        amount: money(i.amount, scale),
        people: i.participants,
      }))
      form.tax = blankIfZero(s.tax, scale)
      form.tip = blankIfZero(s.tip, scale)
      form.discount = blankIfZero(s.discount, scale)
      break
  }
  return form
}

export type Remaining =
  {kind: 'money'; value: bigint} | {kind: 'percent'; value: number}

export type FormEvaluation = {
  /** Valid, positive total in minor units. */
  total?: bigint
  /** Why the amount text is not a valid amount (an error code). */
  amountError?: string
  /** Per-input error codes: a person id (split rows), `paid:<id>`, `item:<key>`, `tax`, `tip`, `discount`. */
  rowErrors: Record<string, string>
  /** Multiple payers: what is still unpaid of the total. */
  payersRemaining?: bigint
  /** Exact, percent and items modes: what is still unassigned. */
  remaining?: Remaining
  /** Items mode: items + tax + tip - discount. */
  itemsTotal?: bigint
  /** Each person's share once the split is complete. */
  shares?: Record<string, bigint>
  /** Present only when the expense passes `validateExpense`; Save stays disabled until then. */
  draft?: ExpenseDraft
  /** The first problem blocking Save, as an error code. */
  error?: string
}

const codeOf = (e: unknown) =>
  e instanceof DomainError ? e.code : 'INVALID_AMOUNT'

/**
 * Turns the form into a domain draft. All money maths goes through
 * `@splito/domain` (evaluateAmount, sums, computeShares, validateExpense).
 * `mark` is the number locale's decimal mark (`decimalMark`).
 */
export function evaluateForm(
  f: ExpenseForm,
  tz: string,
  mark: '.' | ',' = '.',
): FormEvaluation {
  const r: FormEvaluation = {rowErrors: {}}
  const errors: string[] = []

  /*
   * Optional amount in a row: blank is zero; a bad one is reported against
   * its key. Only adjustments may go below zero (validateExpense refuses a
   * payer or share against the total's sign).
   */
  const rowAmount = (
    text: string | undefined,
    key: string,
    canBeNegative = false,
  ): bigint | undefined => {
    if (!text?.trim()) return 0n
    try {
      const v = evaluateAmount(text, f.currency, mark)
      if (v >= 0n || canBeNegative) return v
      r.rowErrors[key] = 'NEGATIVE_AMOUNT'
    } catch (e) {
      r.rowErrors[key] = codeOf(e)
    }
    return undefined
  }

  if (!f.title.trim()) errors.push('TITLE_REQUIRED')

  if (!f.amount.trim()) errors.push('AMOUNT_REQUIRED')
  else {
    try {
      const total = evaluateAmount(f.amount, f.currency, mark)
      if (total <= 0n) r.amountError = 'AMOUNT_NOT_POSITIVE'
      else r.total = total
    } catch (e) {
      r.amountError = codeOf(e)
    }
    if (r.amountError) errors.push(r.amountError)
  }

  try {
    parseLocalDate(f.date)
  } catch {
    errors.push('INVALID_DATE')
  }

  const total = r.total
  const people = f.people

  /* Payers */
  let payers: Record<string, bigint> | undefined
  if (f.payerMode === 'single') {
    if (total !== undefined) payers = {[f.payer]: total}
  } else {
    const paid: Record<string, bigint> = {}
    let isComplete = true
    for (const p of people) {
      const v = rowAmount(f.paid[p], `paid:${p}`)
      if (v === undefined) isComplete = false
      else if (v !== 0n) paid[p] = v
    }
    if (!isComplete) errors.push('INVALID_ROW_AMOUNT')
    else if (total !== undefined) {
      r.payersRemaining = remainingMinor(total, Object.values(paid))
      if (r.payersRemaining !== 0n) errors.push('PAYERS_MISMATCH')
      else payers = paid
    }
  }

  /* Split */
  let split: SplitInput | undefined
  const splitting = people.filter(p => !f.excluded.includes(p))
  switch (f.mode) {
    case 'equal':
      if (splitting.length === 0) errors.push('NO_PARTICIPANTS')
      else split = {mode: 'equal', participants: splitting}
      break
    case 'adjusted': {
      const adjustments: Record<string, bigint> = {}
      let isComplete = true
      for (const p of splitting) {
        const v = rowAmount(f.adjust[p], p, true)
        if (v === undefined) isComplete = false
        else if (v !== 0n) adjustments[p] = v
      }
      if (splitting.length === 0) errors.push('NO_PARTICIPANTS')
      else if (!isComplete) errors.push('INVALID_ROW_AMOUNT')
      else split = {mode: 'adjusted', participants: splitting, adjustments}
      break
    }
    case 'exact': {
      const amounts: Record<string, bigint> = {}
      let isComplete = true
      for (const p of people) {
        const v = rowAmount(f.exact[p], p)
        if (v === undefined) isComplete = false
        else if (v !== 0n) amounts[p] = v
      }
      if (!isComplete) errors.push('INVALID_ROW_AMOUNT')
      else {
        if (total !== undefined)
          r.remaining = {
            kind: 'money',
            value: remainingMinor(total, Object.values(amounts)),
          }
        if (Object.keys(amounts).length === 0) errors.push('NO_PARTICIPANTS')
        else if (r.remaining && r.remaining.value !== 0n)
          errors.push('TOTAL_MISMATCH')
        else split = {mode: 'exact', amounts}
      }
      break
    }
    case 'percent': {
      const basisPoints: Record<string, number> = {}
      let isComplete = true
      for (const p of people) {
        try {
          const bp = parseBasisPoints(f.percent[p] ?? '')
          if (bp) basisPoints[p] = bp
        } catch (e) {
          r.rowErrors[p] = codeOf(e)
          isComplete = false
        }
      }
      if (!isComplete) errors.push('INVALID_PERCENT')
      else {
        const used = Object.values(basisPoints).reduce((a, b) => a + b, 0)
        r.remaining = {kind: 'percent', value: 10000 - used}
        if (used !== 10000) errors.push('PERCENT_NOT_100')
        else split = {mode: 'percent', basisPoints}
      }
      break
    }
    case 'shares': {
      const shares = Object.fromEntries(
        people
          .map(p => [p, f.shares[p] ?? 1])
          .filter(([, w]) => (w as number) > 0),
      )
      if (Object.keys(shares).length === 0) errors.push('NO_PARTICIPANTS')
      else split = {mode: 'shares', shares}
      break
    }
    case 'items': {
      const items: Array<{
        id: string
        name: string
        amount: bigint
        participants: string[]
      }> = []
      let isComplete = true
      for (const item of f.items) {
        const v = rowAmount(item.amount, `item:${item.key}`)
        if (v === undefined) isComplete = false
        else if (v !== 0n) {
          if (item.people.length === 0) {
            r.rowErrors[`item:${item.key}`] = 'UNASSIGNED_ITEM'
            isComplete = false
          }
          items.push({
            id: item.key,
            name: item.name.trim(),
            amount: v,
            participants: item.people,
          })
        }
      }
      const tax = rowAmount(f.tax, 'tax')
      const tip = rowAmount(f.tip, 'tip')
      const discount = rowAmount(f.discount, 'discount')
      if (
        !isComplete ||
        tax === undefined ||
        tip === undefined ||
        discount === undefined
      ) {
        errors.push(
          Object.values(r.rowErrors).includes('UNASSIGNED_ITEM')
            ? 'UNASSIGNED_ITEM'
            : 'INVALID_ROW_AMOUNT',
        )
        break
      }
      r.itemsTotal = remainingMinor(
        sumMinor([...items.map(i => i.amount), tax, tip]),
        [discount],
      )
      if (total !== undefined)
        r.remaining = {
          kind: 'money',
          value: remainingMinor(total, [r.itemsTotal]),
        }
      if (items.length === 0) errors.push('NO_ITEMS')
      else if (r.remaining && r.remaining.value !== 0n)
        errors.push('TOTAL_MISMATCH')
      else split = {mode: 'items', items, tax, tip, discount}
      break
    }
  }

  if (total !== undefined && split) {
    try {
      r.shares = computeShares(total, split)
    } catch (e) {
      errors.push(codeOf(e))
    }
  }

  if (
    errors.length === 0 &&
    total !== undefined &&
    payers &&
    split &&
    r.shares
  ) {
    try {
      validateExpense({total, payers, shares: r.shares})
      r.draft = {
        title: f.title.trim(),
        groupId: f.groupId,
        currency: f.currency,
        total,
        payers,
        split,
        date: f.date,
        tz,
        category: f.category,
        notes: f.notes.trim(),
      }
    } catch (e) {
      errors.push(codeOf(e))
    }
  }

  // A row below zero says so, rather than "isn't a valid number".
  r.error =
    errors[0] === 'INVALID_ROW_AMOUNT' &&
    Object.values(r.rowErrors).includes('NEGATIVE_AMOUNT')
      ? 'NEGATIVE_AMOUNT'
      : errors[0]
  return r
}

/** True when the form holds anything worth keeping as a draft. */
export function hasContent(f: ExpenseForm): boolean {
  return Boolean(
    f.title.trim() || f.amount.trim() || f.notes.trim() || f.items.length,
  )
}
