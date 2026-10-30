/**
 * The Search & Ask query language (ARCHITECTURE 26.19, F-246): a typed query becomes tokens, and the tokens that are
 * facets (an amount range, a period, "paid by Riya", a status, a type, a currency, "in Goa") become removable chips.
 * Facets combine with AND, the alternatives inside one with OR ("food or travel"); the rest is free text. Pure: no
 * store, no clock (`period` tokens are turned into dates by the engine). English and Hindi words are read; any other
 * word is text, matched as written in any script.
 */
import {CURRENCIES, type CurrencyCode, MULTIPLIER, numberReadings} from '@splito/domain'

import {fold, WORD} from './searchTerms'

export type CompareOp = '<' | '<=' | '>' | '>='
export type SearchStatus = 'settled' | 'owed' | 'owe' | 'disputed' | 'deleted' | 'hidden' | 'inactive'
export type SearchType = 'expense' | 'payment' | 'writeoff' | 'comment' | 'group' | 'friend' | 'invite'
export type PeriodUnit = 'week' | 'month' | 'year'

/** A currency a number was typed with ("EUR 50", "€50"); absent: the amount in every currency. */
type Money = {currency?: CurrencyCode}

export type SearchToken =
  | {kind: 'text'; text: string}
  /**
   * A plain number in the user's number format ("450", "12,50", "1,00,000", "2k", "1 lakh"): an amount in each
   * expense's own currency, or text. `amounts` holds every reading as a plain decimal ("1.000" under "." is 1000 or 1.000).
   */
  | ({kind: 'amount'; amounts: string[]; text: string} & Money)
  | ({kind: 'compare'; op: CompareOp; amounts: string[]} & Money)
  | ({kind: 'between'; from: string[]; to: string[]} & Money)
  | ({kind: 'around'; amounts: string[]} & Money)
  /** "today" (0) or "yesterday" (-1). */
  | {kind: 'day'; offset: number; text: string}
  | {kind: 'month'; month: string; year?: string; text: string}
  /** "this month", "last week": `offset` units back from now. */
  | {kind: 'period'; unit: PeriodUnit; offset: number}
  /** "paid by Riya" (payer) or "with Riya": a person's name (the start of a word of it). `words` are the typed words, for a name nobody has. */
  | {kind: 'person'; role: 'payer' | 'with'; text: string; words: string[]}
  /** "in Goa": a group's name or place, or a word of the record. */
  | {kind: 'place'; text: string; words: string[]}
  | {kind: 'currency'; code: CurrencyCode}
  | {kind: 'status'; status: SearchStatus; word: string}
  | {kind: 'type'; type: SearchType; word: string}
  /** Alternatives of one facet: any of them. */
  | {kind: 'any'; options: SearchToken[]}

/** A facet of the query as the search box shows it: what it is, what was typed, and where (to remove it). */
export interface SearchChip {
  facet: 'amount' | 'period' | 'person' | 'place' | 'currency' | 'status' | 'type' | 'any'
  /** The typed words, as written. */
  text: string
  /** Who is meant, for a person facet. */
  role?: 'payer' | 'with'
  status?: SearchStatus
  type?: SearchType
  /** `[start, end)` of the typed words in the query. */
  span: [number, number]
}

export interface ParsedQuery {
  tokens: SearchToken[]
  chips: SearchChip[]
}

export interface ParseOptions {
  /** The number locale's decimal mark. */
  mark?: '.' | ','
  /** Read the status and type words as text (the query found nothing as facets). */
  isLiteral?: boolean
}

const YEAR = /^(19|20)\d\d$/
const COMPARE_GLUED = /^(<=|>=|<|>)(.*)$/
const SUFFIXED = /^(.*\d)(lakhs?|lacs?|crores?|cr|mn|k|l|m)$/
const RANGE_GLUED = /^(\d[\d.,]*[a-z]*)[-–](\d[\d.,]*[a-z]*)$/

const MONTH_NAMES = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']
const HI_MONTHS = ['जनवरी', 'फरवरी', 'मार्च', 'अप्रैल', 'मई', 'जून', 'जुलाई', 'अगस्त', 'सितंबर', 'अक्टूबर', 'नवंबर', 'दिसंबर']
const MONTHS: Record<string, string> = Object.fromEntries(
  MONTH_NAMES.flatMap((name, i) => {
    const mm = String(i + 1).padStart(2, '0')
    return [[name, mm], [name.slice(0, 3), mm], [HI_MONTHS[i]!, mm], ...(name === 'september' ? [['sept', mm]] : [])]
  }),
)
const DAYS: Record<string, number> = {today: 0, yesterday: -1, आज: 0, कल: -1}

/* One word per meaning: the English word, then its Hindi forms. */
const word = (canonical: string, ...others: string[]): Array<[string, string]> => [canonical, ...others].map(w => [w, canonical])
const VOCABULARY: Record<string, string> = Object.fromEntries([
  ...word('over', 'over', 'above', 'exceeding', 'ज्यादा', 'अधिक'),
  ...word('under', 'under', 'below', 'कम'),
  ...word('around', 'around', 'about', 'approx', 'approximately', 'लगभग'),
  ...word('between', 'between', 'बीच'),
  ...word('last', 'last', 'previous', 'पिछले', 'पिछला', 'पिछली', 'बीते'),
  ...word('this', 'this', 'current', 'इस', 'इसी'),
  ...word('week', 'week', 'हफ्ते', 'हफ्ता', 'सप्ताह'),
  ...word('month', 'month', 'महीने', 'महीना'),
  ...word('year', 'year', 'साल', 'वर्ष'),
])
const STATUSES: Record<string, SearchStatus> = {
  settled: 'settled',
  चुकता: 'settled',
  owed: 'owed',
  बकाया: 'owed',
  owe: 'owe',
  owing: 'owe',
  disputed: 'disputed',
  विवादित: 'disputed',
  deleted: 'deleted',
  हटाया: 'deleted',
  हटाए: 'deleted',
  हटाई: 'deleted',
  hidden: 'hidden',
  छिपा: 'hidden',
  छिपे: 'hidden',
  inactive: 'inactive',
  निष्क्रिय: 'inactive',
}
const TYPES: Record<string, SearchType> = {
  expense: 'expense',
  expenses: 'expense',
  खर्च: 'expense',
  खर्चे: 'expense',
  payment: 'payment',
  payments: 'payment',
  repayment: 'payment',
  repayments: 'payment',
  भुगतान: 'payment',
  writeoff: 'writeoff',
  writeoffs: 'writeoff',
  comment: 'comment',
  comments: 'comment',
  टिप्पणी: 'comment',
  टिप्पणियाँ: 'comment',
  group: 'group',
  groups: 'group',
  समूह: 'group',
  ग्रुप: 'group',
  friend: 'friend',
  friends: 'friend',
  दोस्त: 'friend',
  मित्र: 'friend',
  invite: 'invite',
  invites: 'invite',
  निमंत्रण: 'invite',
}
const ME = new Set(['me', 'my', 'mine', 'myself', 'मैं', 'मैंने', 'मेरा'])

const SYMBOLS = (() => {
  const seen = new Map<string, CurrencyCode[]>()
  for (const c of Object.values(CURRENCIES)) if (c.symbol !== c.code) seen.set(c.symbol, [...(seen.get(c.symbol) ?? []), c.code])
  return new Map([...seen].filter(([, codes]) => codes.length === 1).map(([symbol, codes]) => [symbol, codes[0]!]))
})()

/** Moves a decimal point right: "1.5" by 5 is "150000". */
function shift(decimal: string, places: number): string {
  const [whole = '', frac = ''] = decimal.split('.')
  const digits = whole + frac
  const point = whole.length + places
  if (point >= digits.length) return digits.padEnd(point, '0').replace(/^0+(?=\d)/, '')
  const int = digits.slice(0, point).replace(/^0+(?=\d)/, '') || '0'
  const rest = digits.slice(point).replace(/0+$/, '')
  return rest ? `${int}.${rest}` : int
}
const scale = (amounts: string[], suffix: string) => amounts.map(a => shift(a, String(MULTIPLIER[suffix]!).length - 1))

/** The currency a chunk names by itself ("€", "eur"): its code, or undefined. */
function currencyOf(chunk: string, raw: string): CurrencyCode | undefined {
  const symbol = SYMBOLS.get(raw)
  if (symbol) return symbol
  const code = raw.toUpperCase()
  return CURRENCIES[code] && fold(raw) === chunk ? code : undefined
}

interface Chunk {
  raw: string
  /** Folded. */
  w: string
  start: number
  end: number
}

/**
 * Splits a query into tokens and chips. Numbers are read as the amount field reads them (`numberReadings`, a currency
 * sign allowed, shorthand "2k" / "1.5 lakh" too), under `mark`, the number locale's decimal mark.
 */
export function parseQuery(query: string, {mark = '.', isLiteral = false}: ParseOptions = {}): ParsedQuery {
  const chunks: Chunk[] = [...query.matchAll(/\S+/g)].map(m => ({raw: m[0], w: fold(m[0]), start: m.index!, end: m.index! + m[0].length}))
  const items: Array<{token: SearchToken; start: number; end: number; chip?: Omit<SearchChip, 'span' | 'text'>} | 'or' | 'and'> = []
  const at = (i: number) => chunks[i]
  const vocab = (i: number) => (at(i) ? VOCABULARY[at(i)!.w] : undefined)

  /** A number at chunk `i` (attached suffix, sign or a suffix word after it): its readings and how many chunks it took. */
  function number(i: number): {amounts: string[]; used: number; currency?: CurrencyCode} | undefined {
    const c = at(i)
    if (!c) return undefined
    const suffixed = SUFFIXED.exec(c.w)
    let currency = c.raw.length > 0 ? [...SYMBOLS].find(([s]) => c.raw.includes(s))?.[1] : undefined
    if (suffixed) {
      const amounts = numberReadings(suffixed[1]!, mark)
      return amounts.length ? {amounts: scale(amounts, suffixed[2]!), used: 1, currency} : undefined
    }
    const amounts = numberReadings(c.w, mark)
    if (amounts.length === 0) return undefined
    const next = at(i + 1)?.w
    if (next && next.length > 1 && MULTIPLIER[next]) return {amounts: scale(amounts, next), used: 2, currency}
    // "50 eur", "eur 50"
    currency ??= undefined
    return {amounts, used: 1, currency}
  }

  for (let i = 0; i < chunks.length; i++) {
    const c = chunks[i]!
    const w = c.w
    const push = (token: SearchToken, last: number, chip?: Omit<SearchChip, 'span' | 'text'>) => {
      items.push({token, start: c.start, end: chunks[last]!.end, chip})
      i = last
    }

    // "or" / "and" between two tokens join facets; at either end they are words.
    if ((w === 'or' || w === 'और' || w === 'या') && items.length > 0 && i < chunks.length - 1) {
      items.push('or')
      continue
    }
    if ((w === 'and' || w === 'और') && items.length > 0 && i < chunks.length - 1 && items.at(-1) !== 'or') {
      items.push('and')
      continue
    }

    // Comparisons: "> 1000", ">=1,000", "over 500", "more than 500", "at least 500", "500 से ज्यादा".
    const glued = COMPARE_GLUED.exec(w)
    const phrase =
      vocab(i) === 'over' || vocab(i) === 'under'
        ? {op: vocab(i) === 'over' ? '>' : '<', from: i + 1}
        : (w === 'more' || w === 'greater' || w === 'less' || w === 'fewer' || w === 'lower' || w === 'higher') && at(i + 1)?.w === 'than'
          ? {op: w === 'more' || w === 'greater' || w === 'higher' ? '>' : '<', from: i + 2}
          : w === 'at' && (at(i + 1)?.w === 'least' || at(i + 1)?.w === 'most')
            ? {op: at(i + 1)!.w === 'least' ? '>=' : '<=', from: i + 2}
            : w === 'up' && at(i + 1)?.w === 'to'
              ? {op: '<=', from: i + 2}
              : undefined
    if (glued || phrase) {
      const op = (glued ? glued[1] : phrase!.op) as CompareOp
      const from = glued ? (glued[2] ? i : i + 1) : phrase!.from
      const read = glued && glued[2] ? number2(glued[2], i) : number(from)
      if (read) {
        const last = glued && glued[2] ? i + read.used - 1 : from + read.used - 1
        push({kind: 'compare', op, amounts: read.amounts, ...(read.currency ? {currency: read.currency} : {})}, last, {facet: 'amount'})
        continue
      }
    }
    // A number then "से ज्यादा" / "से कम": "500 से ज्यादा".
    {
      const read = number(i)
      const rel = at(i + (read?.used ?? 1))
      const more = at(i + (read?.used ?? 1) + 1)
      if (read && rel?.w === 'से' && more && (vocab(i + (read.used + 1)) === 'over' || vocab(i + (read.used + 1)) === 'under')) {
        push({kind: 'compare', op: vocab(i + read.used + 1) === 'over' ? '>' : '<', amounts: read.amounts, ...(read.currency ? {currency: read.currency} : {})}, i + read.used + 1, {facet: 'amount'})
        continue
      }
    }
    // "between 200 and 800", "from 200 to 800".
    if (vocab(i) === 'between' || (w === 'from' && number(i + 1))) {
      const a = number(i + 1)
      const mid = a ? at(i + 1 + a.used)?.w : undefined
      if (a && (mid === 'and' || mid === 'to' || mid === 'और')) {
        const b = number(i + 2 + a.used)
        if (b) {
          push({kind: 'between', from: a.amounts, to: b.amounts, ...((a.currency ?? b.currency) ? {currency: a.currency ?? b.currency} : {})}, i + 2 + a.used + b.used - 1, {facet: 'amount'})
          continue
        }
      }
    }
    // "200-800"
    const range = RANGE_GLUED.exec(w)
    if (range) {
      const a = number2(range[1]!, i)
      const b = number2(range[2]!, i)
      if (a && b) {
        push({kind: 'between', from: a.amounts, to: b.amounts}, i, {facet: 'amount'})
        continue
      }
    }
    // "around 1k", "about 500", "~500"
    if (vocab(i) === 'around' || w.startsWith('~')) {
      const read = w.startsWith('~') && w.length > 1 ? number2(w.slice(1), i) : number(i + 1)
      if (read) {
        push({kind: 'around', amounts: read.amounts, ...(read.currency ? {currency: read.currency} : {})}, w.startsWith('~') && w.length > 1 ? i : i + read.used, {facet: 'amount'})
        continue
      }
    }

    // Dates: "this month", "last week", "last year", a month name (and a year after it), "today", "yesterday".
    if ((vocab(i) === 'last' || vocab(i) === 'this') && ['week', 'month', 'year'].includes(vocab(i + 1) ?? '')) {
      push({kind: 'period', unit: vocab(i + 1) as PeriodUnit, offset: vocab(i) === 'last' ? -1 : 0}, i + 1, {facet: 'period'})
      continue
    }
    if (w in MONTHS) {
      const next = at(i + 1)?.w
      if (next && YEAR.test(next)) push({kind: 'month', month: MONTHS[w]!, year: next, text: w}, i + 1, {facet: 'period'})
      else push({kind: 'month', month: MONTHS[w]!, text: w}, i, {facet: 'period'})
      continue
    }
    if (w in DAYS) {
      push({kind: 'day', offset: DAYS[w]!, text: w}, i, {facet: 'period'})
      continue
    }

    // People and places: "paid by Riya", "by Riya", "with Riya", "Riya ने", "in Goa". A name nobody has falls back to the words.
    const personWord = (j: number) => at(j) && !COMPARE_GLUED.test(at(j)!.w) && !(at(j)!.w in STATUSES && !isLiteral) && !numberReadings(at(j)!.w, mark).length
    if (w === 'paid' && at(i + 1)?.w === 'by' && personWord(i + 2)) {
      push({kind: 'person', role: 'payer', text: ME.has(at(i + 2)!.w) ? 'me' : at(i + 2)!.w, words: [w, 'by', at(i + 2)!.w]}, i + 2, {facet: 'person', role: 'payer'})
      continue
    }
    if (w === 'by' && personWord(i + 1)) {
      push({kind: 'person', role: 'payer', text: ME.has(at(i + 1)!.w) ? 'me' : at(i + 1)!.w, words: [w, at(i + 1)!.w]}, i + 1, {facet: 'person', role: 'payer'})
      continue
    }
    if (w === 'with' && personWord(i + 1)) {
      push({kind: 'person', role: 'with', text: ME.has(at(i + 1)!.w) ? 'me' : at(i + 1)!.w, words: [w, at(i + 1)!.w]}, i + 1, {facet: 'person', role: 'with'})
      continue
    }
    if (at(i + 1)?.w === 'ने' && personWord(i)) {
      push({kind: 'person', role: 'payer', text: ME.has(w) ? 'me' : w, words: [w]}, i + 1, {facet: 'person', role: 'payer'})
      continue
    }
    if (at(i + 1)?.w === 'के' && at(i + 2)?.w === 'साथ' && personWord(i)) {
      push({kind: 'person', role: 'with', text: ME.has(w) ? 'me' : w, words: [w]}, i + 2, {facet: 'person', role: 'with'})
      continue
    }
    if ((w === 'in' || w === 'at' || w === 'near') && personWord(i + 1) && !(at(i + 1)!.w in MONTHS) && !(at(i + 1)!.w in DAYS) && !vocab(i + 1)) {
      push({kind: 'place', text: at(i + 1)!.w, words: [w, at(i + 1)!.w]}, i + 1, {facet: 'place'})
      continue
    }

    // "status:disputed", "status: disputed", "type:payments", "is:deleted".
    const keyed = /^(status|is|type):(.*)$/.exec(w)
    if (keyed && !isLiteral) {
      const value = keyed[2] || at(i + 1)?.w
      const last = keyed[2] ? i : i + 1
      if (value && value in STATUSES && keyed[1] !== 'type') {
        push({kind: 'status', status: STATUSES[value]!, word: value}, last, {facet: 'status', status: STATUSES[value]})
        continue
      }
      if (value && value in TYPES) {
        push({kind: 'type', type: TYPES[value]!, word: value}, last, {facet: 'type', type: TYPES[value]})
        continue
      }
    }

    // Currency, status and type words.
    const currency = currencyOf(w, c.raw)
    if (currency && !numberReadings(w, mark).length) {
      push({kind: 'currency', code: currency}, i, {facet: 'currency'})
      continue
    }
    if (!isLiteral && w in STATUSES) {
      push({kind: 'status', status: STATUSES[w]!, word: w}, i, {facet: 'status', status: STATUSES[w]})
      continue
    }
    const typed = !isLiteral ? ((w === 'write' && (at(i + 1)?.w === 'off' || at(i + 1)?.w === 'offs')) || w === 'write-off' || w === 'write-offs' ? 'writeoff' : TYPES[w]) : undefined
    if (typed) {
      const last = w === 'write' ? i + 1 : i
      push({kind: 'type', type: typed, word: w}, last, {facet: 'type', type: typed})
      continue
    }

    // A plain number (and a suffixed one), then words.
    const read = number(i)
    if (read) {
      push({kind: 'amount', amounts: read.amounts, text: read.amounts[0]!, ...(read.currency ? {currency: read.currency} : {})}, i + read.used - 1)
      continue
    }
    for (const part of w.match(WORD) ?? []) items.push({token: {kind: 'text', text: part}, start: c.start, end: c.end})
  }

  /* A currency word beside an amount belongs to it ("EUR between 10 and 50", "50 eur"): one token, one chip over both. */
  type Item = (typeof items)[number]
  const isAmount = (t: Item | undefined) => typeof t === 'object' && ['amount', 'compare', 'between', 'around'].includes(t.token.kind)
  for (let k = 0; k < items.length; k++) {
    const it = items[k]
    if (typeof it !== 'object' || it.token.kind !== 'currency') continue
    const j = [k + 1, k - 1].find(x => isAmount(items[x]) && !('currency' in (items[x] as {token: object}).token))
    if (j === undefined) continue
    const target = items[j] as {token: SearchToken & {currency?: CurrencyCode}; start: number; end: number; chip?: unknown}
    target.token.currency = it.token.code
    target.start = Math.min(target.start, it.start)
    target.end = Math.max(target.end, it.end)
    target.chip = {facet: 'amount'}
    items.splice(k, 1)
    k--
  }

  /* Join "A or B" into one alternatives token; "A and B" is just A, B. Dangling joiners are dropped. */
  const tokens: SearchToken[] = []
  const chips: Array<SearchChip | undefined> = []
  const spans: Array<[number, number]> = []
  let isJoining = false
  for (const item of items) {
    if (item === 'or') {
      isJoining = tokens.length > 0
      continue
    }
    if (item === 'and') continue
    const span: [number, number] = [item.start, item.end]
    if (isJoining) {
      const prev = tokens.pop()!
      const prevSpan = spans.pop()!
      chips.pop()
      const last = prev.kind === 'any' ? prev.options.at(-1)! : prev
      // "paid by riya or sam": the name after "or" is the same kind of facet.
      const next: SearchToken = last.kind === 'person' && item.token.kind === 'text' ? {...last, text: item.token.text, words: [item.token.text]} : item.token
      tokens.push(prev.kind === 'any' ? {kind: 'any', options: [...prev.options, next]} : {kind: 'any', options: [prev, next]})
      const joined: [number, number] = [prevSpan[0], span[1]]
      spans.push(joined)
      chips.push({facet: 'any', text: query.slice(joined[0], joined[1]), span: joined})
      isJoining = false
      continue
    }
    tokens.push(item.token)
    spans.push(span)
    chips.push(item.chip ? {...item.chip, text: query.slice(span[0], span[1]), span} : undefined)
  }
  return {tokens, chips: chips.filter((c): c is SearchChip => !!c)}

  /** `number` for a piece of a chunk (glued comparison, range or tilde). */
  function number2(text: string, i: number) {
    const folded = fold(text)
    const suffixed = SUFFIXED.exec(folded)
    const symbol = [...SYMBOLS].find(([s]) => text.includes(s))?.[1]
    if (suffixed) {
      const amounts = numberReadings(suffixed[1]!, mark)
      return amounts.length ? {amounts: scale(amounts, suffixed[2]!), used: 1, currency: symbol} : undefined
    }
    const amounts = numberReadings(folded, mark)
    if (amounts.length === 0) return undefined
    const next = at(i + 1)?.w
    // "> 1 lakh" glued to its operator: ">1 lakh" reads the following suffix word too.
    if (next && next.length > 1 && MULTIPLIER[next] && folded === text.toLowerCase()) return {amounts: scale(amounts, next), used: 2, currency: symbol}
    return {amounts, used: 1, currency: symbol}
  }
}

/** The query without one chip's words: removing a chip re-runs the search. */
export function removeChip(query: string, chip: SearchChip): string {
  return `${query.slice(0, chip.span[0])}${query.slice(chip.span[1])}`.replace(/\s{2,}/g, ' ').trim()
}
