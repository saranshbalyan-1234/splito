import {
  type BalanceRow,
  balanceSides,
  cellsByCategory,
  cellsByGroup,
  cellsByPerson,
  cellsOverTime,
  cellTotals,
  compareMinor,
  computeShares,
  type CurrencyCode,
  type DateRange,
  directPlan,
  DomainError,
  evaluateAmount,
  granularityFor,
  magnitude,
  NO_RULES,
  personSummary,
  type SpendCell,
  sumMinor,
  type WeekStart,
  ZERO,
} from '@splito/domain'

import {resolvePeriod} from './period'
import {type AskSource} from './source'
import {
  type Answer,
  type Bucket,
  type CategoryRef,
  type Intent,
  type Measure,
  type Money,
  type PeriodInfo,
  type PeriodSpec,
  type RankRow,
  type Ref,
  type Slice,
  type SpendCurrency,
} from './types'

/** What the engine knows besides the source: who "me" is, today, and the names in the ledger. */
export type AskEnv = {
  source: AskSource
  me: string
  today: string
  weekStart: WeekStart
  defaultCurrency: CurrencyCode
  /** The decimal mark amounts are typed with. */
  mark: '.' | ','
  people: Ref[]
  groups: Ref[]
  categories: CategoryRef[]
}

/** Largest rows shown per currency in a ranking. */
const RANK_ROWS = 5
/**
 * Analytics' limits for a chart (`granularityFor`): days up to 31, weeks up to 183, otherwise
 * months, which come from the stored aggregates. A group's trip may be drawn by day up to 92.
 */
const MAX_DAYS = 31
const MAX_TRIP_DAYS = 92
const MAX_WEEKS = 183
/** Search matches read before the answer says "more": one search page. */
const FIND_READ = 30
const FIND_SHOWN = 5
const SLICES = 8

/** Largest first; equal amounts by key, so an answer never depends on read order. */
const byAmountDesc = <T>(amountOf: (x: T) => bigint, keyOf: (x: T) => string) => (x: T, y: T) =>
  compareMinor(amountOf(y), amountOf(x)) || keyOf(x).localeCompare(keyOf(y))

function sumBy(rows: Array<{currency: CurrencyCode; amount: bigint}>): Money[] {
  const byCurrency = new Map<CurrencyCode, bigint[]>()
  for (const r of rows) byCurrency.set(r.currency, [...(byCurrency.get(r.currency) ?? []), r.amount])
  return [...byCurrency].map(([currency, xs]) => ({currency, amount: sumMinor(xs)})).filter(m => m.amount !== ZERO)
}

/** "You" is drawn from the id, so a stored chat reads in the language it is opened in. */
const refOf = (env: AskEnv, id: string): Ref => (id === env.me ? {id, name: ''} : (env.people.find(p => p.id === id) ?? {id, name: ''}))
const groupRef = (env: AskEnv, id: string): Ref => env.groups.find(g => g.id === id) ?? {id, name: ''}
const categoryRef = (env: AskEnv, id: string): CategoryRef => env.categories.find(c => c.id === id) ?? {id, name: '', color: env.categories.find(c => c.id === 'other')?.color ?? ''}

/* -------------------------------------------------------------------------- */
/* Balances                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * People's own figures: `personSummary` over the same balance rows its list is
 * built from, groups included, so "What does Riya owe me?" is the People figure.
 */
async function summaries(env: AskEnv) {
  const rows: BalanceRow[] = await env.source.balanceRows()
  return personSummary(rows, {includeGroups: true})
}

async function answerBalance(env: AskEnv, person: Ref): Promise<Answer> {
  const mine = (await summaries(env)).find(s => s.person === person.id)
  const lines = Object.entries(mine?.byCurrency ?? {})
    .map(([currency, c]) => ({currency, ...balanceSides(c), direct: c.direct, groups: c.groups}))
    .filter(c => c.owed !== ZERO || c.owe !== ZERO)
    .map(c => ({
      currency: c.currency,
      owed: c.owed,
      owe: c.owe,
      direct: c.direct,
      groups: Object.entries(c.groups)
        .filter(([, amount]) => amount !== ZERO)
        .map(([id, amount]) => ({group: groupRef(env, id), amount}))
        .sort(byAmountDesc(g => magnitude(g.amount), g => g.group.id)),
    }))
    .sort((a, b) => a.currency.localeCompare(b.currency))
  return {kind: 'balance', person, lines}
}

async function answerRanking(env: AskEnv, direction: 'owedToMe' | 'iOwe' | 'both'): Promise<Answer> {
  const owedToMe: RankRow[] = []
  const iOwe: RankRow[] = []
  for (const s of await summaries(env)) {
    for (const [currency, c] of Object.entries(s.byCurrency)) {
      // Each way on its own, as People shows it: owed in a group and owing directly are both listed.
      const {owed, owe} = balanceSides(c)
      if (owed > ZERO) owedToMe.push({person: refOf(env, s.person), currency, amount: owed})
      if (owe > ZERO) iOwe.push({person: refOf(env, s.person), currency, amount: owe})
    }
  }
  // The currency with the most rows leads; within one currency, the largest amount.
  const rowsIn = new Map<CurrencyCode, number>()
  for (const r of [...owedToMe, ...iOwe]) rowsIn.set(r.currency, (rowsIn.get(r.currency) ?? 0) + 1)
  const byCurrency = (a: CurrencyCode, b: CurrencyCode) => (rowsIn.get(b) ?? 0) - (rowsIn.get(a) ?? 0) || a.localeCompare(b)
  const top = (rows: RankRow[]) => {
    const per = new Map<CurrencyCode, number>()
    return [...rows]
      .sort((a, b) => byCurrency(a.currency, b.currency) || byAmountDesc((r: RankRow) => r.amount, r => r.person.id)(a, b))
      .filter(r => {
        const n = per.get(r.currency) ?? 0
        per.set(r.currency, n + 1)
        return n < RANK_ROWS
      })
  }
  const totalOf = (rows: RankRow[]) => sumBy(rows).sort((a, b) => byCurrency(a.currency, b.currency))
  return {kind: 'ranking', direction, owedToMe: top(owedToMe), iOwe: top(iOwe), totals: {owedToMe: totalOf(owedToMe), iOwe: totalOf(iOwe)}}
}

async function answerGroupBalance(env: AskEnv, group: Ref): Promise<Answer> {
  const {nets, rules} = await env.source.groupNets(group.id)
  const mine: Money[] = []
  const owes: Extract<Answer, {kind: 'groupBalance'}>['owes'] = []
  const outside: CurrencyCode[] = []
  const unplanned: CurrencyCode[] = []
  for (const [currency, net] of Object.entries(nets).sort(([a], [b]) => a.localeCompare(b))) {
    if (!Object.values(net).some(v => v !== ZERO)) continue
    if (net[env.me]) mine.push({currency, amount: net[env.me]!})
    let plan
    try {
      plan = directPlan(net, rules ?? NO_RULES)
    } catch (e) {
      // No plan (the balances do not add up): the currency is named, never left out as if it were settled.
      if (!(e instanceof DomainError)) throw e
      unplanned.push(currency)
      continue
    }
    // The rules left no plan, so this one goes outside them, as the group page says.
    if (plan.stuck.length > 0) outside.push(currency)
    // Biggest payments first, as Settle up lists them.
    for (const t of [...plan.transfers].sort(byAmountDesc(x => x.amount, x => x.from))) {
      owes.push({from: refOf(env, t.from), to: refOf(env, t.to), currency, amount: t.amount})
    }
  }
  return {kind: 'groupBalance', group, mine, owes, outside, unplanned}
}

/* -------------------------------------------------------------------------- */
/* Spending                                                                   */
/* -------------------------------------------------------------------------- */

type Scoped = {category?: string; group?: Ref; person?: Ref}

/** The cells of one currency over a period, narrowed to the group and category asked for. */
async function scopedCells(env: AskEnv, currency: CurrencyCode, range: DateRange, exact: boolean, scope: Scoped): Promise<SpendCell[]> {
  const cells = await env.source.cells(currency, range, exact, scope.group?.id)
  return cells.filter(c => (!scope.group || c.groupId === scope.group.id) && (!scope.category || c.kind !== 'expense' || c.category === scope.category))
}

/** The period's dates in one currency; "all time" is what that currency's records span in the scope. */
async function rangeFor(env: AskEnv, spec: PeriodSpec, currency: CurrencyCode, scope: Scoped): Promise<{info: PeriodInfo; range: DateRange} | null> {
  const resolved = resolvePeriod(spec, env.today, env.weekStart)
  if (resolved) return {info: resolved, range: {from: resolved.from, to: resolved.to}}
  const bounds = await env.source.bounds(currency, scope.group?.id)
  return bounds ? {info: {kind: 'all', from: bounds.from, to: bounds.to}, range: bounds} : null
}

/** One period across several currencies: the widest dates any of them used. */
const widen = (a: PeriodInfo | undefined, b: PeriodInfo): PeriodInfo => (a ? {...a, from: b.from < a.from ? b.from : a.from, to: b.to > a.to ? b.to : a.to} : b)

const valueOf = (t: {share: bigint; paid: bigint; total: bigint}, measure: Measure): bigint => (measure === 'paid' ? t.paid : measure === 'total' ? t.total : t.share)

/** Sums of whole-record totals or one person's paid, by category or group (what `cellsBy*` leaves out: their slices are by share). */
function sliceBy(cells: SpendCell[], by: 'category' | 'group', measure: 'total' | 'paid', who: string): Array<{key: string; value: bigint; count: number}> {
  const groups = new Map<string, SpendCell[]>()
  for (const c of cells) {
    if (c.kind !== 'expense' || c.person !== (measure === 'total' ? '' : who)) continue
    const key = by === 'category' ? c.category : c.groupId
    groups.set(key, [...(groups.get(key) ?? []), c])
  }
  return [...groups]
    .map(([key, cs]) => ({key, value: sumMinor(cs.map(c => (measure === 'total' ? c.total : c.paid))), count: cs.reduce((n, c) => n + c.count, 0)}))
    .filter(s => s.value !== ZERO)
    .sort(byAmountDesc(s => s.value, s => s.key))
}

function slicesOf(env: AskEnv, cells: SpendCell[], breakdown: 'category' | 'person' | 'group' | undefined, measure: Measure, who: string): Slice[] {
  const catSlice = (key: string, value: bigint, count: number): Slice => ({key, label: categoryRef(env, key).name, value, count, color: categoryRef(env, key).color})
  const grpSlice = (key: string, value: bigint, count: number): Slice => ({key, label: key ? groupRef(env, key).name : '', value, count})
  if (breakdown === 'category')
    return measure === 'share' ? cellsByCategory(cells, who).map(s => catSlice(s.key, s.share, s.count)) : sliceBy(cells, 'category', measure, who).map(s => catSlice(s.key, s.value, s.count))
  if (breakdown === 'group')
    return measure === 'share' ? cellsByGroup(cells, who).map(s => grpSlice(s.key ?? '', s.share, s.count)) : sliceBy(cells, 'group', measure, who).map(s => grpSlice(s.key, s.value, s.count))
  if (breakdown === 'person') return cellsByPerson(cells).map(s => ({key: s.key, label: refOf(env, s.key).name, value: s.share, count: s.count}))
  return []
}

async function answerSpend(env: AskEnv, intent: Extract<Intent, {kind: 'spend'}>): Promise<Answer> {
  const spec: PeriodSpec = intent.period ?? (intent.group ? {kind: 'all'} : {kind: 'month', offset: 0})
  const who = intent.person?.id ?? env.me
  // A person has one figure here, their share: whole-record totals and what I paid are not theirs to filter by participant.
  const measure: Measure = intent.person ? 'share' : intent.measure
  // A category or group already narrows the answer: only an open question gets the category split.
  const breakdown = intent.breakdown ?? (intent.category || intent.group ? undefined : 'category')
  const currencies: SpendCurrency[] = []
  let period: PeriodInfo | undefined
  for (const currency of await env.source.currencies()) {
    const r = await rangeFor(env, spec, currency, intent)
    if (!r) continue
    period = widen(period, r.info)
    const cells = await scopedCells(env, currency, r.range, false, intent)
    const t = cellTotals(cells, who)
    // A person's records are the ones they have a share in, not every record in scope.
    const count = intent.person ? cells.filter(c => c.kind === 'expense' && c.person === who && c.share !== ZERO).reduce((n, c) => n + c.count, 0) : t.count
    if (count === 0) continue
    currencies.push({currency, share: t.share, paid: t.paid, total: t.total, count, slices: slicesOf(env, cells, breakdown, measure, who).slice(0, SLICES)})
  }
  return {
    kind: 'spend',
    measure,
    period: period ?? resolvePeriod({kind: 'month', offset: 0}, env.today, env.weekStart)!,
    category: intent.category ? categoryRef(env, intent.category) : undefined,
    group: intent.group,
    person: intent.person,
    breakdown,
    currencies,
  }
}

async function answerTrend(env: AskEnv, intent: Extract<Intent, {kind: 'trend'}>): Promise<Answer> {
  const who = intent.person?.id ?? env.me
  const measure: Measure = intent.person ? 'share' : intent.measure
  const spec: PeriodSpec =
    intent.period ?? (intent.group ? {kind: 'all'} : intent.by === 'month' ? {kind: 'year', offset: 0} : intent.by === 'week' ? {kind: 'months', n: 3} : {kind: 'month', offset: 0})
  // One range for the whole answer ("all time" spans every currency's records), so every currency is drawn in the same buckets.
  const currencies = await env.source.currencies()
  let period: PeriodInfo | undefined
  for (const currency of currencies) {
    const r = await rangeFor(env, spec, currency, intent)
    if (r) period = widen(period, r.info)
  }
  const range: DateRange = period ? {from: period.from, to: period.to} : {from: env.today, to: env.today}
  const days = Math.round((Date.parse(range.to) - Date.parse(range.from)) / 86_400_000) + 1
  const natural = granularityFor(range)
  const asked: Bucket = intent.by ?? (natural === 'year' ? 'month' : natural)
  // Finer than Analytics draws for these dates: by month, from the stored aggregates, not by reading every record.
  const isTooFine = (asked === 'day' && days > (intent.group ? MAX_TRIP_DAYS : MAX_DAYS)) || (asked === 'week' && days > MAX_WEEKS)
  const bucket: Bucket = isTooFine ? 'month' : asked
  const out: Extract<Answer, {kind: 'trend'}>['currencies'] = []
  for (const currency of currencies) {
    const cells = await scopedCells(env, currency, range, bucket === 'day' || bucket === 'week', intent)
    const points = cellsOverTime(cells, who, range, bucket, env.weekStart).map(b => ({key: b.key, from: b.from, to: b.to, value: valueOf(b, measure)}))
    const total = sumMinor(points.map(p => p.value))
    if (total === ZERO) continue
    out.push({currency, total, points})
  }
  return {
    kind: 'trend',
    measure,
    bucket,
    isCoarsened: isTooFine && !!intent.by,
    period: period ?? resolvePeriod({kind: 'month', offset: 0}, env.today, env.weekStart)!,
    category: intent.category ? categoryRef(env, intent.category) : undefined,
    group: intent.group,
    person: intent.person,
    currencies: out,
  }
}

/* -------------------------------------------------------------------------- */
/* Find and split                                                             */
/* -------------------------------------------------------------------------- */

async function answerFind(env: AskEnv, query: string): Promise<Answer> {
  const read = await env.source.search(query, FIND_READ)
  return {
    kind: 'find',
    query,
    count: read.found.length,
    isPartial: !read.isDone,
    totals: read.isDone ? Object.entries(read.totals).map(([currency, amount]) => ({currency, amount})) : [],
    rows: read.found.slice(0, FIND_SHOWN).map(e => ({id: e.id, title: e.title, date: e.date, currency: e.currency, total: e.total, group: e.groupId ? groupRef(env, e.groupId).name : undefined})),
  }
}

function answerSplit(env: AskEnv, intent: Extract<Intent, {kind: 'split'}>): Answer {
  const currency = intent.currency ?? env.defaultCurrency
  let amount: Money | undefined
  if (intent.amountText) {
    try {
      const parsed = evaluateAmount(intent.amountText, currency, env.mark)
      if (parsed > ZERO) amount = {currency, amount: parsed}
    } catch (e) {
      // "1.234k" in a currency without the decimals, or too big: no amount, the sheet asks.
      if (!(e instanceof DomainError)) throw e
    }
  }
  let each: Extract<Answer, {kind: 'split'}>['each']
  if (amount) {
    const shares = Object.values(computeShares(amount.amount, {mode: 'equal', participants: Array.from({length: intent.ways}, (_, i) => `p${i}`)}))
    const high = shares.reduce((m, s) => (s > m ? s : m), shares[0]!)
    const low = shares.reduce((m, s) => (s < m ? s : m), shares[0]!)
    each = {high, low, highCount: shares.filter(s => s === high).length}
  }
  return {kind: 'split', title: intent.title, ways: intent.ways, amount, each}
}

/**
 * Answers one parsed question from the local database through `AskSource`:
 * stored balances, aggregates, date indexes and search terms, never the
 * ledger (ARCHITECTURE 9.8). Money stays exact and is never added across
 * currencies. Nothing here touches the network.
 */
export async function answerIntent(intent: Intent, env: AskEnv): Promise<Answer> {
  switch (intent.kind) {
    case 'balance':
      return answerBalance(env, intent.person)
    case 'ranking':
      return answerRanking(env, intent.direction)
    case 'groupBalance':
      return answerGroupBalance(env, intent.group)
    case 'spend':
      return answerSpend(env, intent)
    case 'trend':
      return answerTrend(env, intent)
    case 'find':
      return answerFind(env, intent.query)
    case 'split':
      return answerSplit(env, intent)
    case 'help':
    case 'clarify':
    case 'unsupported':
      return intent
  }
}
