import {addDays, type CurrencyCode, DomainError, type LocalDate, parseAmount, periodRange, sumByCurrency, type WeekStart} from '@splito/domain'

import {type Comment} from './comments'
import {listOpenDisputes} from './disputes'
import {displayPerson, type Expense, type Group, isGroupInactive, type Person, type Repayment, type WriteOff} from './mutations'
import {type Key} from './schema'
import {type CompareOp, parseQuery, type ParsedQuery, type SearchChip, type SearchStatus, type SearchToken, type SearchType} from './searchQuery'
import {amountBounds, amountOfTerm, amountTerm, dateTerm, eachTerm, fold, NO_GROUP, RECORD_TYPES, type RecordType, type SearchTerm, type TermKind, wordsOf} from './searchTerms'
import {type Store} from './store'
import {type Entity} from './types'

/**
 * Free search across expenses, payments, write-offs, comments, people and groups (BACKLOG F-246, ARCHITECTURE 9.8
 * and 26.19). A query is resolved from the `search_terms` keys: each token becomes the set of record ids its key
 * ranges hold (a word, an amount range, a month, a payer, a group's records, a status ...), and the sets are
 * intersected (AND across tokens, OR inside one facet). Each token is first probed within a small budget of keys: when
 * some are narrow, their intersection (at most SMALL records) is read by id, the broad tokens are checked on those rows
 * in hand, and the order, count and totals come from the rows. When every token is broad, the first page of each
 * section comes from a newest-first walk over the rows with every token checked in hand, and the count, the totals
 * (from the `d` and `a` keys) and the later pages come after it (F-266). Only the rows shown are read (a page at a time
 * through `step` / `stepPayments`). A person's or group's name is not copied onto its records, so a word is resolved
 * to the live people and groups it names first and then to their records (`h`, `G` keys); contact and UPI words (`k`)
 * list the person and never their records.
 */
export {type SearchToken} from './searchQuery'

/** What the matching expenses add up to: how many, and one total per currency. */
export interface SearchSummary {
  count: number
  totals: Record<CurrencyCode, bigint>
}

/**
 * One query's search, readable a page at a time: the people and groups (few, known at once), and the matching payments
 * and expenses, newest first, each paged; `step` reads the next rows. A narrow query knows its counts and totals at
 * once; a broad one knows them after `whenCounted()` (its first pages come first, from a walk, F-266).
 */
export interface SearchSession {
  people: Entity<Person>[]
  groups: Entity<Group>[]
  /** How many payments and write-offs match (until `isCounted()`, the ones read so far). */
  readonly paymentCount: number
  /** Folded query words to highlight. */
  terms: string[]
  /** The recognised facets, for the removable chips. */
  chips: SearchChip[]
  /** The tokens the query was read as (the result rows say which field matched with them). */
  tokens: SearchToken[]
  /**
   * How many expenses match (a deleted one counts as a row) and what they add up to, per currency. Until `isCounted()`
   * (a broad query, whose first pages come from a walk) the count is the rows read so far and the totals are empty.
   */
  readonly summary: SearchSummary
  /** True once `summary` and `paymentCount` are the whole answer's. */
  isCounted(): boolean
  /** Works out the count and the totals (a broad query reads its full key sets for them) and resolves once they are known. */
  whenCounted(): Promise<void>
  /** The rows read so far, newest first (same day: the later-created first); a prefix of the whole answer. */
  found(): Entity<Expense>[]
  /** The text of the comment that matched, for an expense or payment found through one. */
  commentText(id: string): string | undefined
  /** True once every matching expense has been read: `found()` is then all of them. */
  isDone(): boolean
  /** Reads the next page of rows. Calls overlap safely (they share the read in flight). */
  step(): Promise<void>
  /** The payments and write-offs read so far, newest first (their own pages, like the expenses). */
  foundPayments(): Entity<Repayment | WriteOff>[]
  isPaymentsDone(): boolean
  stepPayments(): Promise<void>
}

export interface SearchResults {
  expenses: Entity<Expense>[]
  people: Entity<Person>[]
  groups: Entity<Group>[]
  /** Every matching payment and write-off, newest first. */
  payments: Entity<Repayment | WriteOff>[]
  /** Matching expenses' totals, one per currency. */
  totals: Record<CurrencyCode, bigint>
  /** Folded query words to highlight. */
  terms: string[]
}

/** Splits a query into tokens (English and Hindi words, amounts with shorthand, dates, people, statuses). */
export function parseSearchQuery(query: string, mark: '.' | ',' = '.'): SearchToken[] {
  return parseQuery(query, {mark}).tokens
}

/** Expenses shown per page of results. */
export const SEARCH_PAGE = 30
/** More rows than any one key range holds: "all of them" for one range read. */
const ALL = 1_000_000
const WORD_CHAR = /[\p{L}\p{N}\p{M}]/u
/**
 * An answer of at most this many records is read by id and ordered, totalled and status-checked from its rows (about
 * 7 us a row); a larger one is ordered and totalled from the date and amount keys (about 1 us a key over the whole
 * ledger). 500 rows cost about what 3,500 keys do, and bound the narrow path whatever the ledger's size.
 */
const SMALL = 500
/**
 * Keys a token may read while it is probed for narrowness: past this it is broad and is checked on rows instead. A record
 * a token finds twice (two of its people) counts twice, so a narrow token can read as broad: then it is only slower.
 */
const PROBE_KEYS = SMALL
/**
 * Rows a broad query's first page may walk, per section (expenses; payments and write-offs). A row checked in hand
 * costs about 15-25 times a key, so 1,000 rows cost about what the whole answer's keys do on a 10,000-record ledger;
 * matches too rare to fill a page within them are given up on early (`walk`), after a few chunks.
 */
const WALK_ROWS = 1_000
/** A longer typed name is never spelled close to anyone's (and the edit distance grows with the square of it). */
const FUZZY_MAX = 20
/** The term kinds whose keys are records (the others are people and groups). */
const RECORD_KINDS = new Set<TermKind>(['w', 'a', 'm', 'c', 'b', 'h', 'G', 'd', 's', 'n'])
type Rec = Expense | Repayment | WriteOff
/** Sorts after any term. */
const END = '\uffff'

type Category = {id: string; name: string}

/** `mark` is the number locale's decimal mark (`decimalMark`), so "1.000" means what the user's format says. */
export interface SearchOptions {
  today: LocalDate
  mark?: '.' | ','
  /** The user's categories, by id (names are preferences, so they are not stored on expenses). */
  categories?: ReadonlyArray<Category>
  /** My person id: "paid by me", and which side of a balance "owed" means. */
  me?: string
  /** The groups and the deleted records I have hidden from my lists (`groups.hidden`, `lists.hiddenItems`). */
  hiddenGroups?: ReadonlyArray<string>
  hiddenItems?: ReadonlyArray<string>
  /** The first day of a week for "this week" / "last week" (the `weekStart` preference: 0 Sunday, 1 Monday, 6 Saturday). */
  weekStart?: WeekStart
  /** @internal Tests: the rows a broad query's first page may walk, per section (WALK_ROWS). */
  walkRows?: number
}

const startsWith = (words: readonly string[], prefix: string) => words.some(w => w.startsWith(prefix))

/** The amount a typed number means in one currency, or null (a yen has no cents). Zeros after the last decimal digit change no value. */
export function minorOf(typed: string, currency: CurrencyCode): bigint | null {
  const amount = typed.includes('.') ? typed.replace(/\.?0+$/, '') : typed
  try {
    return parseAmount(amount, currency)
  } catch (e) {
    if (e instanceof DomainError) return null
    throw e
  }
}

/** Edit distance, for a name typed with a slip ("rhiya" for "riya"). */
function distance(a: string, b: string): number {
  let prev = Array.from({length: b.length + 1}, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const row = [i]
    for (let j = 1; j <= b.length; j++) row[j] = Math.min(prev[j]! + 1, row[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1))
    prev = row
  }
  return prev[b.length]!
}

const intersect = (a: Set<string>, b: Set<string>) => {
  const [small, big] = a.size <= b.size ? [a, b] : [b, a]
  const out = new Set<string>()
  for (const id of small) if (big.has(id)) out.add(id)
  return out
}

/** The words of a token that are text to find (highlighted in the results). */
function wordsOfToken(t: SearchToken): string[] {
  switch (t.kind) {
    case 'text':
    case 'amount':
    case 'day':
    case 'month':
    case 'person':
    case 'place':
      return [t.text]
    case 'any':
      return t.options.flatMap(wordsOfToken)
    default:
      return []
  }
}

const EMPTY: SearchSession = {
  people: [],
  groups: [],
  paymentCount: 0,
  terms: [],
  chips: [],
  tokens: [],
  summary: {count: 0, totals: {}},
  isCounted: () => true,
  whenCounted: async () => undefined,
  found: () => [],
  commentText: () => undefined,
  isDone: () => true,
  step: async () => undefined,
  foundPayments: () => [],
  isPaymentsDone: () => true,
  stepPayments: async () => undefined,
}

/**
 * Starts a search. The people and groups are ready in the session; the first page of expenses and of payments is read
 * before this returns, and `step()` / `stepPayments()` read the next. The counts and totals are known at once for a
 * narrow query, and after `whenCounted()` for a broad one.
 */
export async function openSearch(store: Store, query: string, options: SearchOptions): Promise<SearchSession> {
  const first = await run(store, parseQuery(query, {mark: options.mark}), options)
  // A first page is empty only when nothing matches (a walk that finds nothing waits for the whole answer).
  const isEmpty = (s: SearchSession) => s.people.length + s.groups.length + s.found().length + s.foundPayments().length === 0
  // "Group dinner" or "settled bill": a status or type word that found nothing was meant as text.
  if (isEmpty(first) && first.chips.some(c => c.facet === 'status' || c.facet === 'type')) {
    const literal = await run(store, parseQuery(query, {mark: options.mark, isLiteral: true}), options)
    if (!isEmpty(literal)) return literal
  }
  return first
}

/**
 * A type word that is part of a name ("Bulk Friend 4", "Office group") is the name, not the type: when the query's
 * words together start the words of one person's or group's name, its type words are read as plain words and their
 * chips dropped. Alone ("friends", "groups in goa") a type word still narrows by kind.
 */
async function asNames(store: Store, parsed: ParsedQuery): Promise<ParsedQuery> {
  const isTypeWord = (t: SearchToken) => t.kind === 'type' && t.type !== 'comment'
  if (!parsed.tokens.some(isTypeWord) || !parsed.tokens.some(t => t.kind === 'text' || t.kind === 'amount')) return parsed
  const words = parsed.tokens.flatMap(t => (t.kind === 'text' || t.kind === 'amount' ? [t.text] : t.kind === 'type' && isTypeWord(t) ? [t.word] : []))
  for (const kind of ['p', 'g'] as const) {
    let ids: Set<string> | undefined
    for (const w of words) {
      const hit = new Set((await store.terms({kind, min: w, max: w + END})).map(r => r.entityId))
      ids = ids ? intersect(ids, hit) : hit
      if (ids.size === 0) break
    }
    if (ids?.size)
      return {
        tokens: parsed.tokens.map(t => (t.kind === 'type' && isTypeWord(t) ? {kind: 'text', text: t.word} : t)),
        chips: parsed.chips.filter(c => !(c.facet === 'type' && c.type !== 'comment')),
      }
  }
  return parsed
}

/** Thrown by a key read that went over its budget: the token names too many records to be read as a set. */
const TOO_BROAD = Symbol('too broad')

/** What a record can be found by, from its own terms (`eachTerm`, what its keys hold): a row in hand checked the way its keys would be. */
interface View {
  id: string
  w: string[]
  a?: string
  m?: string
  c?: string
  b: string[]
  h: string[]
  G?: string
  d?: string
  isDeleted: boolean
}
const views = new WeakMap<Entity<Rec>, View>()
function viewOf(r: Entity<Rec>): View {
  let v = views.get(r)
  if (v) return v
  const out: View = {id: r.id, w: [], b: [], h: [], isDeleted: false}
  // The record's own terms only (a comment's are another entity's), without building the stored rows.
  eachTerm(r, (kind, term) => {
    if (!term) return
    if (kind === 'w') out.w.push(term)
    else if (kind === 'b') out.b.push(term)
    else if (kind === 'h') out.h.push(term)
    else if (kind === 's') out.isDeleted = true
    else if (kind === 'a' || kind === 'm' || kind === 'c' || kind === 'G' || kind === 'd') out[kind] = term
  })
  views.set(r, out)
  return out
}
/** A token as a check on a row in hand: true exactly when the token's key ranges hold the record. */
type Test = (v: View) => boolean
const anyOf = (tests: Test[]): Test => v => tests.some(f => f(v))
const allOf = (tests: Test[]): Test => v => tests.every(f => f(v))

/** The newest-first walk's matches: a prefix of the whole answer, in its order (`isAll`: the whole answer). */
interface Walk {
  rows: Entity<Rec>[]
  isAll: boolean
}

/** A section's answer: the ids in list order. */
interface Answer {
  expenseIds: string[]
  paymentIds: string[]
  totals: Record<CurrencyCode, bigint>
}

async function run(store: Store, parsed: ParsedQuery, options: SearchOptions): Promise<SearchSession> {
  if (parsed.tokens.length === 0) return EMPTY
  const {tokens, chips} = await asNames(store, parsed)
  const {today, categories = [], me, weekStart = 1} = options

  /** The kind of every record a key read named: a small answer reads its rows by id from the right store. */
  const typeOf = new Map<string, RecordType>()
  /** The comment (id) a record was found through, by the record. */
  const commentOf = new Map<string, string>()
  const idsOf = (rows: SearchTerm[]) => rows.map(r => r.entityId)
  const liveGroups = async (ids: Iterable<string>) => (await store.getMany<Group>('group', [...new Set(ids)])).filter(g => !g.deleted)
  const livePeople = async (ids: Iterable<string>) => (await store.getMany<Person>('person', [...new Set(ids)])).filter(p => !p.deleted)
  /** People and group words (never records): few keys, read whole. */
  const named = (kind: 'p' | 'g', p: string) => store.terms({kind, min: p, max: p + END})

  /** The currencies that have a record: a skip scan of the amount keys, one read each. */
  let currencyList: Promise<CurrencyCode[]> | undefined
  const knownCurrencies = () =>
    (currencyList ??= (async () => {
      const out: CurrencyCode[] = []
      for (let min = ''; ; ) {
        const [first] = await store.terms({kind: 'a', min, limit: 1})
        if (!first) return out
        const currency = first.term.slice(0, first.term.indexOf(':'))
        out.push(currency)
        min = `${currency};`
      }
    })())

  /** `each` reading of a typed number, in the currency: its minor units, or none. */
  const minors = (readings: string[], currency: CurrencyCode) => readings.map(r => minorOf(r, currency)).filter((m): m is bigint => m !== null)
  type Bounds = (currency: CurrencyCode) => Array<[bigint | null, bigint | null]>
  const compareBounds = (readings: string[], op: CompareOp | '='): Bounds => currency =>
    minors(readings, currency).map(m => (op === '=' ? [m, m] : op === '>' ? [m + 1n, null] : op === '>=' ? [m, null] : op === '<' ? [null, m - 1n] : [null, m]))
  /** The amount ranges an amount token means, per currency. */
  function boundsOf(token: Extract<SearchToken, {kind: 'amount' | 'compare' | 'between' | 'around'}>): Bounds {
    switch (token.kind) {
      case 'amount':
        return compareBounds(token.amounts, '=')
      case 'compare':
        return compareBounds(token.amounts, token.op)
      case 'between':
        return currency => {
          const out: Array<[bigint | null, bigint | null]> = []
          for (const from of minors(token.from, currency)) for (const to of minors(token.to, currency)) out.push(from <= to ? [from, to] : [to, from])
          return out
        }
      case 'around':
        return currency => minors(token.amounts, currency).map(m => [(m * 9n) / 10n, (m * 11n) / 10n])
    }
  }
  const isYear = (text: string) => /^(19|20)\d\d$/.test(text)
  /** "4 march": that day of the year given, else the latest one that is not after today. */
  function dayOfMonth(token: Extract<SearchToken, {kind: 'month'}>): string {
    let year = token.year ?? today.slice(0, 4)
    if (!token.year && `${year}-${token.month}-${token.day}` > today) year = String(Number(year) - 1)
    return `${year}-${token.month}-${token.day}`
  }

  /** The live people a typed name can mean: the name words it starts, else a close spelling with the same first letter. */
  async function peopleNamed(text: string): Promise<string[]> {
    if (text === 'me') return me ? [me] : []
    let ids = idsOf(await named('p', text))
    if (ids.length === 0 && text.length >= 4 && text.length <= FUZZY_MAX) {
      const limit = text.length >= 7 ? 2 : 1
      ids = (await named('p', text[0]!)).filter(r => distance(r.term.slice(0, text.length), text) <= limit).map(r => r.entityId)
    }
    return (await livePeople(ids)).map(p => p.id)
  }

  let ledger: Promise<LedgerStatus> | undefined
  const ledgerStatus = () => (ledger ??= statusOfLedger(store, me))

  /* ------------------------------------------------------------------ */
  /* One token -> the ids of the records it can match                    */
  /* ------------------------------------------------------------------ */

  /**
   * The key reads of a token. With a budget (keys of records that may still be read), every record read is capped to
   * what is left and the reads run one at a time, and going over throws TOO_BROAD: probing a broad token costs about
   * its budget, never its whole set.
   */
  function keys(budget?: {left: number}) {
    const hits = async (kind: SearchTerm['kind'], min?: string, max = min) => {
      const isRecord = RECORD_KINDS.has(kind)
      if (budget && isRecord && budget.left < 0) throw TOO_BROAD
      const rows = await store.terms({kind, min, max, limit: budget && isRecord ? budget.left + 1 : undefined})
      if (budget && isRecord && (budget.left -= rows.length) < 0) throw TOO_BROAD
      if (isRecord) for (const r of rows) typeOf.set(r.entityId, r.entityType as RecordType)
      return rows
    }
    /** All at once, or (with a budget) one at a time so that the first broad read stops the rest. */
    const each = async <T, R>(items: readonly T[], fn: (x: T) => Promise<R>): Promise<R[]> => {
      if (!budget) return Promise.all(items.map(fn))
      const out: R[] = []
      for (const x of items) out.push(await fn(x))
      return out
    }
    const prefix = (kind: SearchTerm['kind'], p: string) => hits(kind, p, p + END)
    /** The records of each key value (a group's, a person's). */
    async function recordsOf(kind: 'G' | 'h' | 'b', values: Iterable<string>): Promise<Set<string>> {
      const out = new Set<string>()
      for (const rows of await each([...new Set(values)], v => hits(kind, v))) for (const r of rows) out.add(r.entityId)
      return out
    }
    /** Records whose amount lies in one of the ranges, in the given currency, or in any. */
    async function amountsIn(currency: CurrencyCode | undefined, bounds: Bounds): Promise<Set<string>> {
      const ranges: Array<{min: string; max: string}> = []
      for (const c of currency ? [currency] : await knownCurrencies()) {
        const [first, last] = amountBounds(c)
        for (const [lo, hi] of bounds(c)) ranges.push({min: lo === null ? first : amountTerm(c, lo), max: hi === null ? last : amountTerm(c, hi)})
      }
      const out = new Set<string>()
      for (const rows of await each(ranges, r => hits('a', r.min, r.max))) for (const r of rows) out.add(r.entityId)
      return out
    }
    const dateIds = async (from: string, to: string) => new Set(idsOf(await hits('d', from, `${to}:${END}`)))

    /**
     * Records with a word or a comment word that starts with `p`, in a group whose name or place does, with a person
     * whose name does (never me: every record is mine), or in a category whose name does. Contact and UPI words (`k`)
     * find the person only, never their records.
     */
    async function textIds(p: string): Promise<Set<string>> {
      const out = new Set<string>()
      const [own, comments] = await each(['w', 'n'] as const, k => prefix(k, p))
      const [groupHits, personHits] = await Promise.all([named('g', p), named('p', p)])
      for (const r of own!) out.add(r.entityId)
      for (const r of comments!) {
        out.add(r.entityId)
        commentOf.set(r.entityId, r.term.slice(r.term.indexOf('\u0000') + 1))
      }
      const [groups, people] = await Promise.all([liveGroups(idsOf(groupHits)), livePeople(idsOf(personHits))])
      const others = people.filter(x => !x.data.isMe)
      const lists: Array<() => Promise<Set<string>>> = [
        () => recordsOf('G', groups.map(g => g.id)),
        () => recordsOf('h', others.map(x => x.id)),
        ...categories.filter(c => startsWith(wordsOf(c.name), p)).map(c => async () => new Set(idsOf(await hits('c', c.id)))),
      ]
      for (const set of await each(lists, f => f())) for (const id of set) out.add(id)
      return out
    }

    /** A phrase nobody matched ("with friends") is just its words. */
    async function wordsIds(words: string[]): Promise<Set<string>> {
      let out: Set<string> | undefined
      for (const w of words) {
        const set = await textIds(w)
        out = out ? intersect(out, set) : set
      }
      return out ?? new Set()
    }

    async function statusIds(status: SearchStatus): Promise<Set<string>> {
      switch (status) {
        case 'deleted':
          return new Set(idsOf(await hits('s', 'deleted')))
        case 'disputed': {
          const out = new Set<string>()
          let after: Key | null = null
          do {
            const page: Awaited<ReturnType<typeof listOpenDisputes>> = await listOpenDisputes(store, {after})
            for (const d of page.items) {
              out.add(d.data.targetId)
              typeOf.set(d.data.targetId, d.data.targetType)
            }
            after = page.next
          } while (after)
          return out
        }
        case 'hidden': {
          const out = await recordsOf('G', options.hiddenGroups ?? [])
          for (const id of options.hiddenItems ?? []) out.add(id)
          return out
        }
        case 'inactive':
          return recordsOf('G', (await ledgerStatus()).inactiveGroups)
        default: {
          const l = await ledgerStatus()
          const groups = status === 'settled' ? l.settledGroups : status === 'owed' ? l.owedGroups : l.oweGroups
          const out = await recordsOf('G', groups)
          // Outside any group a record is about its people: their direct balance with me.
          const outside = new Set(idsOf(await hits('G', NO_GROUP)))
          const people = status === 'settled' ? l.unsettledPeople : status === 'owed' ? l.owedPeople : l.owePeople
          const touched = await recordsOf('h', people)
          for (const id of outside) if (status === 'settled' ? !touched.has(id) : touched.has(id)) out.add(id)
          return out
        }
      }
    }

    async function resolve(token: SearchToken): Promise<Set<string>> {
      switch (token.kind) {
        case 'text':
          return textIds(token.text)
        case 'compare':
        case 'between':
        case 'around':
          return amountsIn(token.currency, boundsOf(token))
        case 'amount': {
          const out = await amountsIn(token.currency, boundsOf(token))
          // A number is also a word, and a year is also a date.
          for (const id of await textIds(token.text)) out.add(id)
          if (isYear(token.text)) for (const id of await dateIds(`${token.text}-01-01`, `${token.text}-12-31`)) out.add(id)
          return out
        }
        case 'day': {
          const day = addDays(today, token.offset)
          const out = await dateIds(day, day)
          for (const id of await textIds(token.text)) out.add(id)
          return out
        }
        case 'month': {
          if (token.day) {
            const day = dayOfMonth(token)
            return dateIds(day, day)
          }
          const out = token.year ? await dateIds(`${token.year}-${token.month}-01`, `${token.year}-${token.month}-31`) : new Set(idsOf(await hits('m', token.month)))
          for (const id of await textIds(token.text)) out.add(id)
          return out
        }
        case 'period': {
          const {from, to} = periodRange(token.unit, today, weekStart, token.offset)
          return dateIds(from, to)
        }
        case 'person': {
          const people = await peopleNamed(token.text)
          return people.length ? recordsOf(token.role === 'payer' ? 'b' : 'h', people) : wordsIds(token.words)
        }
        case 'place': {
          const own = await prefix('w', token.text)
          const out = await recordsOf('G', (await liveGroups(idsOf(await named('g', token.text)))).map(g => g.id))
          for (const r of own) out.add(r.entityId)
          return out.size ? out : wordsIds(token.words)
        }
        case 'currency':
          return new Set(idsOf(await hits('a', ...amountBounds(token.code))))
        case 'status':
          return statusIds(token.status)
        case 'type':
          // A type narrows by record kind below; a comment type keeps the records that have one.
          return token.type === 'comment' ? new Set(idsOf(await hits('n', '', END))) : new Set()
        case 'any': {
          const out = new Set<string>()
          for (const set of await each(token.options, resolve)) for (const id of set) out.add(id)
          return out
        }
      }
    }
    return resolve
  }
  const resolve = keys()

  /** The ids a token finds when they are few (at most SMALL, read within a budget of PROBE_KEYS keys); undefined when it is broad. */
  async function probe(token: SearchToken): Promise<Set<string> | undefined> {
    try {
      const set = await keys({left: PROBE_KEYS})(token)
      return set.size <= SMALL ? set : undefined
    } catch (e) {
      if (e === TOO_BROAD) return undefined
      throw e
    }
  }

  /* ------------------------------------------------------------------ */
  /* One token -> a check on a row in hand (the same answer as its keys) */
  /* ------------------------------------------------------------------ */

  /** What a word finds besides the records' own words: the people, groups and categories it names, and the records whose comments have it. */
  async function namedBy(p: string) {
    const [comments, groupHits, personHits] = await Promise.all([store.terms({kind: 'n', min: p, max: p + END}), named('g', p), named('p', p)])
    for (const r of comments) commentOf.set(r.entityId, r.term.slice(r.term.indexOf('\u0000') + 1))
    const [groups, people] = await Promise.all([liveGroups(idsOf(groupHits)), livePeople(idsOf(personHits))])
    return {
      commented: new Set(idsOf(comments)),
      groups: new Set(groups.map(g => g.id)),
      people: new Set(people.filter(x => !x.data.isMe).map(x => x.id)),
      categories: new Set(categories.filter(c => startsWith(wordsOf(c.name), p)).map(c => c.id)),
    }
  }
  async function textTest(p: string): Promise<Test> {
    const n = await namedBy(p)
    return v => n.commented.has(v.id) || v.w.some(w => w.startsWith(p)) || (!!v.G && n.groups.has(v.G)) || v.h.some(x => n.people.has(x)) || (!!v.c && n.categories.has(v.c))
  }
  const wordsTest = async (words: string[]): Promise<Test> => (words.length ? allOf(await Promise.all(words.map(textTest))) : () => false)
  /** In one of the ranges, in the given currency, or in the record's own one (which is among the known currencies). */
  const amountTest =
    (currency: CurrencyCode | undefined, bounds: Bounds): Test =>
    ({a}) => {
      if (!a) return false
      const c = a.slice(0, a.indexOf(':'))
      if (currency && c !== currency) return false
      const [first, last] = amountBounds(c)
      return bounds(c).some(([lo, hi]) => a >= (lo === null ? first : amountTerm(c, lo)) && a <= (hi === null ? last : amountTerm(c, hi)))
    }
  const dateTest =
    (from: string, to: string): Test =>
    ({d}) =>
      !!d && d >= from && d <= `${to}:${END}`

  async function statusTest(token: Extract<SearchToken, {kind: 'status'}>): Promise<Test> {
    switch (token.status) {
      case 'deleted':
        return v => v.isDeleted
      case 'disputed': {
        const ids = await resolve(token)
        return v => ids.has(v.id)
      }
      case 'hidden': {
        const groups = new Set(options.hiddenGroups ?? [])
        const items = new Set(options.hiddenItems ?? [])
        return v => (!!v.G && groups.has(v.G)) || items.has(v.id)
      }
      case 'inactive': {
        const groups = new Set((await ledgerStatus()).inactiveGroups)
        return v => !!v.G && groups.has(v.G)
      }
      default: {
        const {status} = token
        const l = await ledgerStatus()
        const groups = new Set(status === 'settled' ? l.settledGroups : status === 'owed' ? l.owedGroups : l.oweGroups)
        const people = new Set(status === 'settled' ? l.unsettledPeople : status === 'owed' ? l.owedPeople : l.owePeople)
        return v => (v.G === NO_GROUP ? (status === 'settled' ? !v.h.some(p => people.has(p)) : v.h.some(p => people.has(p))) : !!v.G && groups.has(v.G))
      }
    }
  }

  async function testOf(token: SearchToken): Promise<Test> {
    switch (token.kind) {
      case 'text':
        return textTest(token.text)
      case 'compare':
      case 'between':
      case 'around':
        return amountTest(token.currency, boundsOf(token))
      case 'amount': {
        const tests = [amountTest(token.currency, boundsOf(token)), await textTest(token.text)]
        if (isYear(token.text)) tests.push(dateTest(`${token.text}-01-01`, `${token.text}-12-31`))
        return anyOf(tests)
      }
      case 'day': {
        const day = addDays(today, token.offset)
        return anyOf([dateTest(day, day), await textTest(token.text)])
      }
      case 'month': {
        if (token.day) {
          const day = dayOfMonth(token)
          return dateTest(day, day)
        }
        const month: Test = token.year ? dateTest(`${token.year}-${token.month}-01`, `${token.year}-${token.month}-31`) : v => v.m === token.month
        return anyOf([month, await textTest(token.text)])
      }
      case 'period': {
        const {from, to} = periodRange(token.unit, today, weekStart, token.offset)
        return dateTest(from, to)
      }
      case 'person': {
        const people = new Set(await peopleNamed(token.text))
        if (people.size === 0) return wordsTest(token.words)
        return token.role === 'payer' ? v => v.b.some(x => people.has(x)) : v => v.h.some(x => people.has(x))
      }
      case 'place': {
        const groups = (await liveGroups(idsOf(await named('g', token.text)))).map(g => g.id)
        // As the keys: the place's records, or (none at all) the typed words.
        const found = await Promise.all([store.terms({kind: 'w', min: token.text, max: token.text + END, limit: 1}), ...groups.map(g => store.terms({kind: 'G', min: g, max: g, limit: 1}))])
        if (!found.some(rows => rows.length)) return wordsTest(token.words)
        const inGroup = new Set(groups)
        return v => v.w.some(w => w.startsWith(token.text)) || (!!v.G && inGroup.has(v.G))
      }
      case 'currency': {
        const [first, last] = amountBounds(token.code)
        return ({a}) => !!a && a >= first && a <= last
      }
      case 'status':
        return statusTest(token)
      case 'type': {
        if (token.type !== 'comment') return () => false
        const ids = await resolve(token)
        return v => ids.has(v.id)
      }
      case 'any':
        return anyOf(await Promise.all(token.options.map(testOf)))
    }
  }

  /* ------------------------------------------------------------------ */
  /* The sections                                                        */
  /* ------------------------------------------------------------------ */

  const types = new Set<SearchType>(tokens.flatMap(t => (t.kind === 'type' ? [t.type] : [])))
  const recordKinds = new Set<RecordType>()
  if (types.has('expense')) recordKinds.add('expense')
  if (types.has('payment')) recordKinds.add('repayment')
  if (types.has('writeoff')) recordKinds.add('writeoff')
  const isRecordsWanted = types.size === 0 || recordKinds.size > 0 || types.has('comment')
  const kindWanted = (k: RecordType) => recordKinds.size === 0 || recordKinds.has(k)
  const filters = tokens.filter(t => !(t.kind === 'type' && t.type !== 'comment'))

  /* The words people and groups are found by: the plain words of the query (statuses and types narrow them). */
  const isNameQuery = tokens.every(t => t.kind === 'text' || t.kind === 'amount' || t.kind === 'place' || t.kind === 'status' || t.kind === 'type')
  const nameWords = tokens.flatMap(t => (t.kind === 'text' || t.kind === 'amount' || t.kind === 'place' ? [t.text] : []))
  const statuses = tokens.flatMap(t => (t.kind === 'status' ? [t.status] : []))

  async function namedEntities<T>(type: 'person' | 'group'): Promise<Entity<T>[]> {
    if (!isNameQuery || (nameWords.length === 0 && statuses.length === 0)) return []
    let ids: Set<string> | undefined
    for (const w of nameWords) {
      // A person is listed by a word of the name, the contact or the UPI id.
      const found = await Promise.all(type === 'person' ? [named('p', w), store.terms({kind: 'k', min: w, max: w + END})] : [named('g', w)])
      const hit = new Set(found.flat().map(r => r.entityId))
      ids = ids ? intersect(ids, hit) : hit
      if (ids.size === 0) return []
    }
    // full-read-ok: a status alone lists the matching people or groups (hundreds at most, never the records)
    const candidates = ids ? await store.getMany<T>(type, [...ids]) : (await (type === 'person' ? store.page<T>('person', {limit: ALL}) : store.page<T>('group', {limit: ALL}))).items
    const l = statuses.length ? await ledgerStatus() : undefined
    return candidates.filter(e => statuses.every(s => statusFits(type, e, s, l!, options))).sort((x, y) => (nameOf(x) < nameOf(y) ? -1 : nameOf(x) > nameOf(y) ? 1 : x.id < y.id ? -1 : 1))
  }
  const nameOf = (e: Entity<unknown>) => fold((e.data as {name: string}).name)

  const wantsPeople = types.size === 0 || types.has('friend')
  const wantsGroups = types.size === 0 || types.has('group')
  const [people, groups] = await Promise.all([
    wantsPeople ? namedEntities<Person>('person').then(rows => rows.filter(p => !p.data.isMe).map(displayPerson)) : [],
    wantsGroups ? namedEntities<Group>('group') : [],
  ])

  /* ------------------------------------------------------------------ */
  /* Records                                                             */
  /* ------------------------------------------------------------------ */

  const cache = new Map<string, Entity<Rec>>()
  const paymentKind = new Map<string, RecordType>()
  const isListed = (r: Entity<Rec>) => {
    const date = (r.data as Partial<Expense>).date
    // The same rule as the `d` keys: a record without a full date has no place in the list.
    return typeof date === 'string' && date.length >= 7
  }
  const entryOf = (r: Entity<Rec>) => `${dateTerm((r.data as Expense).date, r.createdAt)}\u0000${r.id}`
  const newestFirst = (entries: string[]) => entries.sort().reverse().map(e => e.slice(e.indexOf('\u0000') + 1))

  /** The rows of record ids, of the kinds the query wants, read by id. */
  async function rowsOf(ids: Set<string>): Promise<Entity<Rec>[]> {
    const byType: Record<RecordType, string[]> = {expense: [], repayment: [], writeoff: []}
    const unknown: string[] = []
    for (const id of ids) {
      const t = typeOf.get(id)
      if (t) byType[t].push(id)
      else unknown.push(id)
    }
    // An id no key named (a hidden item): it can only be in one of the stores.
    for (const t of RECORD_TYPES) byType[t].push(...unknown)
    return (await Promise.all(RECORD_TYPES.filter(kindWanted).map(t => (byType[t].length ? store.getMany<Rec>(t, byType[t]) : [])))).flat()
  }

  /** The answer of rows in hand: ordered and totalled from them. */
  function fromRows(rows: Entity<Rec>[]): Answer {
    const expenseEntries: string[] = []
    const paymentEntries: string[] = []
    const parts: Array<{currency: CurrencyCode; amount: bigint}> = []
    for (const r of rows) {
      if (!isListed(r)) continue
      cache.set(r.id, r)
      if (r.type === 'expense') {
        expenseEntries.push(entryOf(r))
        const d = r.data as Partial<Expense>
        // The totals: a deleted match is listed but never added up (decision 103).
        if (!r.deleted && typeof d.currency === 'string' && typeof d.total === 'bigint') parts.push({currency: d.currency, amount: d.total})
      } else {
        paymentEntries.push(entryOf(r))
        paymentKind.set(r.id, r.type as RecordType)
      }
    }
    return {expenseIds: newestFirst(expenseEntries), paymentIds: newestFirst(paymentEntries), totals: sumByCurrency(parts)}
  }

  /** The answer of a broad set of ids (undefined: every record): ordered from one pass over the date keys, totalled from the amount keys. */
  async function fromKeys(acc: Set<string> | undefined): Promise<Answer> {
    const expenseEntries: string[] = []
    const paymentEntries: string[] = []
    const expenseSet = new Set<string>()
    for (const r of await store.terms({kind: 'd', min: '', max: END})) {
      const kind = r.entityType as RecordType
      if ((acc && !acc.has(r.entityId)) || !kindWanted(kind)) continue
      if (kind === 'expense') {
        expenseEntries.push(`${r.term}\u0000${r.entityId}`)
        expenseSet.add(r.entityId)
      } else {
        paymentEntries.push(`${r.term}\u0000${r.entityId}`)
        paymentKind.set(r.entityId, kind)
      }
    }
    return {expenseIds: newestFirst(expenseEntries), paymentIds: newestFirst(paymentEntries), totals: await totalsOf(store, expenseSet)}
  }

  /** The whole answer from full key sets: what a broad query's count, totals and later pages come from. */
  let wholeAnswer: Promise<Answer> | undefined
  const whole = () =>
    (wholeAnswer ??= (async () => {
      let acc: Set<string> | undefined
      for (const set of (await Promise.all(filters.map(t => resolve(t)))).sort((x, y) => x.size - y.size)) {
        acc = acc ? intersect(acc, set) : set
        if (acc.size === 0) break
      }
      return acc && acc.size <= SMALL ? fromRows(await rowsOf(acc)) : fromKeys(acc)
    })())

  /**
   * Walks the record stores newest first (`byDate`, a chunk at a time) and checks each row in hand, until a page of
   * matches is certain: every row dated after the last date read has been seen, on each store walked. Bounded by
   * `walkRows` rows, and it gives up sooner when the matches so far are too rare to fill a page within the bound (the
   * stores hold more than it); either way the first page then waits for the whole answer instead (undefined).
   */
  async function walk(kinds: RecordType[], walkRows: number, fits: (r: Entity<Rec>) => boolean): Promise<Walk | undefined> {
    const cursors = kinds.map(type => ({type, after: null as Key | null, last: END, isEnd: false}))
    const matches: Array<{entry: string; date: string; row: Entity<Rec>}> = []
    // A walk that can reach the end is never given up early: reading every row answers the section exactly.
    let reachable: Promise<boolean> | undefined
    const isReachable = () => (reachable ??= Promise.all(kinds.map(k => store.count(k))).then(n => n.reduce((x, y) => x + y, 0) <= walkRows))
    let read = 0
    let chunk = 2 * SEARCH_PAGE
    for (;;) {
      const open = cursors.filter(c => !c.isEnd)
      const boundary = open.reduce((m, c) => (c.last > m ? c.last : m), '')
      const certain = open.length ? matches.filter(m => m.date > boundary) : matches
      if (certain.length >= SEARCH_PAGE || open.length === 0) return {rows: certain.sort((x, y) => (x.entry < y.entry ? 1 : x.entry > y.entry ? -1 : 0)).map(m => m.row), isAll: open.length === 0}
      if (read >= walkRows) return undefined
      // At this rate the bound would not hold a page: the whole answer is cheaper than walking on. Not before a few
      // chunks: rows of a day come in id order, which can bunch the matches.
      if (read >= 4 * SEARCH_PAGE && matches.length * walkRows < SEARCH_PAGE * read && !(await isReachable())) return undefined
      const c = open.reduce((x, y) => (y.last > x.last ? y : x))
      // full-read-ok: newest first, bounded by walkRows, and it stops at the first page of matches
      const page = await store.page<Rec>(c.type, {index: 'byDate', dir: 'prev', after: c.after, limit: Math.min(chunk, walkRows - read)})
      read += page.items.length
      chunk = Math.min(2 * chunk, 16 * SEARCH_PAGE)
      for (const r of page.items) {
        const date = (r.data as Partial<Expense>).date
        if (typeof date === 'string') c.last = date
        if (!isListed(r) || !fits(r)) continue
        matches.push({entry: entryOf(r), date: date!, row: r})
        cache.set(r.id, r)
        if (r.type !== 'expense') paymentKind.set(r.id, r.type as RecordType)
      }
      c.after = page.next
      c.isEnd = !page.next
    }
  }

  /*
   * Narrow first (F-246, F-266): each token is probed within a budget of keys. When one or more are narrow (at most
   * SMALL records), their sets are intersected and read by id, the broad tokens are checked on those rows, and the
   * answer (order, count, totals) comes from the rows. When every token is broad, the first page of each section comes
   * from a newest-first walk with the same checks, and the count, the totals and the later pages come after it from
   * the full key sets (`whole`), when asked for (`whenCounted`, or a step past the walk).
   */
  let answer: Answer | undefined
  let walked: {expenses: Walk | undefined; payments: Walk | undefined} | undefined
  if (!isRecordsWanted) answer = {expenseIds: [], paymentIds: [], totals: {}}
  else {
    const probes = await Promise.all(filters.map(probe))
    const narrow = probes.filter((x): x is Set<string> => !!x).sort((x, y) => x.size - y.size)
    if (narrow.length) {
      const acc = narrow.reduce((x, y) => intersect(x, y))
      const fits = allOf(await Promise.all(filters.filter((_, i) => !probes[i]).map(testOf)))
      answer = fromRows(acc.size ? (await rowsOf(acc)).filter(r => fits(viewOf(r))) : [])
    } else {
      const test = allOf(await Promise.all(filters.map(testOf)))
      const fits = (r: Entity<Rec>) => test(viewOf(r))
      const kinds = RECORD_TYPES.filter(kindWanted)
      // Expenses first: when their walk gives up, the whole answer is needed anyway and gives the payments too.
      const expenses = await walk(kinds.filter(k => k === 'expense'), options.walkRows ?? WALK_ROWS, fits)
      const payments = expenses ? await walk(kinds.filter(k => k !== 'expense'), options.walkRows ?? WALK_ROWS, fits) : undefined
      // The walk read the whole of both: it is the answer.
      if (expenses?.isAll && payments?.isAll) answer = fromRows([...expenses.rows, ...payments.rows])
      else walked = {expenses, payments}
    }
  }

  /* ------------------------------------------------------------------ */
  /* Rows, a page at a time                                              */
  /* ------------------------------------------------------------------ */

  const comments = new Map<string, string>()
  /** The text of the comment each of these records was found through. */
  async function loadComments(ids: string[]) {
    const found = ids.flatMap(id => (commentOf.has(id) ? [[id, commentOf.get(id)!] as const] : []))
    if (found.length === 0) return
    const byComment = new Map(found.map(([target, comment]) => [comment, target]))
    for (const c of await store.getMany<Comment>('comment', [...byComment.keys()])) comments.set(byComment.get(c.id)!, c.data.body)
  }
  /** Rows by id in the given order: from the rows in hand, else one read per kind. */
  async function load<T>(ids: string[]): Promise<Entity<T>[]> {
    const missing = ids.filter(id => !cache.has(id))
    for (const kind of RECORD_TYPES) {
      const of = missing.filter(id => (paymentKind.get(id) ?? 'expense') === kind)
      if (of.length) for (const e of await store.getMany<Rec>(kind, of)) cache.set(e.id, e)
    }
    await loadComments(ids)
    return ids.flatMap(id => (cache.has(id) ? [cache.get(id) as Entity<T>] : []))
  }
  let counted: Answer | undefined = answer
  const later = () =>
    whole().then(a => {
      counted = a
      return a
    })
  const expensePages = answer ? pager(answer.expenseIds, ids => load<Expense>(ids)) : pager(walked!.expenses, ids => load<Expense>(ids), () => later().then(a => a.expenseIds))
  const paymentPages = answer ? pager(answer.paymentIds, ids => load<Repayment | WriteOff>(ids)) : pager(walked!.payments, ids => load<Repayment | WriteOff>(ids), () => later().then(a => a.paymentIds))
  await Promise.all([expensePages.step(), paymentPages.step()])

  return {
    people,
    groups,
    get paymentCount() {
      return counted ? counted.paymentIds.length : paymentPages.rows.length
    },
    terms: tokens.flatMap(wordsOfToken),
    chips,
    tokens,
    get summary() {
      return counted ? {count: counted.expenseIds.length, totals: counted.totals} : {count: expensePages.rows.length, totals: {}}
    },
    isCounted: () => !!counted,
    whenCounted: () => (counted ? Promise.resolve() : later().then(() => undefined)),
    found: () => expensePages.rows,
    isDone: expensePages.isDone,
    step: expensePages.step,
    foundPayments: () => paymentPages.rows,
    isPaymentsDone: paymentPages.isDone,
    stepPayments: paymentPages.step,
    commentText: id => comments.get(id),
  }
}

/**
 * Rows read a page (SEARCH_PAGE) at a time, in order; overlapping steps share the read in flight. The ids are known
 * (a narrow answer), or the pages start with a walk's rows and go on with the whole answer's ids once it is asked for.
 */
function pager<T>(start: string[] | Walk | undefined, load: (ids: string[]) => Promise<T[]>, rest?: () => Promise<string[]>): Pages<T> {
  let ids = Array.isArray(start) ? start : undefined
  const walked = Array.isArray(start) ? undefined : start
  const rows: T[] = []
  let cursor = 0
  let inFlight: Promise<void> | undefined
  const total = () => (ids ? ids.length : walked?.isAll ? walked.rows.length : undefined)
  const isDone = () => {
    const n = total()
    return n !== undefined && cursor >= n
  }
  const read = async () => {
    let page: string[]
    if (!ids && walked && (walked.isAll || cursor + SEARCH_PAGE <= walked.rows.length)) page = walked.rows.slice(cursor, cursor + SEARCH_PAGE).map(r => (r as Entity<unknown>).id)
    else {
      ids ??= await rest!()
      page = ids.slice(cursor, cursor + SEARCH_PAGE)
    }
    cursor += page.length
    rows.push(...(await load(page)))
  }
  return {
    rows,
    isDone,
    step: () => (isDone() ? Promise.resolve() : (inFlight ??= read().finally(() => (inFlight = undefined)))),
  }
}
interface Pages<T> {
  rows: T[]
  isDone(): boolean
  step(): Promise<void>
}

/* -------------------------------------------------------------------------- */
/* Ledger status: which groups and friends are settled, owed or owing           */
/* -------------------------------------------------------------------------- */

interface LedgerStatus {
  settledGroups: string[]
  owedGroups: string[]
  oweGroups: string[]
  inactiveGroups: string[]
  /** Friends with a direct balance with me outside groups: any, one that owes me, one I owe. */
  unsettledPeople: string[]
  owedPeople: string[]
  owePeople: string[]
}

async function statusOfLedger(store: Store, me: string | undefined): Promise<LedgerStatus> {
  // full-read-ok: a person has tens of groups; the balances projection holds one row per member and currency
  const [groups, nets, pairs] = await Promise.all([store.page<Group>('group', {limit: ALL}), store.balances(), me ? store.pairBalances(me) : Promise.resolve([])])
  const live = groups.items.filter(g => !g.deleted)
  const byGroup = new Map<string, Array<{personId: string; amount: bigint}>>()
  for (const n of nets) if (n.groupId) byGroup.set(n.groupId, [...(byGroup.get(n.groupId) ?? []), n])
  const out: LedgerStatus = {settledGroups: [], owedGroups: [], oweGroups: [], inactiveGroups: [], unsettledPeople: [], owedPeople: [], owePeople: []}
  for (const g of live) {
    const rows = byGroup.get(g.id) ?? []
    if (rows.every(r => r.amount === 0n)) out.settledGroups.push(g.id)
    if (rows.some(r => r.personId === me && r.amount > 0n)) out.owedGroups.push(g.id)
    if (rows.some(r => r.personId === me && r.amount < 0n)) out.oweGroups.push(g.id)
    if (isGroupInactive(g.data)) out.inactiveGroups.push(g.id)
  }
  // `pairBalances(me)`: what each other person owes me outside groups, per currency.
  for (const p of pairs) {
    if (p.amount === 0n) continue
    out.unsettledPeople.push(p.otherId)
    ;(p.amount > 0n ? out.owedPeople : out.owePeople).push(p.otherId)
  }
  return out
}

/** Whether a person or group is in the status (a section the status says nothing about is never in it). */
function statusFits(type: 'person' | 'group', e: Entity<unknown>, status: SearchStatus, l: LedgerStatus, o: SearchOptions): boolean {
  if (status === 'deleted') return e.deleted
  if (e.deleted) return false
  if (type === 'person') return false
  switch (status) {
    case 'hidden':
      return !!o.hiddenGroups?.includes(e.id)
    case 'inactive':
      return l.inactiveGroups.includes(e.id)
    case 'settled':
      return l.settledGroups.includes(e.id)
    case 'owed':
      return l.owedGroups.includes(e.id)
    case 'owe':
      return l.oweGroups.includes(e.id)
    default:
      return false
  }
}

/** One total per currency over the expense ids, from the amount keys alone; a deleted expense is not added up. */
async function totalsOf(store: Store, ids: ReadonlySet<string>): Promise<Record<CurrencyCode, bigint>> {
  if (ids.size === 0) return {}
  const gone = new Set((await store.terms({kind: 's', min: 'deleted', max: 'deleted'})).map(r => r.entityId))
  const parts: Array<{currency: CurrencyCode; amount: bigint}> = []
  for (const r of await store.terms({kind: 'a', min: '', max: END})) {
    if (!ids.has(r.entityId) || gone.has(r.entityId)) continue
    const colon = r.term.indexOf(':')
    parts.push({currency: r.term.slice(0, colon), amount: amountOfTerm(r.term.slice(colon + 1))})
  }
  return sumByCurrency(parts)
}

/** Counts and adds up expenses already in hand (kept for callers that hold rows). */
export function summarizeSearch(found: ReadonlyArray<Entity<Expense>>): SearchSummary {
  // A deleted match is listed (and counted as a row), but never added up (decision 103).
  const live = found.filter(e => !e.deleted)
  return {count: found.length, totals: sumByCurrency(live.map(e => ({currency: e.data.currency, amount: e.data.total})))}
}

/**
 * The whole answer at once: every match, the totals and the words to
 * highlight. For tests and callers that want it all; the app pages instead.
 */
export async function searchStore(store: Store, query: string, options: SearchOptions): Promise<SearchResults> {
  const session = await openSearch(store, query, options)
  while (!session.isDone()) await session.step()
  while (!session.isPaymentsDone()) await session.stepPayments()
  await session.whenCounted()
  return {expenses: session.found(), people: session.people, groups: session.groups, payments: session.foundPayments(), totals: session.summary.totals, terms: session.terms}
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
