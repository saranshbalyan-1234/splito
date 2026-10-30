import {addDays, type CurrencyCode, DomainError, type LocalDate, parseAmount, periodRange, sumByCurrency, type WeekStart} from '@splito/domain'

import {type Comment} from './comments'
import {listOpenDisputes} from './disputes'
import {displayPerson, type Expense, type Group, isGroupInactive, type Person, type Repayment, type WriteOff} from './mutations'
import {type Key} from './schema'
import {type CompareOp, parseQuery, type ParsedQuery, type SearchChip, type SearchStatus, type SearchToken, type SearchType} from './searchQuery'
import {amountBounds, amountOfTerm, amountTerm, dateTerm, fold, NO_GROUP, RECORD_TYPES, recordPeople, type RecordType, type SearchTerm, type TermKind, wordsOf} from './searchTerms'
import {type Store} from './store'
import {type Entity} from './types'

/**
 * Free search across expenses, payments, write-offs, comments, people and groups (BACKLOG F-246, ARCHITECTURE 9.8
 * and 26.19). A query is resolved from the `search_terms` keys: each token becomes the set of record ids its key
 * ranges hold (a word, an amount range, a month, a payer, a group's records, a status ...), and the sets are
 * intersected (AND across tokens, OR inside one facet). A narrow answer (at most SMALL records) is then read by id and
 * ordered and totalled from its rows; a broad one is ordered from the `d` keys and totalled from the `a` keys, and only
 * the rows shown are read (a page at a time through `step` / `stepPayments`). A person's or group's name is not copied
 * onto its records, so a word is resolved to the live people and groups it names first and then to their records
 * (`h`, `G` keys); contact and UPI words (`k`) list the person and never their records.
 */
export {type SearchToken} from './searchQuery'

/** What the matching expenses add up to: how many, and one total per currency. */
export interface SearchSummary {
  count: number
  totals: Record<CurrencyCode, bigint>
}

/**
 * One query's search, readable a page at a time: the people and groups (few, known at once), and the matching payments
 * and expenses, newest first, each paged. The counts and the totals are known at once; `step` reads the next rows.
 */
export interface SearchSession {
  people: Entity<Person>[]
  groups: Entity<Group>[]
  /** How many payments and write-offs match. */
  paymentCount: number
  /** Folded query words to highlight. */
  terms: string[]
  /** The recognised facets, for the removable chips. */
  chips: SearchChip[]
  /** The tokens the query was read as (the result rows say which field matched with them). */
  tokens: SearchToken[]
  /** How many expenses match (a deleted one counts as a row) and what they add up to, per currency. */
  summary: SearchSummary
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
/** A longer typed name is never spelled close to anyone's (and the edit distance grows with the square of it). */
const FUZZY_MAX = 20
/** The term kinds whose keys are records (the others are people and groups). */
const RECORD_KINDS = new Set<TermKind>(['w', 'a', 'm', 'c', 'b', 'h', 'G', 'd', 's', 'n'])
/** Statuses a narrow answer checks on its rows instead of listing every record in them. */
const ROW_STATUSES = new Set<SearchStatus>(['settled', 'owed', 'owe', 'inactive', 'hidden'])
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
  found: () => [],
  commentText: () => undefined,
  isDone: () => true,
  step: async () => undefined,
  foundPayments: () => [],
  isPaymentsDone: () => true,
  stepPayments: async () => undefined,
}

/**
 * Starts a search. The people and groups are ready in the session, and so are the counts and totals; the first page of
 * expenses and of payments is read before this returns, and `step()` / `stepPayments()` read the next.
 */
export async function openSearch(store: Store, query: string, options: SearchOptions): Promise<SearchSession> {
  const first = await run(store, parseQuery(query, {mark: options.mark}), options)
  const isEmpty = (s: SearchSession) => s.people.length + s.groups.length + s.paymentCount + s.summary.count === 0
  // "Group dinner" or "settled bill": a status or type word that found nothing was meant as text.
  if (isEmpty(first) && first.chips.some(c => c.facet === 'status' || c.facet === 'type')) {
    const literal = await run(store, parseQuery(query, {mark: options.mark, isLiteral: true}), options)
    if (!isEmpty(literal)) return literal
  }
  return first
}

async function run(store: Store, parsed: ParsedQuery, options: SearchOptions): Promise<SearchSession> {
  const {tokens, chips} = parsed
  if (tokens.length === 0) return EMPTY
  const {today, categories = [], me, weekStart = 1} = options

  /* ------------------------------------------------------------------ */
  /* Key reads                                                           */
  /* ------------------------------------------------------------------ */

  /** The kind of every record a key read named: a small answer reads its rows by id from the right store. */
  const typeOf = new Map<string, RecordType>()
  const hits = async (kind: SearchTerm['kind'], min?: string, max = min) => {
    const rows = await store.terms({kind, min, max})
    if (RECORD_KINDS.has(kind)) for (const r of rows) typeOf.set(r.entityId, r.entityType as RecordType)
    return rows
  }
  const prefix = (kind: SearchTerm['kind'], p: string) => hits(kind, p, p + END)
  const idsOf = (rows: SearchTerm[]) => rows.map(r => r.entityId)
  const liveGroups = async (ids: Iterable<string>) => (await store.getMany<Group>('group', [...new Set(ids)])).filter(g => !g.deleted)
  const livePeople = async (ids: Iterable<string>) => (await store.getMany<Person>('person', [...new Set(ids)])).filter(p => !p.deleted)
  /** The records of each key value (a group's, a person's). */
  async function recordsOf(kind: 'G' | 'h' | 'b', values: Iterable<string>): Promise<Set<string>> {
    const out = new Set<string>()
    for (const rows of await Promise.all([...new Set(values)].map(v => hits(kind, v)))) for (const r of rows) out.add(r.entityId)
    return out
  }

  /** The comment (id) a record was found through, by the record. */
  const commentOf = new Map<string, string>()

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

  /** Records whose amount lies in `[lo, hi]` (null: unbounded) in the given currency, or in any. */
  async function amountsIn(currencies: CurrencyCode[] | undefined, bounds: (currency: CurrencyCode) => Array<[bigint | null, bigint | null]>): Promise<Set<string>> {
    const ranges: Array<{min: string; max: string}> = []
    for (const currency of currencies ?? (await knownCurrencies())) {
      const [first, last] = amountBounds(currency)
      for (const [lo, hi] of bounds(currency)) ranges.push({min: lo === null ? first : amountTerm(currency, lo), max: hi === null ? last : amountTerm(currency, hi)})
    }
    const out = new Set<string>()
    for (const rows of await Promise.all(ranges.map(r => hits('a', r.min, r.max)))) for (const r of rows) out.add(r.entityId)
    return out
  }
  /** `each` reading of a typed number, in the currency: its minor units, or none. */
  const minors = (readings: string[], currency: CurrencyCode) => readings.map(r => minorOf(r, currency)).filter((m): m is bigint => m !== null)
  const compareBounds = (readings: string[], op: CompareOp | '=') => (currency: CurrencyCode): Array<[bigint | null, bigint | null]> =>
    minors(readings, currency).map(m => (op === '=' ? [m, m] : op === '>' ? [m + 1n, null] : op === '>=' ? [m, null] : op === '<' ? [null, m - 1n] : [null, m]))

  const dateIds = async (from: string, to: string) => new Set(idsOf(await hits('d', from, `${to}:${END}`)))

  /* ------------------------------------------------------------------ */
  /* One token -> the ids of the records it can match                    */
  /* ------------------------------------------------------------------ */

  /**
   * Records with a word or a comment word that starts with `p`, in a group whose name or place does, on with a person
   * whose name does (never me: every record is mine), or in a category whose name does. Contact and UPI words (`k`)
   * find the person only, never their records.
   */
  async function textIds(p: string): Promise<Set<string>> {
    const out = new Set<string>()
    const [own, comments, groupHits, personHits] = await Promise.all([prefix('w', p), prefix('n', p), prefix('g', p), prefix('p', p)])
    for (const r of own) out.add(r.entityId)
    for (const r of comments) {
      out.add(r.entityId)
      commentOf.set(r.entityId, r.term.slice(r.term.indexOf('\u0000') + 1))
    }
    const [groups, people] = await Promise.all([liveGroups(idsOf(groupHits)), livePeople(idsOf(personHits))])
    const others = people.filter(x => !x.data.isMe)
    const named = await Promise.all([recordsOf('G', groups.map(g => g.id)), recordsOf('h', others.map(x => x.id)), ...categories.filter(c => startsWith(wordsOf(c.name), p)).map(async c => new Set(idsOf(await hits('c', c.id))))])
    for (const set of named) for (const id of set) out.add(id)
    return out
  }

  /** The live people a typed name can mean: the name words it starts, else a close spelling with the same first letter. */
  async function peopleNamed(text: string): Promise<string[]> {
    if (text === 'me') return me ? [me] : []
    let ids = idsOf(await prefix('p', text))
    if (ids.length === 0 && text.length >= 4 && text.length <= FUZZY_MAX) {
      const limit = text.length >= 7 ? 2 : 1
      ids = (await prefix('p', text[0]!)).filter(r => distance(r.term.slice(0, text.length), text) <= limit).map(r => r.entityId)
    }
    return (await livePeople(ids)).map(p => p.id)
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

  let ledger: Promise<LedgerStatus> | undefined
  const ledgerStatus = () => (ledger ??= statusOfLedger(store, me))

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
        return amountsIn(token.currency ? [token.currency] : undefined, compareBounds(token.amounts, token.op))
      case 'between':
        return amountsIn(token.currency ? [token.currency] : undefined, currency => {
          const out: Array<[bigint | null, bigint | null]> = []
          for (const from of minors(token.from, currency)) for (const to of minors(token.to, currency)) out.push(from <= to ? [from, to] : [to, from])
          return out
        })
      case 'around':
        return amountsIn(token.currency ? [token.currency] : undefined, currency => minors(token.amounts, currency).map(m => [(m * 9n) / 10n, (m * 11n) / 10n]))
      case 'amount': {
        const out = await amountsIn(token.currency ? [token.currency] : undefined, compareBounds(token.amounts, '='))
        // A number is also a word, and a year is also a date.
        for (const id of await textIds(token.text)) out.add(id)
        if (/^(19|20)\d\d$/.test(token.text)) for (const id of await dateIds(`${token.text}-01-01`, `${token.text}-12-31`)) out.add(id)
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
          // "4 march": that day of the year given, else the latest one that is not after today.
          let year = token.year ?? today.slice(0, 4)
          if (!token.year && `${year}-${token.month}-${token.day}` > today) year = String(Number(year) - 1)
          const day = `${year}-${token.month}-${token.day}`
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
        const [own, groupHits] = await Promise.all([prefix('w', token.text), prefix('g', token.text)])
        const out = await recordsOf('G', (await liveGroups(idsOf(groupHits))).map(g => g.id))
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
        for (const set of await Promise.all(token.options.map(resolve))) for (const id of set) out.add(id)
        return out
      }
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

  async function named<T>(type: 'person' | 'group'): Promise<Entity<T>[]> {
    if (!isNameQuery || (nameWords.length === 0 && statuses.length === 0)) return []
    let ids: Set<string> | undefined
    for (const w of nameWords) {
      // A person is listed by a word of the name, the contact or the UPI id.
      const found = await Promise.all(type === 'person' ? [prefix('p', w), prefix('k', w)] : [prefix('g', w)])
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
    wantsPeople ? named<Person>('person').then(rows => rows.filter(p => !p.data.isMe).map(displayPerson)) : [],
    wantsGroups ? named<Group>('group') : [],
  ])

  /* ------------------------------------------------------------------ */
  /* Records: intersect the sets, then order and total them              */
  /* ------------------------------------------------------------------ */

  /*
   * A narrow answer (at most SMALL ids) reads its rows by id and is ordered, totalled and status-filtered from them; a
   * broad one is ordered from one pass over the date keys and totalled from the amount keys. Either way the cost is
   * bounded by the answer, not the ledger, except a broad answer, which costs its keys. A balance status (settled,
   * owed, owe, inactive, hidden) on a narrow answer is checked on the rows in hand instead of listing every record in
   * that status.
   */
  const isRowStatus = (t: SearchToken): t is Extract<SearchToken, {kind: 'status'}> => t.kind === 'status' && ROW_STATUSES.has(t.status)
  const rowStatuses = filters.filter(isRowStatus)
  const keyed = filters.filter(t => !isRowStatus(t))
  let acc: Set<string> | undefined
  if (isRecordsWanted)
    for (const set of (await Promise.all(keyed.map(resolve))).sort((x, y) => x.size - y.size)) {
      acc = acc ? intersect(acc, set) : set
      if (acc.size === 0) break
    }
  let inHand: Entity<Rec>[] | undefined
  if (isRecordsWanted) {
    const isNarrow = () => !!acc && acc.size <= SMALL
    const isByRows = rowStatuses.length > 0 && isNarrow()
    if (!isByRows)
      for (const t of rowStatuses) {
        const set = await statusIds(t.status)
        acc = acc ? intersect(acc, set) : set
      }
    if (isNarrow()) {
      inHand = await rowsOf(acc!)
      if (isByRows) {
        const l = await ledgerStatus()
        inHand = inHand.filter(r => rowStatuses.every(t => recordFits(r, t.status, l, options)))
      }
    }
  }

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

  /* An entry is `<date>:<createdAt> NUL <id>`, which sorts as the list does (newest first once reversed; the same day, the later-created first). */
  const expenseEntries: string[] = []
  const paymentEntries: string[] = []
  const paymentKind = new Map<string, RecordType>()
  const cache = new Map<string, Entity<Rec>>()
  let totals: Record<CurrencyCode, bigint> = {}
  if (inHand) {
    const parts: Array<{currency: CurrencyCode; amount: bigint}> = []
    for (const r of inHand) {
      const d = r.data as Partial<Expense & Repayment>
      // The same rule as the `d` and `a` keys: a record without a full date has no place in the list.
      if (typeof d.date !== 'string' || d.date.length < 7) continue
      const entry = `${dateTerm(d.date, r.createdAt)}\u0000${r.id}`
      cache.set(r.id, r)
      if (r.type === 'expense') {
        expenseEntries.push(entry)
        // The totals: a deleted match is listed but never added up (decision 103).
        if (!r.deleted && typeof d.currency === 'string' && typeof d.total === 'bigint') parts.push({currency: d.currency, amount: d.total})
      } else {
        paymentEntries.push(entry)
        paymentKind.set(r.id, r.type as RecordType)
      }
    }
    totals = sumByCurrency(parts)
  } else if (isRecordsWanted && (!acc || acc.size > 0)) {
    const expenseSet = new Set<string>()
    for (const r of await hits('d', '', END)) {
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
    totals = await totalsOf(store, expenseSet)
  }
  const newestFirst = (entries: string[]) => entries.sort().reverse().map(e => e.slice(e.indexOf('\u0000') + 1))
  const expenseIds = newestFirst(expenseEntries)
  const paymentIds = newestFirst(paymentEntries)

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
  const expensePages = pager(expenseIds, ids => load<Expense>(ids))
  const paymentPages = pager(paymentIds, ids => load<Repayment | WriteOff>(ids))
  await Promise.all([expensePages.step(), paymentPages.step()])

  return {
    people,
    groups,
    paymentCount: paymentIds.length,
    terms: tokens.flatMap(wordsOfToken),
    chips,
    tokens,
    summary: {count: expenseIds.length, totals},
    found: () => expensePages.rows,
    isDone: expensePages.isDone,
    step: expensePages.step,
    foundPayments: () => paymentPages.rows,
    isPaymentsDone: paymentPages.isDone,
    stepPayments: paymentPages.step,
    commentText: id => comments.get(id),
  }
}

/** Ids read a page (SEARCH_PAGE) at a time, in order; overlapping steps share the read in flight. */
function pager<T>(ids: string[], load: (ids: string[]) => Promise<T[]>) {
  const rows: T[] = []
  let cursor = 0
  let inFlight: Promise<void> | undefined
  const read = async () => {
    const page = ids.slice(cursor, cursor + SEARCH_PAGE)
    cursor += page.length
    rows.push(...(await load(page)))
  }
  return {
    rows,
    isDone: () => cursor >= ids.length,
    step: () => (cursor >= ids.length ? Promise.resolve() : (inFlight ??= read().finally(() => (inFlight = undefined)))),
  }
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

/** Whether a record is in a balance status: the row-by-row twin of `statusIds` (same groups, same people), for a narrow answer. */
function recordFits(r: Entity<Rec>, status: SearchStatus, l: LedgerStatus, o: SearchOptions): boolean {
  const d = r.data as Partial<Expense & Repayment>
  const group = d.groupId || null
  switch (status) {
    case 'hidden':
      return (!!group && !!o.hiddenGroups?.includes(group)) || !!o.hiddenItems?.includes(r.id)
    case 'inactive':
      return !!group && l.inactiveGroups.includes(group)
    case 'settled':
    case 'owed':
    case 'owe': {
      if (group) return (status === 'settled' ? l.settledGroups : status === 'owed' ? l.owedGroups : l.oweGroups).includes(group)
      const on = recordPeople(r.type as RecordType, d)
      if (status === 'settled') return !on.some(p => l.unsettledPeople.includes(p))
      return on.some(p => (status === 'owed' ? l.owedPeople : l.owePeople).includes(p))
    }
    default:
      return true
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
