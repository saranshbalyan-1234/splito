import {addDays, type CurrencyCode, DomainError, type LocalDate, numberReadings, parseAmount, sumByCurrency} from '@splito/domain'

import {type Expense, type Group, type Person} from './mutations'
import {type Key} from './schema'
import {amountBounds, amountTerm, fold, type SearchTerm, WORD, wordsOf} from './searchTerms'
import {type Page, type Store} from './store'
import {type Entity} from './types'

/**
 * Free search across expenses, people and groups (BACKLOG F-1401, ARCHITECTURE
 * 9.8): a query reads the `search_terms` projection by key range and loads
 * only the rows it matches, never the ledger. Every query word must match
 * (AND); a word matches when any of its readings does (OR): "450" is the
 * amount 450 in any currency or the text "450", "march" is the month or the
 * text.
 *
 * Two ways to find the expenses, picked by how many rows the rarest word's
 * keys hold (counted, not read):
 * - narrow (at most `NARROW`): the keys give the candidate expenses; the other
 *   words are checked on those rows. Everything is known after one read.
 * - broad: the expenses are walked newest first through `byDate`, a chunk at a
 *   time, each row checked against every word. The first page (`SEARCH_PAGE`
 *   rows) is ready after the first chunk or two whatever the match count; the
 *   rest is read on demand (`step`) and by `searchTotals`, which the caller
 *   cancels on the next keystroke.
 */

export type SearchToken =
  | {kind: 'text'; text: string}
  /**
   * A plain number in the user's number format ("450", "12,50", "1,00,000"):
   * an amount in each expense's own currency, or text. `amounts` holds every
   * reading as a plain decimal ("1.000" under "." is 1000 or 1.000).
   */
  | {kind: 'amount'; amounts: string[]; text: string}
  | {kind: 'compare'; op: CompareOp; amounts: string[]}
  /** "today" (0) or "yesterday" (-1). */
  | {kind: 'day'; offset: number; text: string}
  | {kind: 'month'; month: string; year?: string; text: string}

type CompareOp = '<' | '<=' | '>' | '>='

/** What the matching expenses add up to: how many, and one total per currency. */
export interface SearchSummary {
  count: number
  totals: Record<CurrencyCode, bigint>
}

/**
 * One query's search, readable a step at a time: the people and groups (few,
 * known at once) and the matching expenses, found newest first.
 */
export interface SearchSession {
  people: Entity<Person>[]
  groups: Entity<Group>[]
  /** Folded query words to highlight. */
  terms: string[]
  /**
   * The matches found so far, newest first (same day: the later-created
   * first). A day still being read is held back until it is complete, so the
   * list only ever grows at its end.
   */
  found(): Entity<Expense>[]
  /** True once every expense has been checked: `found()` is then every match. */
  isDone(): boolean
  /** Reads and checks one more chunk. Calls overlap safely (they share the read in flight). */
  step(): Promise<void>
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

const WORD_CHAR = /[\p{L}\p{N}\p{M}]/u
const COMPARE = /([<>]=?)\s*([^\s<>=]+)/g
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

/**
 * Splits a query into tokens. Numbers are read as the amount field reads
 * them (`numberReadings`, a currency sign allowed), under `mark`, the number
 * locale's decimal mark.
 */
export function parseSearchQuery(query: string, mark: '.' | ',' = '.'): SearchToken[] {
  const compares: SearchToken[] = []
  const rest = fold(query).replace(COMPARE, (_, op: CompareOp, num: string) => {
    const amounts = numberReadings(num, mark)
    if (amounts.length === 0) return ` ${num} `
    compares.push({kind: 'compare', op, amounts})
    return ' '
  })
  const tokens = compares
  const chunks = rest.split(/\s+/).filter(Boolean)
  for (let i = 0; i < chunks.length; i++) {
    const amounts = numberReadings(chunks[i]!, mark)
    if (amounts.length > 0) {
      tokens.push({kind: 'amount', amounts, text: amounts[0]!})
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

/** More rows than any one index range holds: "all of them" for one range read. */
const ALL = 1_000_000

/** Expenses shown per page of results. */
export const SEARCH_PAGE = 30
/** Rare-word keys at or under this many: read the candidates by key. Over it: walk the dates. */
const NARROW = 150
/** Rows one scan step reads. */
const CHUNK = 200

type Category = {id: string; name: string}

/** `mark` is the number locale's decimal mark (`decimalMark`), so "1.000" means what the user's format says. */
export interface SearchOptions {
  today: LocalDate
  mark?: '.' | ','
  /** The user's categories, by id (names are preferences, so they are not stored on expenses). */
  categories?: ReadonlyArray<Category>
}

const startsWith = (words: readonly string[], prefix: string) => words.some(w => w.startsWith(prefix))

/** The amount a typed number means in one currency, or null (a yen has no cents). Zeros after the last decimal digit change no value. */
function minorOf(typed: string, currency: CurrencyCode): bigint | null {
  const amount = typed.includes('.') ? typed.replace(/\.?0+$/, '') : typed
  try {
    return parseAmount(amount, currency)
  } catch (e) {
    if (e instanceof DomainError) return null
    throw e
  }
}

function compares(total: bigint, minor: bigint, op: CompareOp | '='): boolean {
  switch (op) {
    case '=':
      return total === minor
    case '>':
      return total > minor
    case '>=':
      return total >= minor
    case '<':
      return total < minor
    case '<=':
      return total <= minor
  }
}

/** Whether a typed number (any of its readings) stands in this relation to the expense's own total. */
function amountMatches(e: Entity<Expense>, readings: string[], op: CompareOp | '='): boolean {
  return readings.some(typed => {
    const minor = minorOf(typed, e.data.currency)
    return minor !== null && compares(e.data.total, minor, op)
  })
}

/**
 * Starts a search. People and groups are ready in the session; expenses are
 * read by `session.step()` (a narrow query needs none: it is done on return).
 */
export async function openSearch(store: Store, query: string, {today, mark = '.', categories = []}: SearchOptions): Promise<SearchSession> {
  const tokens = parseSearchQuery(query, mark)
  if (tokens.length === 0) return {people: [], groups: [], terms: [], found: () => [], isDone: () => true, step: async () => undefined}

  const prefixTerms = (kind: 'w' | 'p' | 'g', prefix: string) => ({kind, min: prefix, max: prefix + '\uffff'})
  const wordHits = (kind: 'w' | 'p' | 'g', prefix: string): Promise<SearchTerm[]> => store.terms(prefixTerms(kind, prefix))
  const wordCount = (prefix: string) => store.termCount(prefixTerms('w', prefix))
  /** The currencies that have an expense: a skip scan of the amount keys, one read each. */
  const currencies = async () => {
    const out: CurrencyCode[] = []
    for (let min = ''; ; ) {
      const [first] = await store.terms({kind: 'a', min, limit: 1})
      if (!first) return out
      const currency = first.term.slice(0, first.term.indexOf(':'))
      out.push(currency)
      min = `${currency};`
    }
  }
  let currencyList: Promise<CurrencyCode[]> | undefined
  const knownCurrencies = () => (currencyList ??= currencies())

  /* ------------------------------------------------------------------ */
  /* Candidates: a superset of the expenses a token can match            */
  /* ------------------------------------------------------------------ */

  const expenses = new Map<string, Entity<Expense>>()
  const load = async (ids: Iterable<string>) => {
    const missing = [...new Set(ids)].filter(id => !expenses.has(id))
    for (const e of await store.getMany<Expense>('expense', missing)) expenses.set(e.id, e)
  }
  const take = (found: Entity<Expense>[]) => {
    for (const e of found) expenses.set(e.id, e)
    return found.map(e => e.id)
  }
  const dateRange = async (from: string, to: string) => take((await store.page<Expense>('expense', {index: 'byDate', min: from, max: to, limit: ALL})).items)

  /** Expenses whose own words, group, people or category start with `prefix`. */
  async function textCandidates(prefix: string): Promise<string[]> {
    const ids = (await wordHits('w', prefix)).map(h => h.entityId)
    for (const h of await wordHits('g', prefix))
      ids.push(...take((await store.page<Expense>('expense', {index: 'byGroupDate', eq: [h.entityId], limit: ALL})).items))
    for (const h of await wordHits('p', prefix)) ids.push(...(await store.parties({index: 'byPersonDate', eq: [h.entityId], limit: ALL, includeDeleted: true})).items.map(p => p.expenseId))
    for (const c of categories)
      if (startsWith(wordsOf(c.name), prefix)) ids.push(...(await store.terms({kind: 'c', min: c.id, max: c.id})).map(t => t.entityId))
    await load(ids)
    return ids
  }

  async function amountRange(readings: string[], op: CompareOp | '='): Promise<{count: () => Promise<number>; ids: () => Promise<string[]>}> {
    const ranges: Array<{min: string; max: string}> = []
    for (const currency of await knownCurrencies())
      for (const typed of readings) {
        const minor = minorOf(typed, currency)
        if (minor === null) continue
        const [lo, hi] = amountBounds(currency)
        const here = amountTerm(currency, minor)
        ranges.push(
          op === '=' ? {min: here, max: here} : op === '>' ? {min: amountTerm(currency, minor + 1n), max: hi} : op === '>=' ? {min: here, max: hi} : op === '<' ? {min: lo, max: amountTerm(currency, minor - 1n)} : {min: lo, max: here},
        )
      }
    return {
      count: async () => (await Promise.all(ranges.map(r => store.termCount({kind: 'a', ...r})))).reduce((a, b) => a + b, 0),
      ids: async () => (await Promise.all(ranges.map(r => store.terms({kind: 'a', ...r})))).flat().map(t => t.entityId),
    }
  }

  /**
   * How many expenses a word can reach, counted without reading them: its own `w` keys, the expenses of the
   * groups and people it names (`byGroupDate`, and each person's record count from `balances`), and the category keys.
   * A word that is a group or a person's name reaches all of their expenses, however few `w` keys it has.
   */
  async function textEstimate(prefix: string): Promise<number> {
    const [own, groupHits, personHits] = await Promise.all([wordCount(prefix), wordHits('g', prefix), wordHits('p', prefix)])
    const counts = await Promise.all([
      ...groupHits.map(h => store.count('expense', {index: 'byGroupDate', eq: [h.entityId]})),
      ...personHits.map(async h => (await store.balances({personId: h.entityId})).reduce((n, b) => n + b.count, 0)),
      ...categories.filter(c => startsWith(wordsOf(c.name), prefix)).map(c => store.termCount({kind: 'c', min: c.id, max: c.id})),
    ])
    return counts.reduce((a, b) => a + b, own)
  }

  /** How many rows (at most) the token's own keys hold, and a way to read the candidates. */
  async function plan(token: SearchToken): Promise<{estimate: number; candidates: () => Promise<string[]>}> {
    if (token.kind === 'compare') {
      const r = await Promise.all(token.amounts.map(a => amountRange([a], token.op)))
      return {
        estimate: (await Promise.all(r.map(x => x.count()))).reduce((a, b) => a + b, 0),
        candidates: async () => {
          const ids = (await Promise.all(r.map(x => x.ids()))).flat()
          await load(ids)
          return ids
        },
      }
    }
    const own = await textEstimate(token.text)
    const text = () => textCandidates(token.text)
    if (token.kind === 'text') return {estimate: own, candidates: text}
    if (token.kind === 'amount') {
      const r = await amountRange(token.amounts, '=')
      return {
        estimate: own + (await r.count()) + (YEAR.test(token.text) ? 1000 : 0),
        candidates: async () => {
          const ids = [...(await r.ids()), ...(await text())]
          if (YEAR.test(token.text)) ids.push(...(await dateRange(`${token.text}-01-01`, `${token.text}-12-31`)))
          await load(ids)
          return ids
        },
      }
    }
    if (token.kind === 'day') {
      const day = addDays(today, token.offset)
      return {estimate: own + (await store.count('expense', {index: 'byDate', min: day, max: day})), candidates: async () => [...(await dateRange(day, day)), ...(await text())]}
    }
    if (token.year) {
      const from = `${token.year}-${token.month}-01`
      const to = `${token.year}-${token.month}-31`
      return {estimate: own + (await store.count('expense', {index: 'byDate', min: from, max: to})), candidates: async () => [...(await dateRange(from, to)), ...(await text())]}
    }
    return {
      estimate: own + (await store.termCount({kind: 'm', min: token.month, max: token.month})),
      candidates: async () => {
        const ids = [...(await store.terms({kind: 'm', min: token.month, max: token.month})).map(t => t.entityId), ...(await text())]
        await load(ids)
        return ids
      },
    }
  }

  /* ------------------------------------------------------------------ */
  /* People and groups                                                   */
  /* ------------------------------------------------------------------ */

  async function named<T>(type: 'person' | 'group', keep: (e: Entity<T>) => boolean): Promise<Entity<T>[]> {
    if (!tokens.every(t => 'text' in t)) return []
    let ids: Set<string> | undefined
    for (const t of tokens) {
      const hit = new Set((await wordHits(type === 'person' ? 'p' : 'g', (t as {text: string}).text)).map(h => h.entityId))
      ids = ids ? new Set([...ids].filter(id => hit.has(id))) : hit
      if (ids.size === 0) return []
    }
    return (await store.getMany<T>(type, [...ids!])).filter(keep).sort((x, y) => (nameOf(x) < nameOf(y) ? -1 : nameOf(x) > nameOf(y) ? 1 : x.id < y.id ? -1 : 1))
  }
  const nameOf = (e: Entity<unknown>) => fold((e.data as {name: string}).name)

  /* ------------------------------------------------------------------ */
  /* Expenses: smallest token first, the rest checked on its rows        */
  /* ------------------------------------------------------------------ */

  const plans = await Promise.all(tokens.map(plan))
  const driver = plans.reduce((best, p) => (p.estimate < best.estimate ? p : best))

  /** Names the checks read, fetched for the rows of each chunk only (people and groups are renamed in place, never copied into expenses). */
  const people = new Map<string, Entity<Person>>()
  const groups = new Map<string, Entity<Group>>()
  const asked = new Set<string>()
  async function loadNames(rows: Entity<Expense>[]) {
    const personIds = new Set<string>()
    const groupIds = new Set<string>()
    for (const e of rows) {
      for (const id of [...Object.keys(e.data.payers), ...Object.keys(e.data.shares)]) if (!asked.has(`p${id}`)) personIds.add(id)
      if (e.data.groupId && !asked.has(`g${e.data.groupId}`)) groupIds.add(e.data.groupId)
    }
    for (const id of personIds) asked.add(`p${id}`)
    for (const id of groupIds) asked.add(`g${id}`)
    for (const p of await store.getMany<Person>('person', [...personIds])) people.set(p.id, p)
    for (const g of await store.getMany<Group>('group', [...groupIds])) groups.set(g.id, g)
  }
  const categoryNames = new Map(categories.map(c => [c.id, c.name]))

  /**
   * The words an expense can be found by, exactly as the keys say: its own text, its category's name (only a category in
   * the list: an id with no entry is not a word), and the names of its group and people while they are live.
   */
  const wordsOfExpense = (e: Entity<Expense>) => {
    const d = e.data
    const group = d.groupId ? groups.get(d.groupId) : undefined
    const text = [d.title, d.notes, categoryNames.get(d.category) ?? '', group && !group.deleted ? group.data.name : '']
    if (d.split.mode === 'items') for (const item of d.split.items) text.push(item.name ?? '')
    for (const id of new Set([...Object.keys(d.payers), ...Object.keys(d.shares)])) {
      const person = people.get(id)
      if (person && !person.deleted) text.push(person.data.name)
    }
    return wordsOf(text.join(' '))
  }

  function matches(token: SearchToken, e: Entity<Expense>, words: readonly string[]): boolean {
    switch (token.kind) {
      case 'compare':
        return amountMatches(e, token.amounts, token.op)
      case 'amount':
        return amountMatches(e, token.amounts, '=') || (YEAR.test(token.text) && e.data.date.startsWith(token.text)) || startsWith(words, token.text)
      case 'day':
        return e.data.date === addDays(today, token.offset) || startsWith(words, token.text)
      case 'month':
        return (token.year ? e.data.date.slice(0, 7) === `${token.year}-${token.month}` : e.data.date.slice(5, 7) === token.month) || startsWith(words, token.text)
      case 'text':
        return startsWith(words, token.text)
    }
  }

  /** The rows that match every word, deleted ones included (their names must be loaded). */
  const check = (rows: Entity<Expense>[]) =>
    rows.filter(e => {
      const words = wordsOfExpense(e)
      return tokens.every(t => matches(t, e, words))
    })
  /** Newest first; the same day, the later-created first. */
  const newestFirst = (x: Entity<Expense>, y: Entity<Expense>) =>
    x.data.date === y.data.date ? y.createdAt - x.createdAt || (x.id < y.id ? -1 : 1) : x.data.date < y.data.date ? 1 : -1

  const base = {
    people: await named<Person>('person', p => !p.data.isMe),
    groups: await named<Group>('group', () => true),
    terms: tokens.flatMap(t => ('text' in t ? [t.text] : [])),
  }

  if (driver.estimate <= NARROW) {
    const candidateIds = [...new Set(await driver.candidates())]
    await load(candidateIds)
    const rows = candidateIds.map(id => expenses.get(id)).filter((e): e is Entity<Expense> => !!e)
    await loadNames(rows)
    const all = check(rows).sort(newestFirst)
    return {...base, found: () => all, isDone: () => true, step: async () => undefined}
  }

  /* Broad: newest first through `byDate`. `settled` is complete days; `tail` the day still being read. */
  let cursor: Key | null = null
  let isDone = false
  const settled: Entity<Expense>[] = []
  let tail: Entity<Expense>[] = []
  const flush = () => {
    settled.push(...tail.sort(newestFirst))
    tail = []
  }
  let inFlight: Promise<void> | undefined
  const read = async () => {
    // full-read-ok: one chunk newest first; the first page needs one, "Show more" and the totals walk (`searchTotals`, cancelled by the next keystroke) read on
    const page: Page<Entity<Expense>> = await store.page<Expense>('expense', {index: 'byDate', dir: 'prev', after: cursor, limit: CHUNK})
    cursor = page.next
    await loadNames(page.items)
    for (const e of check(page.items)) {
      if (tail.length > 0 && tail[0]!.data.date !== e.data.date) flush()
      tail.push(e)
    }
    // Reading has moved past the tail's day: nothing more can join it.
    const last = page.items.at(-1)
    if (tail.length > 0 && last && last.data.date < tail[0]!.data.date) flush()
    if (!cursor) {
      flush()
      isDone = true
    }
  }
  return {
    ...base,
    found: () => settled,
    isDone: () => isDone,
    step: () => (isDone ? Promise.resolve() : (inFlight ??= read().finally(() => (inFlight = undefined)))),
  }
}

/** Counts and adds up a session's matches. Only meaningful once `isDone()`. */
export function summarizeSearch(found: ReadonlyArray<Entity<Expense>>): SearchSummary {
  // A deleted match is listed, never counted or added up (decision 103).
  const live = found.filter(e => !e.deleted)
  return {count: live.length, totals: sumByCurrency(live.map(e => ({currency: e.data.currency, amount: e.data.total})))}
}

/**
 * Reads the rest of the ledger a chunk at a time and adds up every match.
 * This is the one place a search reads past its first page: a broad query's
 * totals need every match. It checks `isCancelled` between chunks (the next
 * keystroke cancels it) and returns undefined when cancelled.
 */
export async function searchTotals(session: SearchSession, isCancelled: () => boolean): Promise<SearchSummary | undefined> {
  while (!session.isDone()) {
    if (isCancelled()) return undefined
    await session.step()
  }
  return isCancelled() ? undefined : summarizeSearch(session.found())
}

/**
 * The whole answer at once: every match, the totals and the words to
 * highlight. For tests and callers that want it all; the app pages instead.
 */
export async function searchStore(store: Store, query: string, options: SearchOptions): Promise<SearchResults> {
  const session = await openSearch(store, query, options)
  const summary = await searchTotals(session, () => false)
  return {expenses: session.found(), people: session.people, groups: session.groups, totals: summary?.totals ?? {}, terms: session.terms}
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
