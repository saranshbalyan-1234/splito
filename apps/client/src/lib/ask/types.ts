import {type CurrencyCode} from '@splito/domain'

/*
 * Ask Splito's on-device engine (ARCHITECTURE 26.19, F-2301). A question
 * becomes an `Intent` (parse.ts), an intent becomes an `Answer` (answer.ts),
 * and the chat draws the answer in the user's language. Answers are plain,
 * JSON-safe data (money as bigint, encoded by history.ts), so a stored chat
 * says exactly what it said when it was asked.
 */

/** A person or group the question named. */
export type Ref = {id: string; name: string}

/** What a question can name: the people, groups and categories this device holds. */
export type Vocab = {
  people: Ref[]
  groups: Ref[]
  categories: Array<{id: string; name: string}>
}

/** "My share" (default), what I paid, or everyone's total. */
export type Measure = 'share' | 'paid' | 'total'

export type PeriodSpec =
  | {kind: 'all'}
  | {kind: 'today'}
  | {kind: 'yesterday'}
  | {kind: 'week'; offset: number}
  | {kind: 'month'; offset: number}
  | {kind: 'year'; offset: number}
  /** The last `n` days up to today. */
  | {kind: 'days'; n: number}
  /** The last `n` whole-or-current months up to today. */
  | {kind: 'months'; n: number}
  /** A named month; no year means its latest past occurrence. */
  | {kind: 'monthOf'; month: number; year?: number}
  | {kind: 'yearOf'; year: number}

export type Breakdown = 'category' | 'person' | 'group'
export type Bucket = 'day' | 'week' | 'month'

export type Scope = {category?: string; group?: Ref; person?: Ref}

export type Intent =
  | {kind: 'balance'; person: Ref}
  | {kind: 'ranking'; direction: 'owedToMe' | 'iOwe' | 'both'}
  | {kind: 'groupBalance'; group: Ref}
  | ({kind: 'spend'; measure: Measure; period?: PeriodSpec; breakdown?: Breakdown} & Scope)
  | ({kind: 'trend'; measure: Measure; by?: Bucket; period?: PeriodSpec} & Scope)
  | {kind: 'find'; query: string}
  | {kind: 'split'; amountText?: string; currency?: CurrencyCode; ways: number; title?: string}
  | {kind: 'help'}
  /** Two or more people or groups match a name: asks which. */
  | {kind: 'clarify'; term: string; options: Ref[]}
  | {kind: 'unsupported'; suggestion: Suggestion}

/** What the "closest supported question" is, for the chat to word in the user's language. */
export type Suggestion =
  | {key: 'owedMost'}
  | {key: 'iOweMost'}
  | {key: 'balanceWith'; name: string}
  | {key: 'spendMonth'}
  | {key: 'spendCategory'; name: string}
  | {key: 'groupByDay'; name: string}
  | {key: 'groupOwes'; name: string}
  | {key: 'byCategory'}
  | {key: 'split'}

export type Money = {currency: CurrencyCode; amount: bigint}

/** The dates a period resolved to, kept with its kind so the chat can name it ("this month"). */
export type PeriodInfo = {
  kind: PeriodSpec['kind']
  from: string
  to: string
  offset?: number
  n?: number
}

export type RankRow = {person: Ref; currency: CurrencyCode; amount: bigint}

export type CategoryRef = {id: string; name: string; color: string}

export type Slice = {key: string; label: string; value: bigint; count: number; color?: string}

export type SpendCurrency = {
  currency: CurrencyCode
  share: bigint
  paid: bigint
  total: bigint
  count: number
  /** The breakdown asked for, or by category when nothing narrower was asked. */
  slices: Slice[]
}

export type TrendPoint = {key: string; from: string; to: string; value: bigint}

export type Answer =
  | {
      kind: 'balance'
      person: Ref
      /**
       * One line per currency, each way on its own (never netted across direct and groups, as People
       * shows it): `owed` is what they owe me, `owe` what I owe them, both >= 0. `direct` and the
       * group parts are signed (> 0 they owe me).
       */
      lines: Array<{currency: CurrencyCode; owed: bigint; owe: bigint; direct: bigint; groups: Array<{group: Ref; amount: bigint}>}>
    }
  | {
      kind: 'ranking'
      direction: 'owedToMe' | 'iOwe' | 'both'
      /** Largest first; amounts are positive. */
      owedToMe: RankRow[]
      iOwe: RankRow[]
      totals: {owedToMe: Money[]; iOwe: Money[]}
    }
  | {
      kind: 'groupBalance'
      group: Ref
      /** My net in the group; > 0 the group owes me. */
      mine: Money[]
      owes: Array<{from: Ref; to: Ref; currency: CurrencyCode; amount: bigint}>
      /** Currencies whose plan goes outside the group's payment rules because they leave no way to settle. */
      outside?: CurrencyCode[]
      /** Currencies whose balances do not add up, so no plan could be worked out (named, never dropped). */
      unplanned?: CurrencyCode[]
    }
  | {
      kind: 'spend'
      measure: Measure
      period: PeriodInfo
      category?: CategoryRef
      group?: Ref
      person?: Ref
      breakdown?: Breakdown
      currencies: SpendCurrency[]
    }
  | {
      kind: 'trend'
      measure: Measure
      bucket: Bucket | 'year'
      /** The bucket asked for was too fine for the period, so the chart is coarser. */
      isCoarsened: boolean
      period: PeriodInfo
      category?: CategoryRef
      group?: Ref
      person?: Ref
      currencies: Array<{currency: CurrencyCode; total: bigint; points: TrendPoint[]}>
    }
  | {
      kind: 'find'
      query: string
      /** Matches read so far; `isPartial` when more may exist. */
      count: number
      isPartial: boolean
      totals: Money[]
      rows: Array<{id: string; title: string; date: string; currency: CurrencyCode; total: bigint; group?: string}>
    }
  | {
      kind: 'split'
      title?: string
      ways: number
      amount?: Money
      /** The largest and smallest share when the amount does not divide evenly. */
      each?: {high: bigint; low: bigint; highCount: number}
    }
  | {kind: 'clarify'; term: string; options: Ref[]}
  | {kind: 'help'}
  | {kind: 'unsupported'; suggestion: Suggestion}
