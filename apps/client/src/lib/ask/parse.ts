import {
  type Bucket,
  type Breakdown,
  type Intent,
  type Measure,
  type PeriodSpec,
  type Ref,
  type Scope,
  type Suggestion,
  type Vocab,
} from './types'
import {fold, hasAny, hasPhrase, tokens, wholeNumber} from './text'

/*
 * The question grammar: keywords in English, Devanagari Hindi and romanised
 * Hindi, matched on whole words. Deliberately small and closed: a question
 * outside it is `unsupported`, never guessed at (ARCHITECTURE 26.19).
 */

const WHO = ['who', 'whom', 'whos', 'kaun', 'kon', 'kisne', 'kisko', 'kise', 'kis', 'कौन', 'किसने', 'किसको', 'किसे', 'किस']
const OWE = [
  'owe', 'owes', 'owed', 'owing', 'due', 'dues', 'debt', 'debts', 'payback', 'pay back', 'get back', 'dena', 'dene', 'udhaar', 'udhar', 'baaki', 'baki', 'lena', 'lene',
  'देना', 'देने', 'देगा', 'देगी', 'उधार', 'बकाया', 'बाकी', 'लेना', 'लेने', 'कर्ज',
]
const I_OWE = [
  'i owe', 'do i owe', 'i have to pay', 'should i pay', 'i must pay', 'owe to', 'mujhe kisko', 'mujhe kise', 'mujhe kis ko', 'main kisko', 'main kise',
  'मुझे किसको', 'मुझे किसे', 'मैं किसे', 'मैं किसको', 'किसको देना',
]
const OWED_TO_ME = ['owes me', 'owe me', 'owed to me', 'am i owed', 'owing me', 'kisne mujhe', 'mujhe lena', 'mujhe milna', 'किसने मुझे', 'मुझे लेना', 'मुझे मिलना']
const BOTH = ['owes whom', 'owe whom', 'whom owes', 'overall balance', 'net balance', 'all balances', 'my balance', 'my balances', 'balances', 'mera balance', 'मेरा बैलेंस', 'मेरा हिसाब']
const BALANCE = ['balance', 'balances', 'settle', 'settled', 'settlement', 'net', 'baki', 'hisaab', 'hisab', 'बैलेंस', 'हिसाब', 'सेटल']
const SPEND = [
  'spend', 'spent', 'spending', 'expense', 'expenses', 'expenditure', 'cost', 'costs', 'costing', 'kharch', 'kharcha', 'kharche', 'kharchaa',
  'खर्च', 'खर्चा', 'खर्चे', 'लागत',
]
const TOTAL = ['total cost', 'altogether', 'in all', 'everyone', 'everybody', 'all together', 'combined', 'whole group', 'entire', 'cost', 'costs', 'costing', 'sabka', 'सबका', 'कुल लागत']
const ME = ['my', 'me', 'i', 'mine', 'mera', 'meri', 'mere', 'mujhe', 'main', 'mai', 'मेरा', 'मेरी', 'मेरे', 'मुझे', 'मैं']
const TREND = [
  'trend', 'trends', 'over time', 'daily', 'weekly', 'monthly', 'by day', 'per day', 'each day', 'every day', 'day by day', 'day wise', 'daywise',
  'by week', 'per week', 'each week', 'week by week', 'by month', 'per month', 'each month', 'every month', 'month by month', 'month wise', 'monthwise',
  'har din', 'roz', 'rozana', 'din ke hisab se', 'mahine ke hisab se', 'हर दिन', 'रोज', 'रोज़ाना', 'दैनिक', 'मासिक', 'हर महीने', 'दिन के हिसाब से', 'महीने के हिसाब से',
]
const BY_DAY = ['by day', 'per day', 'each day', 'every day', 'day by day', 'day wise', 'daywise', 'daily', 'har din', 'roz', 'rozana', 'din ke hisab se', 'हर दिन', 'रोज', 'रोज़ाना', 'दैनिक', 'दिन के हिसाब से']
const BY_WEEK = ['by week', 'per week', 'each week', 'week by week', 'weekly', 'week wise', 'हर हफ्ते', 'साप्ताहिक']
const BY_MONTH = ['by month', 'per month', 'each month', 'every month', 'month by month', 'month wise', 'monthwise', 'monthly', 'mahine ke hisab se', 'har mahine', 'हर महीने', 'मासिक', 'महीने के हिसाब से']
const BY_CATEGORY = ['by category', 'by categories', 'per category', 'category wise', 'categorywise', 'category', 'categories', 'breakdown', 'श्रेणी', 'कैटेगरी']
const BY_PERSON = ['by person', 'per person', 'person wise', 'by friend', 'by people', 'by friends', 'har vyakti', 'हर व्यक्ति']
const BY_GROUP = ['by group', 'per group', 'group wise', 'by groups', 'हर ग्रुप']
const FIND = ['find', 'search', 'look for', 'looking for', 'dhundo', 'dhoondo', 'khojo', 'खोजो', 'ढूंढो', 'ढूँढो', 'खोज']
const SHOW = ['show', 'list', 'display', 'dikhao', 'dikha', 'batao', 'bata', 'दिखाओ', 'दिखा', 'बताओ']
const EXPENSE_NOUNS = ['expenses', 'expense', 'transactions', 'transaction', 'bills', 'bill', 'payments', 'purchases', 'kharche', 'खर्चे']
const SPLIT = ['split', 'splits', 'splitting', 'divide', 'divided', 'bato', 'baato', 'baanto', 'banto', 'bant', 'बांटो', 'बाँटो', 'बांट', 'बाटो', 'बांटना']
const HELP = ['help', 'what can you do', 'what can i ask', 'what do you know', 'how do you work', 'madad', 'kya kar sakte ho', 'kya puch sakta', 'मदद', 'आप क्या कर सकते हैं', 'क्या पूछ सकता']
const GREET = ['hi', 'hello', 'hey', 'namaste', 'namaskar', 'नमस्ते', 'नमस्कार', 'हेलो']

/* Words that carry no meaning of their own in a name, a title or a search. */
const FILLER = new Set(
  (
    'a an the of in on at for to from with by is are was were am be do does did can could would will you please tell me my mine i and or ' +
    'how much many what whats show list find search all any total spent spend spending expense expenses paid pay last this month year week day days today yesterday ' +
    'ko ka ki ke mein me se hai hain tha kya kitna kitne kitni mujhe mera meri mere main hum aur ya ' +
    'ways way people persons person friends friend equally evenly between among into per'
  ).split(' '),
)
const GENERIC_GROUP_WORDS = new Set(['trip', 'group', 'the', 'and', 'for', 'with', 'flat', 'home', 'house', 'family', 'friends', 'office', 'team', 'party', 'club'])

const CATEGORY_SYNONYMS: Record<string, string[]> = {
  food: ['food', 'dining', 'restaurant', 'restaurants', 'eating', 'meals', 'meal', 'lunch', 'dinner', 'breakfast', 'khana', 'खाना', 'खाने', 'भोजन'],
  transport: ['transport', 'travel', 'cab', 'cabs', 'taxi', 'uber', 'fuel', 'petrol', 'commute', 'transit', 'यात्रा', 'परिवहन'],
  stay: ['stay', 'hotel', 'hotels', 'accommodation', 'rent', 'lodging', 'airbnb', 'होटल'],
  shopping: ['shopping', 'clothes', 'purchases', 'खरीदारी', 'शॉपिंग'],
  entertainment: ['entertainment', 'movies', 'movie', 'fun', 'concert', 'concerts', 'games', 'मनोरंजन'],
  bills: ['bills', 'bill', 'utilities', 'electricity', 'wifi', 'internet', 'बिल'],
  groceries: ['groceries', 'grocery', 'kirana', 'किराना', 'राशन'],
}

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']
const monthOfWord = (w: string): number | undefined => {
  const i = MONTHS.findIndex(m => m === w || (w.length >= 3 && m.startsWith(w) && (w === m.slice(0, 3) || w === 'sept')))
  return i < 0 ? undefined : i + 1
}

const CURRENCY_MARKS: Array<[RegExp, string]> = [
  [/₹|\brs\.?\b|\binr\b|\brupees?\b|रुपये|रुपए/i, 'INR'],
  [/\$|\busd\b|\bdollars?\b/i, 'USD'],
  [/€|\beur\b|\beuros?\b/i, 'EUR'],
  [/£|\bgbp\b|\bpounds?\b/i, 'GBP'],
]

/* ------------------------------------------------------------------ */
/* Names                                                               */
/* ------------------------------------------------------------------ */

type Match = {ref: Ref; score: number; start: number; end: number}

/** Where `ref` is named in `words`: its whole name as a run, or (people) its first name, or (groups) one distinctive word. */
function matchRef(words: string[], used: boolean[], ref: Ref, kind: 'person' | 'group'): Match | undefined {
  const name = tokens(ref.name)
  if (name.length === 0) return undefined
  const free = (i: number) => !used[i]
  for (let i = 0; i + name.length <= words.length; i++) {
    if (name.every((w, j) => words[i + j] === w && free(i + j))) return {ref, score: 100 + name.length, start: i, end: i + name.length}
  }
  if (kind === 'person') {
    const first = name[0]!
    if (first.length >= 2) {
      const at = words.findIndex((w, i) => w === first && free(i))
      if (at >= 0) return {ref, score: 10 + first.length, start: at, end: at + 1}
    }
  } else {
    const best = name.filter(w => w.length >= 3 && !GENERIC_GROUP_WORDS.has(w)).sort((x, y) => y.length - x.length)[0]
    if (best) {
      const at = words.findIndex((w, i) => w === best && free(i))
      if (at >= 0) return {ref, score: 10 + best.length, start: at, end: at + 1}
    }
  }
  return undefined
}

/** The one person or group the question names (best match), or the several tied for it. */
function resolveRef(words: string[], used: boolean[], refs: Ref[], kind: 'person' | 'group'): {found?: Ref; tied?: Ref[]; term?: string} {
  const matches = refs.flatMap(r => matchRef(words, used, r, kind) ?? [])
  if (matches.length === 0) return {}
  const top = Math.max(...matches.map(m => m.score))
  const best = matches.filter(m => m.score === top)
  // The same word naming two things ("Riya Sharma", "Riya Kapoor") is a question back, not a guess.
  const spans = new Set(best.map(m => `${m.start}:${m.end}`))
  if (best.length > 1 && spans.size === 1) return {tied: best.map(m => m.ref), term: words.slice(best[0]!.start, best[0]!.end).join(' ')}
  const pick = best[0]!
  for (let i = pick.start; i < pick.end; i++) used[i] = true
  return {found: pick.ref}
}

/* ------------------------------------------------------------------ */
/* Periods                                                             */
/* ------------------------------------------------------------------ */

function parsePeriod(words: string[], used: boolean[]): PeriodSpec | undefined {
  const text = words.map((w, i) => (used[i] ? '' : w)).filter(Boolean)
  const has = (...p: string[]) => hasAny(text, p)
  if (has('all time', 'alltime', 'ever', 'lifetime', 'so far', 'till now', 'until now', 'since the beginning', 'sabhi samay', 'अब तक', 'आज तक', 'कुल मिलाकर')) return {kind: 'all'}
  if (has('last month', 'previous month', 'past month', 'pichle mahine', 'pichhle mahine', 'पिछले महीने', 'पिछला महीना')) return {kind: 'month', offset: -1}
  if (has('this month', 'current month', 'is mahine', 'इस महीने', 'इस माह')) return {kind: 'month', offset: 0}
  if (has('last week', 'previous week', 'pichle hafte', 'pichhle hafte', 'पिछले हफ्ते', 'पिछले सप्ताह')) return {kind: 'week', offset: -1}
  if (has('this week', 'current week', 'is hafte', 'is week', 'इस हफ्ते', 'इस सप्ताह')) return {kind: 'week', offset: 0}
  if (has('last year', 'previous year', 'pichle saal', 'pichhle saal', 'पिछले साल', 'पिछले वर्ष')) return {kind: 'year', offset: -1}
  if (has('this year', 'current year', 'is saal', 'इस साल', 'इस वर्ष')) return {kind: 'year', offset: 0}
  if (has('yesterday', 'kal', 'कल', 'बीते कल')) return {kind: 'yesterday'}
  if (has('today', 'aaj', 'aj', 'आज')) return {kind: 'today'}
  // "last 7 days", "past 30 days", "pichle 10 din", "last 3 months"
  for (let i = 0; i + 2 < text.length; i++) {
    if (!['last', 'past', 'previous', 'pichle', 'pichhle', 'पिछले', 'बीते'].includes(text[i]!)) continue
    const n = wholeNumber(text[i + 1]!)
    if (n === undefined || n < 1) continue
    const unit = text[i + 2]!
    if (['day', 'days', 'din', 'दिन'].includes(unit)) return {kind: 'days', n}
    if (['week', 'weeks', 'hafte', 'हफ्ते', 'सप्ताह'].includes(unit)) return {kind: 'days', n: n * 7}
    if (['month', 'months', 'mahine', 'महीने'].includes(unit)) return {kind: 'months', n}
  }
  for (let i = 0; i < text.length; i++) {
    const m = monthOfWord(text[i]!)
    // "may" is also a verb: only read it as a month beside a year or after in / of / during.
    if (m === undefined) continue
    const next = text[i + 1]
    const year = next && /^(19|20)\d\d$/.test(next) ? Number(next) : undefined
    if (text[i] === 'may' && year === undefined && !['in', 'of', 'during'].includes(text[i - 1] ?? '')) continue
    return {kind: 'monthOf', month: m, year}
  }
  const year = text.find(w => /^(19|20)\d\d$/.test(w))
  if (year) return {kind: 'yearOf', year: Number(year)}
  return undefined
}

/* ------------------------------------------------------------------ */
/* The parser                                                          */
/* ------------------------------------------------------------------ */

function measureOf(words: string[], hasGroup: boolean): Measure {
  if (hasAny(words, ['paid', 'bhara', 'chukaya', 'चुकाया', 'भरा']) && hasAny(words, ME)) return 'paid'
  if (hasPhrase(words, 'i paid') || hasPhrase(words, 'did i pay') || hasPhrase(words, 'have i paid')) return 'paid'
  const mine = hasAny(words, ME)
  if (hasAny(words, TOTAL) && !(mine && hasGroup && !hasAny(words, ['cost', 'costs', 'everyone', 'altogether']))) return 'total'
  return 'share'
}

function categoryOf(words: string[], used: boolean[], categories: Vocab['categories']): string | undefined {
  const text = words.map((w, i) => (used[i] ? '' : w))
  const own = categories.find(c => {
    const name = tokens(c.name).join(' ')
    return c.id !== 'other' && name !== '' && hasPhrase(text, name)
  })
  if (own) return own.id
  const ids = new Set(categories.map(c => c.id))
  for (const [id, synonyms] of Object.entries(CATEGORY_SYNONYMS)) {
    if (ids.has(id) && hasAny(text, synonyms)) return id
  }
  return undefined
}

/** Strips what is not part of a search: verbs, fillers and period words. */
function searchQueryOf(words: string[], used: boolean[], rawQuestion: string): string {
  // "over 1000" / "under 500" become the search's own comparisons.
  const compare = /\b(over|above|more than|greater than|at least|under|below|less than|at most|upar|neeche)\s+[₹$€£]?\s*(\d[\d,.]*\s?[klmc]?r?)/i.exec(fold(rawQuestion))
  const parts: string[] = []
  if (compare) {
    const op = /over|above|more|greater|upar/.test(compare[1]!) ? '>' : /at least/.test(compare[1]!) ? '>=' : /at most/.test(compare[1]!) ? '<=' : '<'
    parts.push(`${op}${compare[2]!.replace(/\s/g, '')}`)
  }
  const skip = new Set([...FIND, ...SHOW, ...EXPENSE_NOUNS, 'over', 'above', 'more', 'than', 'greater', 'at', 'least', 'under', 'below', 'less', 'most', 'upar', 'neeche'].flatMap(w => w.split(' ')))
  const numberInCompare = compare ? compare[2]!.replace(/[\s,]/g, '') : ''
  for (const [i, w] of words.entries()) {
    if (used[i] || FILLER.has(w) || skip.has(w)) continue
    if (compare && w.replace(/,/g, '') === numberInCompare) continue
    parts.push(w)
  }
  return parts.join(' ').trim()
}

/** The "N ways" of a split question and the other number as the amount. */
function parseSplit(words: string[], raw: string): {ways: number; amountText?: string; currency?: string; title?: string} | undefined {
  const WAYS_AFTER = ['ways', 'way', 'people', 'persons', 'person', 'friends', 'friend', 'log', 'logon', 'लोग', 'लोगों', 'दोस्तों', 'दोस्त']
  const WAYS_BEFORE = ['between', 'among', 'amongst', 'beech']
  const WAYS_UNIT_AFTER = ['mein', 'me', 'में', 'ke', 'के']
  let ways: number | undefined
  let at = -1
  for (let i = 0; i < words.length; i++) {
    const n = wholeNumber(words[i]!)
    if (n === undefined) continue
    const after = words[i + 1]
    const before = words[i - 1]
    const isWays =
      (after && WAYS_AFTER.includes(after)) ||
      (before && WAYS_BEFORE.includes(before)) ||
      (after && WAYS_UNIT_AFTER.includes(after) && words.length > i + 2)
    if (isWays && n >= 2) {
      ways = after === 'friends' || after === 'friend' || after === 'दोस्तों' || after === 'दोस्त' ? n + 1 : n
      at = i
      break
    }
  }
  if (ways === undefined || ways > 50) return undefined
  const isAmount = (w: string) => /^\d[\d,.]*(k|l|lakh|lac|cr|crore|m)?$/.test(w)
  const amountIdx = words.findIndex((w, i) => i !== at && isAmount(w))
  const amountText = amountIdx >= 0 ? words[amountIdx] : undefined
  const currency = CURRENCY_MARKS.find(([re]) => re.test(raw))?.[1]
  const titleWords = words.filter((w, i) => i !== at && i !== amountIdx && !SPLIT.includes(w) && !FILLER.has(w) && !['night', 'nights', 'tonight', 'bill', 'rs', 'inr', 'usd', 'eur', 'gbp', 'rupees', 'rupee', 'dollars', 'euros'].includes(w) && !WAYS_AFTER.includes(w) && !WAYS_BEFORE.includes(w))
  const title = titleWords.slice(0, 4).join(' ')
  return {ways, amountText, currency, title: title ? title.charAt(0).toUpperCase() + title.slice(1) : undefined}
}

/** The supported question closest to one the engine cannot answer. */
function suggest(words: string[], vocab: Vocab): Suggestion {
  const person = vocab.people[0]
  const group = vocab.groups[0]
  const category = vocab.categories.find(c => c.id !== 'other')
  if (hasAny(words, SPLIT) || hasAny(words, ['bill', 'dinner', 'lunch'])) return {key: 'split'}
  if (hasAny(words, ['whom', 'kisko', 'किसको']) && hasAny(words, OWE)) return {key: 'iOweMost'}
  if (hasAny(words, OWE) || hasAny(words, BALANCE) || hasAny(words, WHO)) {
    if (group && hasAny(words, ['group', 'trip', 'whom'])) return {key: 'groupOwes', name: group.name}
    if (person && hasAny(words, ['friend', 'friends', 'someone', 'anyone', 'person', 'dost'])) return {key: 'balanceWith', name: person.name}
    return {key: 'owedMost'}
  }
  if (hasAny(words, ['trip', 'group', 'day', 'daily', 'trend']) && group) return {key: 'groupByDay', name: group.name}
  if (hasAny(words, ['category', 'categories', 'breakdown', 'where'])) return {key: 'byCategory'}
  if (hasAny(words, SPEND) || hasAny(words, ['money', 'paisa', 'paise', 'budget', 'average', 'biggest', 'largest', 'most'])) return category ? {key: 'spendCategory', name: category.name} : {key: 'spendMonth'}
  return {key: 'owedMost'}
}

/** The supported question a free-form one is nearest to, shown with "I can answer this once you sign in". */
export function closestSuggestion(question: string, vocab: Vocab): Suggestion {
  return suggest(tokens(question), vocab)
}

/**
 * Reads one question. Returns `unsupported` (with the nearest supported
 * question) for anything outside the grammar; it never guesses.
 */
export function parseQuestion(question: string, vocab: Vocab): Intent {
  const words = tokens(question)
  if (words.length === 0) return {kind: 'unsupported', suggestion: {key: 'owedMost'}}
  const used = words.map(() => false)

  if ((words.length <= 6 && hasAny(words, GREET) && !hasAny(words, OWE)) || hasAny(words, HELP)) return {kind: 'help'}

  // Names first, so a group called "Food Court" is not read as the Food category.
  const g = resolveRef(words, used, vocab.groups, 'group')
  if (g.tied) return {kind: 'clarify', term: g.term!, options: g.tied}
  const p = resolveRef(words, used, vocab.people, 'person')
  if (p.tied) return {kind: 'clarify', term: p.term!, options: p.tied}
  const group = g.found
  const person = p.found

  // Split X N ways: an action, so it comes before any reading of the amount as a filter.
  if (hasAny(words, SPLIT)) {
    const s = parseSplit(words, question)
    if (s) return {kind: 'split', ways: s.ways, amountText: s.amountText, currency: s.currency, title: s.title}
    return {kind: 'unsupported', suggestion: {key: 'split'}}
  }

  const isTrend = hasAny(words, TREND)
  const isSpend = hasAny(words, SPEND)
  const hasOwe = hasAny(words, OWE)
  const hasWho = hasAny(words, WHO)
  const isBalanceWord = hasAny(words, BALANCE)
  const wantsBreakdown = hasAny(words, ['by', 'per', 'wise', 'breakdown', 'श्रेणी'])

  // Find expenses: explicit verbs, or "show expenses ...", unless it is a chart or total in disguise.
  const isFindVerb = hasAny(words, FIND) || (hasAny(words, SHOW) && hasAny(words, EXPENSE_NOUNS))
  if (isFindVerb && !isTrend && !(wantsBreakdown && (hasAny(words, BY_CATEGORY) || hasAny(words, BY_PERSON) || hasAny(words, BY_GROUP)))) {
    // Names stay in the query: Search matches a group's or a friend's name too.
    const query = searchQueryOf(words, words.map(() => false), question)
    if (query) return {kind: 'find', query}
  }

  // Who owes me / whom do I owe / who owes whom
  if (hasOwe && hasWho && !person) {
    if (group && (hasAny(words, ['whom', 'kisko', 'kisne', 'किसको', 'किसने', 'किसे']) || hasPhrase(words, 'owes whom'))) return {kind: 'groupBalance', group}
    if (hasAny(words, BOTH)) return {kind: 'ranking', direction: 'both'}
    if (hasAny(words, I_OWE) && !hasAny(words, OWED_TO_ME)) return {kind: 'ranking', direction: 'iOwe'}
    return {kind: 'ranking', direction: 'owedToMe'}
  }

  // Balance with a person: a balance or owing word, or just the name.
  const isNameOnly = words.length <= 3
  if (person && !isSpend && !isTrend && (hasOwe || isBalanceWord || isNameOnly)) return {kind: 'balance', person}

  // A group's balance and who owes whom in it
  if (group && (hasOwe || isBalanceWord || hasWho || isNameOnly) && !isSpend && !isTrend) return {kind: 'groupBalance', group}

  // Overall: how much do I owe / am I owed / my balance
  if (!person && !group && (hasOwe || isBalanceWord) && !isSpend && !isTrend) {
    if (hasAny(words, I_OWE) && !hasAny(words, OWED_TO_ME)) return {kind: 'ranking', direction: 'iOwe'}
    if (hasAny(words, OWED_TO_ME)) return {kind: 'ranking', direction: 'owedToMe'}
    return {kind: 'ranking', direction: 'both'}
  }

  const category = categoryOf(words, used, vocab.categories)
  const period = parsePeriod(words, used)
  const scope: Scope = {category, group, person}

  if (isTrend && (isSpend || category || group || person || hasAny(words, ['trend', 'trends']) || hasAny(words, ME))) {
    const by: Bucket | undefined = hasAny(words, BY_DAY) ? 'day' : hasAny(words, BY_WEEK) ? 'week' : hasAny(words, BY_MONTH) ? 'month' : undefined
    return {kind: 'trend', measure: measureOf(words, !!group), by, period, ...scope}
  }

  const hasHowMuch = hasAny(words, ['how much', 'kitna', 'kitne', 'कितना', 'कितने', 'कितनी'])
  if (isSpend || category || (hasHowMuch && period) || (wantsBreakdown && period)) {
    const breakdown: Breakdown | undefined = hasAny(words, BY_PERSON) ? 'person' : hasAny(words, BY_GROUP) ? 'group' : hasAny(words, ['by category', 'by categories', 'per category', 'category wise', 'categorywise', 'breakdown', 'श्रेणी']) || (hasAny(words, BY_CATEGORY) && wantsBreakdown) ? 'category' : undefined
    return {kind: 'spend', measure: measureOf(words, !!group), period, breakdown, ...scope}
  }

  return {kind: 'unsupported', suggestion: suggest(words, vocab)}
}

const QUESTION_STARTERS = new Set(
  ('how what whats who whom whos which when where why can could should do does did is are will would show tell give split divide ' +
    'kitna kitne kitni kaun kisne kisko kya mujhe mera meri mere batao ' +
    'कितना कितने कितनी कौन किसने किसको क्या मुझे मेरा मेरी बताओ').split(' '),
)

/**
 * Whether Enter on this text in Search should start a conversation instead:
 * it ends in "?", opens with a question word, or the engine reads three or
 * more words as one of its question kinds. A bare name or a plain search
 * ("dinner", "> 1000") stays a search.
 */
export function isQuestion(text: string, vocab: Vocab): boolean {
  const words = tokens(text)
  if (words.length === 0) return false
  if (/[?？]\s*$/.test(text.trim())) return true
  if (words.length >= 2 && QUESTION_STARTERS.has(words[0]!)) return true
  const kind = parseQuestion(text, vocab).kind
  return words.length >= 3 && kind !== 'find' && kind !== 'unsupported' && kind !== 'help'
}
