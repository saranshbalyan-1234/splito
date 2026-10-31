import {type Expense, type Group} from './mutations'
import {highlightRanges, minorOf} from './search'
import {type SearchStatus, type SearchToken} from './searchQuery'
import {type Entity} from './types'

/** Which field of a result a query matched: the result row names it and highlights the matched words. */
export type MatchedField =
  | {field: 'notes' | 'item' | 'group' | 'place' | 'category' | 'person' | 'payer' | 'comment'; text: string}
  | {field: 'amount' | 'date' | 'currency'}
  | {field: 'status'; status: SearchStatus}

export interface MatchContext {
  /** The tokens the query was read as (`SearchSession.tokens`). */
  tokens: readonly SearchToken[]
  /** The words to highlight (`SearchSession.terms`). */
  terms: readonly string[]
  /** Person names by id. */
  names: ReadonlyMap<string, string>
  group?: Pick<Group, 'name' | 'location'>
  categoryName?: string
  /** The text of the comment the expense was found through, if any. */
  comment?: string
}

const hasMatch = (text: string | null | undefined, terms: readonly string[]): text is string => !!text && highlightRanges(text, [...terms]).length > 0

/**
 * The fields (other than the title, which every row shows) that explain why an expense is in the results, most
 * specific first, each once. Pure: the rows already match, this only says where.
 */
export function matchedFields(expense: Entity<Expense>, {tokens, terms, names, group, categoryName, comment}: MatchContext): MatchedField[] {
  const e = expense.data
  const out: MatchedField[] = []
  const add = (f: MatchedField) => {
    if (!out.some(x => x.field === f.field)) out.push(f)
  }
  const people = (ids: string[]) => ids.map(id => names.get(id)).filter((n): n is string => !!n)
  const wordsIn = (text: string | null | undefined) => hasMatch(text, terms)

  if (terms.length > 0) {
    if (wordsIn(e.notes)) add({field: 'notes', text: e.notes})
    if (e.split.mode === 'items') {
      const item = e.split.items.find(i => wordsIn(i.name))
      if (item?.name) add({field: 'item', text: item.name})
    }
    if (group && wordsIn(group.name)) add({field: 'group', text: group.name})
    if (group && wordsIn(group.location)) add({field: 'place', text: group.location!})
    if (wordsIn(categoryName)) add({field: 'category', text: categoryName!})
    const named = people([...new Set([...Object.keys(e.payers), ...Object.keys(e.shares)])]).filter(n => wordsIn(n))
    // "paid by riya" names its people below, in the order the person facet says.
    if (named.length && !tokens.some(t => t.kind === 'person')) add({field: 'person', text: named.join(', ')})
    if (comment && wordsIn(comment)) add({field: 'comment', text: comment})
  }

  const visit = (t: SearchToken) => {
    switch (t.kind) {
      case 'compare':
      case 'between':
      case 'around':
        add({field: 'amount'})
        break
      case 'amount':
        // A number is an amount only when it is this expense's; otherwise it matched a word.
        if (t.amounts.some(a => minorOf(a, e.currency) === e.total)) add({field: 'amount'})
        break
      case 'day':
      case 'month':
      case 'period':
        add({field: 'date'})
        break
      case 'currency':
        add({field: 'currency'})
        break
      case 'status':
        add({field: 'status', status: t.status})
        break
      case 'person': {
        const ids = t.role === 'payer' ? Object.keys(e.payers).filter(id => e.payers[id] !== 0n) : [...new Set([...Object.keys(e.payers), ...Object.keys(e.shares)])]
        const matching = people(ids).filter(n => wordsIn(n) || t.text === 'me')
        add({field: t.role === 'payer' ? 'payer' : 'person', text: (matching.length ? matching : people(ids)).join(', ')})
        break
      }
      case 'any':
        t.options.forEach(visit)
        break
      default:
        break
    }
  }
  tokens.forEach(visit)
  if (comment && !out.some(f => f.field === 'comment')) add({field: 'comment', text: comment})
  return out
}
