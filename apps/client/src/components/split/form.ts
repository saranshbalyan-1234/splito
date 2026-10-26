import {
  type AdjustmentInput,
  type AdjustmentKind,
  type AmountOptions,
  amountReadings,
  amountInputText,
  type CashAllocation,
  cashSplit,
  cashUnit,
  cashUnitWhole,
  computeShares,
  DomainError,
  evaluateAmount,
  type ItemParticipant,
  parseBasisPoints,
  participantId,
  participantWeight,
  parseLocalDate,
  remainingMinor,
  resolveItemAdjustments,
  type SplitInput,
  splitItem,
  sumMinor,
  validateExpense,
  ZERO,
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

/** Itemize's charges, in the order the form shows them. */
export const ADJUSTMENT_KINDS: AdjustmentKind[] = [
  'tax',
  'tip',
  'service',
  'discount',
]
/** How each charge is typed; a missing kind is an amount (drafts from before percentages). */
export type AdjustModes = Partial<Record<AdjustmentKind, 'amount' | 'percent'>>

export type ItemForm = {
  key: string
  name: string
  amount: string
  people: string[]
  /** Portions above one, by person ("2 of 3 beers"); everyone else had one. */
  portions?: Record<string, number>
}

/**
 * Everything the Add/Edit expense form holds, as typed text. Plain JSON (no
 * bigint), so a draft can sit in device storage as is.
 */
export type ExpenseForm = {
  title: string
  /** Raw amount text; may be a calculator expression ("1200+300"), shorthand ("1.5L") or a paste. */
  amount: string
  /** How an ambiguous "1,234" was resolved (F-310); cleared whenever the amount text changes. */
  amountReading?: AmountOptions['reading']
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
  /**
   * Cash rounding (F-402) for equal, shares and percent splits: whole
   * currency units each share rounds to (1, 5, 10 ...); 0 is off. Drafts
   * saved before rounding have none, which reads as off.
   */
  roundTo?: number
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
  /** Service charge; older drafts may not have it. */
  service: string
  discount: string
  /** Which charges are typed as a percentage of the items. */
  adjustModes?: AdjustModes
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
  adjustModes,
  roundTo = 0,
}: {
  me: string
  currency: string
  date: string
  people: string[]
  groupId: string | null
  mode: SplitMode
  category?: string
  /** The remembered amount / % choice per charge (preference). */
  adjustModes?: AdjustModes
  /** Whole units new splits round to; 0 (the default) is off. */
  roundTo?: number
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
    roundTo,
    excluded: [],
    exact: {},
    percent: {},
    shares: {},
    adjust: {},
    items: [],
    tax: '',
    tip: '',
    service: '',
    discount: '',
    adjustModes,
    notes: '',
  }
}

/** Who paid: the single payer, or everyone with a paid amount typed. */
export function formPayers(f: ExpenseForm): string[] {
  return f.payerMode === 'single'
    ? [f.payer]
    : f.people.filter(p => (f.paid[p] ?? '').trim() !== '')
}

/**
 * "Split with" applied: who is on the expense, in `candidates` order (new
 * people last). Payers always stay, so unticking someone never silently
 * makes someone else the payer (audit M6); the dialog shows them locked.
 * Exclusions and item picks of people who left go with them.
 */
export function withPeople(
  f: ExpenseForm,
  ids: string[],
  candidates: string[],
): ExpenseForm {
  const keep = new Set([...ids, ...formPayers(f)])
  const people = [
    ...candidates.filter(id => keep.has(id)),
    ...[...keep].filter(id => !candidates.includes(id)),
  ]
  return {
    ...f,
    people,
    excluded: f.excluded.filter(p => keep.has(p)),
    items: f.items.map(i => ({
      ...i,
      people: i.people.filter(p => keep.has(p)),
    })),
  }
}

/**
 * The edit form for a stored expense, every amount written in the locale's
 * decimal mark `mark` (`decimalMark`); `evaluateForm` of the result with the
 * same mark rebuilds the same split. A 3-decimal amount ("12.345") looks
 * like a thousands group, so the total carries `amountReading: 'decimal'`
 * and rows always read as decimals (F-111 C2).
 */
export function formFromExpense(
  e: Expense,
  me: string,
  mark: '.' | ',' = '.',
): ExpenseForm {
  const money = (minor: bigint) => amountInputText(minor, e.currency, mark)
  const blankIfZero = (minor: bigint) => (minor === ZERO ? '' : money(minor))
  const percentText = (bp: number) =>
    `${Math.floor(bp / 100)}${
      bp % 100
        ? mark +
          String(bp % 100)
            .padStart(2, '0')
            .replace(/0$/, '')
        : ''
    }`
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
    amount: money(e.total),
    amountReading: 'decimal',
    isCategoryPicked: true,
    payerMode: single ? 'single' : 'multiple',
    payer: single ? payerIds[0]! : (payerIds[0] ?? me),
    paid: single
      ? {}
      : Object.fromEntries(
          Object.entries(e.payers).map(([k, v]) => [k, money(v)]),
        ),
    notes: e.notes,
    roundTo:
      'roundTo' in s && s.roundTo !== undefined
        ? cashUnitWhole(e.currency, s.roundTo)
        : 0,
  }
  switch (s.mode) {
    case 'equal':
    case 'adjusted':
      form.excluded = people.filter(p => !s.participants.includes(p))
      if (s.mode === 'adjusted')
        form.adjust = Object.fromEntries(
          Object.entries(s.adjustments).map(([k, v]) => [k, money(v)]),
        )
      break
    case 'exact':
      form.exact = Object.fromEntries(
        Object.entries(s.amounts).map(([k, v]) => [k, money(v)]),
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
        amount: money(i.amount),
        people: i.participants.map(participantId),
        portions: Object.fromEntries(
          i.participants
            .filter(p => participantWeight(p) > 1)
            .map(p => [participantId(p), participantWeight(p)]),
        ),
      }))
      form.adjustModes = {}
      for (const kind of ADJUSTMENT_KINDS) {
        const rate = s.rates?.[kind]
        form.adjustModes[kind] = rate === undefined ? 'amount' : 'percent'
        form[kind] =
          rate === undefined
            ? blankIfZero(s[kind] ?? ZERO)
            : rate === 0
              ? ''
              : percentText(rate)
      }
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
  /** AMBIGUOUS_AMOUNT: what the amount could mean, for "Did you mean ...?". */
  amountReadings?: {grouped: bigint; decimal?: bigint}
  /** Cash rounding: the rounded shares, the remainder and who carries it. */
  cash?: CashAllocation
  /** Per-input error codes: a person id (split rows), `paid:<id>`, `item:<key>`, `tax`, `tip`, `service`, `discount`. */
  rowErrors: Record<string, string>
  /** Multiple payers: what is still unpaid of the total. */
  payersRemaining?: bigint
  /** Exact, percent and items modes: what is still unassigned. */
  remaining?: Remaining
  /** Items mode: items + tax + tip + service - discount. */
  itemsTotal?: bigint
  /** Items mode: each charge in money, percentages already applied. */
  adjustments?: Record<AdjustmentKind, bigint>
  /** Items mode: each priced, assigned item split by its portions, by item key then person. */
  itemParts?: Record<string, Record<string, bigint>>
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
  {shorthand = true}: {shorthand?: boolean} = {},
): FormEvaluation {
  const r: FormEvaluation = {rowErrors: {}}
  const errors: string[] = []

  /*
   * Optional amount in a row: blank is zero; a bad one is reported against
   * its key. Only adjustments may go below zero (validateExpense refuses a
   * payer or share against the total's sign). Rows have no "Did you mean"
   * picker and their keypad types no grouping marks, so "5.001" in the
   * locale's mark is decimals (F-111 M3).
   */
  const rowAmount = (
    text: string | undefined,
    key: string,
    canBeNegative = false,
  ): bigint | undefined => {
    if (!text?.trim()) return ZERO
    try {
      const v = evaluateAmount(text, f.currency, mark, {
        shorthand,
        reading: 'decimal',
      })
      if (v >= ZERO || canBeNegative) return v
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
      const total = evaluateAmount(f.amount, f.currency, mark, {
        shorthand,
        reading: f.amountReading,
      })
      if (total <= ZERO) r.amountError = 'AMOUNT_NOT_POSITIVE'
      else r.total = total
    } catch (e) {
      r.amountError = codeOf(e)
      if (r.amountError === 'AMBIGUOUS_AMOUNT')
        r.amountReadings = amountReadings(f.amount, f.currency, mark, {
          shorthand,
        })!
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
      else if (v !== ZERO) paid[p] = v
    }
    if (!isComplete) errors.push('INVALID_ROW_AMOUNT')
    else if (total !== undefined) {
      r.payersRemaining = remainingMinor(total, Object.values(paid))
      if (r.payersRemaining !== ZERO) errors.push('PAYERS_MISMATCH')
      else payers = paid
    }
  }

  /* Split */
  let split: SplitInput | undefined
  const splitting = people.filter(p => !f.excluded.includes(p))
  // Only set when on, so splits saved without rounding stay byte-for-byte as before.
  const rounding = f.roundTo ? {roundTo: cashUnit(f.currency, f.roundTo)} : {}
  switch (f.mode) {
    case 'equal':
      if (splitting.length === 0) errors.push('NO_PARTICIPANTS')
      else split = {mode: 'equal', participants: splitting, ...rounding}
      break
    case 'adjusted': {
      const adjustments: Record<string, bigint> = {}
      let isComplete = true
      for (const p of splitting) {
        const v = rowAmount(f.adjust[p], p, true)
        if (v === undefined) isComplete = false
        else if (v !== ZERO) adjustments[p] = v
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
        else if (v !== ZERO) amounts[p] = v
      }
      if (!isComplete) errors.push('INVALID_ROW_AMOUNT')
      else {
        if (total !== undefined)
          r.remaining = {
            kind: 'money',
            value: remainingMinor(total, Object.values(amounts)),
          }
        if (Object.keys(amounts).length === 0) errors.push('NO_PARTICIPANTS')
        else if (r.remaining && r.remaining.value !== ZERO)
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
        else split = {mode: 'percent', basisPoints, ...rounding}
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
      else split = {mode: 'shares', shares, ...rounding}
      break
    }
    case 'items': {
      const items: Array<{
        id: string
        name: string
        amount: bigint
        participants: ItemParticipant[]
      }> = []
      let isComplete = true
      for (const item of f.items) {
        const v = rowAmount(item.amount, `item:${item.key}`)
        if (v === undefined) isComplete = false
        else if (v !== ZERO) {
          if (item.people.length === 0) {
            r.rowErrors[`item:${item.key}`] = 'UNASSIGNED_ITEM'
            isComplete = false
          }
          const participants = item.people.map(id => {
            const weight = item.portions?.[id] ?? 1
            return weight > 1 ? {id, weight} : id
          })
          if (participants.length > 0) {
            r.itemParts ??= {}
            r.itemParts[item.key] = splitItem(v, participants)
          }
          items.push({
            id: item.key,
            name: item.name.trim(),
            amount: v,
            participants,
          })
        }
      }
      /* Each charge as typed: an amount, or a percentage turned into money by the domain. */
      const inputs: Partial<Record<AdjustmentKind, AdjustmentInput>> = {}
      const rates: Partial<Record<AdjustmentKind, number>> = {}
      for (const kind of ADJUSTMENT_KINDS) {
        if (f.adjustModes?.[kind] === 'percent') {
          try {
            const basisPoints = parseBasisPoints(f[kind] ?? '')
            inputs[kind] = {mode: 'percent', basisPoints}
            if (basisPoints > 0) rates[kind] = basisPoints
          } catch (e) {
            r.rowErrors[kind] = codeOf(e)
          }
        } else {
          const minor = rowAmount(f[kind], kind)
          if (minor !== undefined) inputs[kind] = {mode: 'amount', minor}
        }
      }
      if (
        !isComplete ||
        ADJUSTMENT_KINDS.some(kind => inputs[kind] === undefined)
      ) {
        errors.push(
          Object.values(r.rowErrors).includes('UNASSIGNED_ITEM')
            ? 'UNASSIGNED_ITEM'
            : Object.values(r.rowErrors).includes('INVALID_PERCENT')
              ? 'INVALID_PERCENT'
              : 'INVALID_ROW_AMOUNT',
        )
        break
      }
      const adjustments = resolveItemAdjustments(
        sumMinor(items.map(i => i.amount)),
        inputs as Record<AdjustmentKind, AdjustmentInput>,
      )
      r.adjustments = adjustments
      const {tax, tip, service, discount} = adjustments
      r.itemsTotal = remainingMinor(
        sumMinor([...items.map(i => i.amount), tax, tip, service]),
        [discount],
      )
      if (total !== undefined)
        r.remaining = {
          kind: 'money',
          value: remainingMinor(total, [r.itemsTotal]),
        }
      if (items.length === 0) errors.push('NO_ITEMS')
      else if (r.remaining && r.remaining.value !== ZERO)
        errors.push('TOTAL_MISMATCH')
      else
        split = {
          mode: 'items',
          items,
          tax,
          tip,
          service,
          discount,
          ...(Object.keys(rates).length > 0 ? {rates} : {}),
        }
      break
    }
  }

  if (total !== undefined && split) {
    try {
      r.shares = computeShares(total, split)
      r.cash = cashSplit(total, split)
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
