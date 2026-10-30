import {addDays, type CurrencyCode, DomainError, type LocalDate, parseAmount, sumByCurrency} from '@splito/domain'

import {type Comment} from './comments'
import {listOpenDisputes} from './disputes'
import {displayPerson, type Expense, type Group, isGroupInactive, type Person, type Repayment, type WriteOff} from './mutations'
import {type Key} from './schema'
import {type CompareOp, parseQuery, type ParsedQuery, type SearchChip, type SearchStatus, type SearchToken, type SearchType} from './searchQuery'
import {amountBounds, amountOfTerm, amountTerm, fold, NO_GROUP, type RecordType, type SearchTerm, wordsOf} from './searchTerms'
import {type Store} from './store'
import {type Entity} from './types'

/**
 * Free search across expenses, payments, write-offs, comments, people and groups (BACKLOG F-246, ARCHITECTURE 9.8
 * and 26.19). A query is resolved from the `search_terms` keys alone: each token becomes the set of record ids its
 * key ranges hold (a word, an amount range, a month, a payer, a group's records, a status ...), the sets are
 * intersected (AND across tokens, OR inside one facet), and the answer is ordered and totalled from the `d` and `a`
 * keys. Only the rows shown are read (a page at a time through `step`), so the cost follows the number of keys the
 * query touches (about a quarter of a microsecond each), never the ledger: 10,000 expenses answer in single-digit
 * milliseconds whatever the match count. A person's or group's name is not copied onto its records, so a word is
 * resolved to the live people and groups it names first and then to their records (`h`, `G` keys).
 */

export {type SearchToken} from './searchQuery'

/** What the matching expenses add up to: how many, and one total per currency. */
export interface SearchSummary {
  count: number
  totals: Record<CurrencyCode, bigint>
}

/**
 * One query's search, readable a page at a time: the people, groups and payments (few, known at once) and the
 * matching expenses, newest first. The count and the totals are known at once; `step` reads the next rows.
 */
export interface SearchSession {
  people: Entity<Person>[]
  groups: Entity<Group>[]
  /** The newest payments and write-offs that match (one page), and how many match in all. */
  payments: Entity<Repayment | WriteOff>[]
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
}

export interface SearchResults {
  expenses: Entity<Expense>[]
  people: Entity<Person>[]
  groups: Entity<Group>[]
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
  payments: [],
  paymentCount: 0,
  terms: [],
  chips: [],
  tokens: [],
  summary: {count: 0, totals: {}},
  found: () => [],
  commentText: () => undefined,
  isDone: () => true,
  step: async () => undefined,
}

/**
 * Starts a search. The people, groups and payments are ready in the session, and so are the count and totals; the
 * first page of expenses is read before this returns, and `session.step()` reads the next.
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
  const {today, categories = [], me} = options

  /* ------------------------------------------------------------------ */
  /* Key reads                                                           */
  /* ------------------------------------------------------------------ */

  const hits = (kind: SearchTerm['kind'], min?: string, max = min) => store.terms({kind, min, max})
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

  /** The first and last day of "this/last week/month/year". */
  function periodRange(unit: 'week' | 'month' | 'year', offset: number): [string, string] {
    const y = Number(today.slice(0, 4))
    const m = Number(today.slice(5, 7)) - 1
    if (unit === 'year') return [`${y + offset}-01-01`, `${y + offset}-12-31`]
    if (unit === 'month') {
      const at = new Date(Date.UTC(y, m + offset, 1))
      const key = `${at.getUTCFullYear()}-${String(at.getUTCMonth() + 1).padStart(2, '0')}`
      return [`${key}-01`, `${key}-31`]
    }
    const monday = addDays(today, -((new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7) + 7 * offset)
    return [monday, addDays(monday, 6)]
  }

  /* ------------------------------------------------------------------ */
  /* One token -> the ids of the records it can match                    */
  /* ------------------------------------------------------------------ */

  /** Records with a word, a comment word, a group, person or category that starts with `p`. */
  async function textIds(p: string): Promise<Set<string>> {
    const out = new Set<string>()
    const [own, comments, groupHits, personHits] = await Promise.all([prefix('w', p), prefix('n', p), prefix('g', p), prefix('p', p)])
    for (const r of own) out.add(r.entityId)
    for (const r of comments) {
      out.add(r.entityId)
      commentOf.set(r.entityId, r.term.slice(r.term.indexOf('\u0000') + 1))
    }
    const [groups, people] = await Promise.all([liveGroups(idsOf(groupHits)), livePeople(idsOf(personHits))])
    const named = await Promise.all([recordsOf('G', groups.map(g => g.id)), recordsOf('h', people.map(x => x.id)), ...categories.filter(c => startsWith(wordsOf(c.name), p)).map(async c => new Set(idsOf(await hits('c', c.id))))])
    for (const set of named) for (const id of set) out.add(id)
    return out
  }

  /** The live people a typed name can mean: the words it starts, else a close spelling. */
  async function peopleNamed(text: string): Promise<string[]> {
    if (text === 'me') return me ? [me] : []
    let ids = idsOf(await prefix('p', text))
    if (ids.length === 0 && text.length >= 4) {
      const limit = text.length >= 7 ? 2 : 1
      ids = (await hits('p')).filter(r => distance(r.term.slice(0, text.length), text) <= limit).map(r => r.entityId)
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
          for (const d of page.items) out.add(d.data.targetId)
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
        const out = token.year ? await dateIds(`${token.year}-${token.month}-01`, `${token.year}-${token.month}-31`) : new Set(idsOf(await hits('m', token.month)))
        for (const id of await textIds(token.text)) out.add(id)
        return out
      }
      case 'period':
        return dateIds(...periodRange(token.unit, token.offset))
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
      const hit = new Set(idsOf(await prefix(type === 'person' ? 'p' : 'g', w)))
      ids = ids ? intersect(ids, hit) : hit
      if (ids.size === 0) return []
    }
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
  /* Records: intersect the sets, order from the date keys, total from the amount keys */
  /* ------------------------------------------------------------------ */

  /* One pass over the date keys picks the matches and orders them: an entry is `<date>:<createdAt> NUL <id>`, which sorts
     as the list does (newest first once reversed; the same day, the later-created first). */
  const expenseEntries: string[] = []
  const paymentEntries: string[] = []
  const paymentKind = new Map<string, RecordType>()
  const expenseSet = new Set<string>()
  if (isRecordsWanted) {
    let acc: Set<string> | undefined
    for (const set of (filters.length ? await Promise.all(filters.map(resolve)) : []).sort((x, y) => x.size - y.size)) {
      acc = acc ? intersect(acc, set) : set
      if (acc.size === 0) break
    }
    if (!acc || acc.size > 0)
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
  }
  const newestFirst = (entries: string[]) => entries.sort().reverse().map(e => e.slice(e.indexOf('\u0000') + 1))
  const expenseIds = newestFirst(expenseEntries)
  const paymentIds = newestFirst(paymentEntries)

  /* The totals: a deleted match is listed but never added up (decision 103). */
  const totals = await totalsOf(store, expenseSet)

  const pagePayments = paymentIds.slice(0, SEARCH_PAGE)
  const payments = (await Promise.all((['repayment', 'writeoff'] as const).map(kind => store.getMany<Repayment>(kind, pagePayments.filter(id => paymentKind.get(id) === kind)))))
    .flat()
    .sort((x, y) => pagePayments.indexOf(x.id) - pagePayments.indexOf(y.id)) as Entity<Repayment | WriteOff>[]

  /* ------------------------------------------------------------------ */
  /* Expense rows, a page at a time                                      */
  /* ------------------------------------------------------------------ */

  const rows: Entity<Expense>[] = []
  const comments = new Map<string, string>()
  /** The text of the comment each of these records was found through. */
  async function loadComments(ids: string[]) {
    const found = ids.flatMap(id => (commentOf.has(id) ? [[id, commentOf.get(id)!] as const] : []))
    if (found.length === 0) return
    const byComment = new Map(found.map(([target, comment]) => [comment, target]))
    for (const c of await store.getMany<Comment>('comment', [...byComment.keys()])) comments.set(byComment.get(c.id)!, c.data.body)
  }
  let cursor = 0
  let inFlight: Promise<void> | undefined
  const read = async () => {
    const ids = expenseIds.slice(cursor, cursor + SEARCH_PAGE)
    cursor += ids.length
    const byId = new Map((await store.getMany<Expense>('expense', ids)).map(e => [e.id, e]))
    for (const id of ids) {
      const e = byId.get(id)
      if (e) rows.push(e)
    }
    await loadComments(ids)
  }
  const step = () => (cursor >= expenseIds.length ? Promise.resolve() : (inFlight ??= read().finally(() => (inFlight = undefined))))
  await Promise.all([step(), loadComments(pagePayments)])

  return {
    people,
    groups,
    payments,
    paymentCount: paymentIds.length,
    terms: tokens.flatMap(wordsOfToken),
    chips,
    tokens,
    summary: {count: expenseIds.length, totals},
    found: () => rows,
    commentText: id => comments.get(id),
    isDone: () => cursor >= expenseIds.length,
    step,
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
  return {expenses: session.found(), people: session.people, groups: session.groups, payments: session.payments, totals: session.summary.totals, terms: session.terms}
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
