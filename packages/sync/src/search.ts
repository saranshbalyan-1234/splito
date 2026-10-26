import {addDays, type CurrencyCode, DomainError, type LocalDate, parseAmount, sumByCurrency} from '@splito/domain'

import type {Expense, Group, Person} from './mutations'
import type {Entity} from './types'

/**
 * Free search across expenses, people and groups (BACKLOG F-1401).
 *
 * The index is built once per store change; a keystroke only looks words up
 * in a sorted vocabulary, amounts in per-currency sorted arrays and dates in
 * maps, so it never scans the ledger. Every query word must match (AND); a
 * word matches when any of its readings does (OR): "450" is the amount 450 in
 * any currency or the text "450", "march" is the month or the text.
 */

export type SearchToken =
  | {kind: 'text'; text: string}
  /** A plain number ("450", "12.50", "1,000"): an amount in each expense's own currency, or text. */
  | {kind: 'amount'; amount: string; text: string}
  | {kind: 'compare'; op: CompareOp; amount: string}
  /** "today" (0) or "yesterday" (-1). */
  | {kind: 'day'; offset: number; text: string}
  | {kind: 'month'; month: string; year?: string; text: string}

type CompareOp = '<' | '<=' | '>' | '>='

export interface SearchIndex {
  /** Live expenses, newest first; every index below points into this. */
  expenses: Entity<Expense>[]
  /** Sorted vocabulary and, for each word, the expenses it occurs in. */
  words: string[]
  postings: number[][]
  /** Per currency, totals ascending with the matching expense index. */
  amounts: Map<CurrencyCode, {totals: bigint[]; at: number[]}>
  /** Expense indexes by `YYYY-MM-DD`, `YYYY-MM`, `MM` and `YYYY`. */
  dates: Map<string, number[]>
  people: Array<{entity: Entity<Person>; words: string[]}>
  groups: Array<{entity: Entity<Group>; words: string[]}>
}

export interface SearchResults {
  expenses: Entity<Expense>[]
  people: Entity<Person>[]
  groups: Entity<Group>[]
  /** Matching expenses' totals, one per currency. */
  totals: Record<CurrencyCode, bigint>
  /** Folded query words to highlight. */
  terms: string[]
}

const MARKS = /[̀-ͯ]/g
const WORD = /[\p{L}\p{N}\p{M}]+/gu
const WORD_CHAR = /[\p{L}\p{N}\p{M}]/u
const COMPARE = /([<>]=?)\s*([^\s<>=]+)/g
/** "1,000" (grouping), "12,50" or "12.50" (decimal), with a leading currency sign allowed. */
const NUMBER = /^[^\p{L}\p{N}]*(\d{1,3}(?:,\d{3})+|\d+)(?:[.,](\d+))?$/u
const YEAR = /^(19|20)\d\d$/

/* English date words; the rest of a query is matched as written, in any script. */
const MONTH_NAMES = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']
const MONTHS: Record<string, string> = Object.fromEntries(
  MONTH_NAMES.flatMap((name, i) => {
    const mm = String(i + 1).padStart(2, '0')
    return [[name, mm], [name.slice(0, 3), mm], ...(name === 'september' ? [['sept', mm]] : [])]
  }),
)
const DAYS: Record<string, number> = {today: 0, yesterday: -1}

/** Lower case without accents, so "Pastéis" is found by "pasteis". */
function fold(s: string): string {
  return s.normalize('NFD').replace(MARKS, '').toLowerCase()
}

function wordsOf(s: string): string[] {
  return fold(s).match(WORD) ?? []
}

function plainNumber(s: string): string | undefined {
  const m = NUMBER.exec(s)
  if (!m) return undefined
  return m[1]!.replaceAll(',', '') + (m[2] ? '.' + m[2] : '')
}

export function parseSearchQuery(query: string): SearchToken[] {
  const compares: SearchToken[] = []
  const rest = fold(query).replace(COMPARE, (_, op: CompareOp, num: string) => {
    const amount = plainNumber(num)
    if (!amount) return ` ${num} `
    compares.push({kind: 'compare', op, amount})
    return ' '
  })
  const tokens = compares
  const chunks = rest.split(/\s+/).filter(Boolean)
  for (let i = 0; i < chunks.length; i++) {
    const amount = plainNumber(chunks[i]!)
    if (amount) {
      tokens.push({kind: 'amount', amount, text: amount})
      continue
    }
    for (const word of chunks[i]!.match(WORD) ?? []) {
      const month = MONTHS[word]
      const offset = DAYS[word]
      if (month) {
        const next = chunks[i + 1]
        if (next && YEAR.test(next)) {
          tokens.push({kind: 'month', month, year: next, text: word})
          i++
        } else tokens.push({kind: 'month', month, text: word})
      } else if (offset !== undefined) tokens.push({kind: 'day', offset, text: word})
      else tokens.push({kind: 'text', text: word})
    }
  }
  return tokens
}

function push<K>(map: Map<K, number[]>, key: K, i: number) {
  const list = map.get(key)
  if (!list) map.set(key, [i])
  else if (list[list.length - 1] !== i) list.push(i)
}

/** Builds the index; run it when the store changes, never per keystroke. */
export function buildSearchIndex({
  expenses,
  people,
  groups,
  categories,
}: {
  expenses: Entity<Expense>[]
  people: Entity<Person>[]
  groups: Entity<Group>[]
  categories: ReadonlyArray<{id: string; name: string}>
}): SearchIndex {
  const order = expenses.map((e, i) => ({e, i})).filter(({e}) => !e.deleted)
  // Newest first; on the same day the later-added one.
  order.sort((x, y) => (x.e.data.date === y.e.data.date ? y.i - x.i : x.e.data.date < y.e.data.date ? 1 : -1))
  const live = order.map(({e}) => e)

  const names = new Map(people.map(p => [p.id, p.data.name]))
  const groupNames = new Map(groups.map(g => [g.id, g.data.name]))
  const categoryNames = new Map(categories.map(c => [c.id, c.name]))

  const vocab = new Map<string, number[]>()
  const dates = new Map<string, number[]>()
  const byCurrency = new Map<CurrencyCode, Array<{total: bigint; i: number}>>()
  live.forEach((e, i) => {
    const d = e.data
    const text = [d.title, d.notes, categoryNames.get(d.category) ?? d.category, d.groupId ? groupNames.get(d.groupId) : '']
    if (d.split.mode === 'items') for (const item of d.split.items) text.push(item.name ?? '')
    for (const id of new Set([...Object.keys(d.payers), ...Object.keys(d.shares)])) text.push(names.get(id) ?? '')
    for (const word of wordsOf(text.join(' '))) push(vocab, word, i)
    for (const key of [d.date, d.date.slice(0, 7), d.date.slice(5, 7), d.date.slice(0, 4)]) push(dates, key, i)
    const list = byCurrency.get(d.currency) ?? []
    list.push({total: d.total, i})
    byCurrency.set(d.currency, list)
  })

  const words = [...vocab.keys()].sort()
  const amounts = new Map<CurrencyCode, {totals: bigint[]; at: number[]}>()
  for (const [currency, list] of byCurrency) {
    list.sort((x, y) => (x.total < y.total ? -1 : x.total > y.total ? 1 : 0))
    amounts.set(currency, {totals: list.map(x => x.total), at: list.map(x => x.i)})
  }

  return {
    expenses: live,
    words,
    postings: words.map(w => vocab.get(w)!),
    amounts,
    dates,
    people: people.filter(p => !p.deleted && !p.data.isMe).map(entity => ({entity, words: wordsOf(entity.data.name)})),
    groups: groups.filter(g => !g.deleted).map(entity => ({entity, words: wordsOf(entity.data.name)})),
  }
}

/** First position in sorted `xs` not below `x` (or above it, when `after`). */
function bound<T>(xs: T[], x: T, after: boolean): number {
  let lo = 0
  let hi = xs.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (xs[mid]! < x || (after && xs[mid] === x)) lo = mid + 1
    else hi = mid
  }
  return lo
}

function addPrefix(index: SearchIndex, prefix: string, out: Set<number>) {
  for (let w = bound(index.words, prefix, false); w < index.words.length && index.words[w]!.startsWith(prefix); w++)
    for (const i of index.postings[w]!) out.add(i)
}

function addAmount(index: SearchIndex, amount: string, op: CompareOp | '=', out: Set<number>) {
  for (const [currency, {totals, at}] of index.amounts) {
    let minor: bigint
    try {
      minor = parseAmount(amount, currency)
    } catch (e) {
      // "12.50" is no amount in yen.
      if (e instanceof DomainError) continue
      throw e
    }
    const lo = bound(totals, minor, false)
    const hi = bound(totals, minor, true)
    const [from, to] = op === '=' ? [lo, hi] : op === '>' ? [hi, totals.length] : op === '>=' ? [lo, totals.length] : op === '<' ? [0, lo] : [0, hi]
    for (let k = from; k < to; k++) out.add(at[k]!)
  }
}

function addDate(index: SearchIndex, key: string, out: Set<number>) {
  for (const i of index.dates.get(key) ?? []) out.add(i)
}

function matches(token: SearchToken, index: SearchIndex, today: LocalDate): Set<number> {
  const out = new Set<number>()
  switch (token.kind) {
    case 'compare':
      addAmount(index, token.amount, token.op, out)
      return out
    case 'amount':
      addAmount(index, token.amount, '=', out)
      if (YEAR.test(token.amount)) addDate(index, token.amount, out)
      break
    case 'day':
      addDate(index, addDays(today, token.offset), out)
      break
    case 'month':
      addDate(index, token.year ? `${token.year}-${token.month}` : token.month, out)
      break
    case 'text':
      break
  }
  addPrefix(index, token.text, out)
  return out
}

function nameMatches(words: string[], tokens: SearchToken[]): boolean {
  return tokens.every(t => 'text' in t && words.some(w => w.startsWith(t.text)))
}

const EMPTY: SearchResults = {expenses: [], people: [], groups: [], totals: {}, terms: []}

export function search(index: SearchIndex, query: string, {today}: {today: LocalDate}): SearchResults {
  const tokens = parseSearchQuery(query)
  if (tokens.length === 0) return EMPTY
  // Intersect from the smallest set so a broad word costs little.
  const sets = tokens.map(t => matches(t, index, today)).sort((x, y) => x.size - y.size)
  const hits = [...sets[0]!].filter(i => sets.every(s => s.has(i))).sort((x, y) => x - y)
  const expenses = hits.map(i => index.expenses[i]!)
  return {
    expenses,
    people: index.people.filter(p => nameMatches(p.words, tokens)).map(p => p.entity),
    groups: index.groups.filter(g => nameMatches(g.words, tokens)).map(g => g.entity),
    totals: sumByCurrency(expenses.map(e => ({currency: e.data.currency, amount: e.data.total}))),
    terms: tokens.flatMap(t => ('text' in t ? [t.text] : [])),
  }
}

/** Where `terms` start words of `text`, as `[start, end)` ranges into the original text. */
export function highlightRanges(text: string, terms: string[]): Array<[number, number]> {
  if (terms.length === 0) return []
  let folded = ''
  const at: number[] = []
  for (let i = 0; i < text.length; i++) {
    const f = fold(text[i]!)
    for (let j = 0; j < f.length; j++) {
      folded += f[j]
      at.push(i)
    }
  }
  const ranges: Array<[number, number]> = []
  for (let p = 0; p < folded.length; p++) {
    if (p > 0 && WORD_CHAR.test(folded[p - 1]!)) continue
    const len = Math.max(0, ...terms.filter(term => term && folded.startsWith(term, p)).map(term => term.length))
    if (len === 0) continue
    ranges.push([at[p]!, at[p + len - 1]! + 1])
    p += len - 1
  }
  return ranges
}
