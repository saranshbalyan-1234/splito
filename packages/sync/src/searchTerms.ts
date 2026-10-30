/**
 * The rows of the `search_terms` projection (ARCHITECTURE 9.8): what a live
 * expense, person or group can be found by, as sortable keys. Pure; the
 * mutation transaction keeps them (`ledgerProjection.ts`) and Search reads
 * them by key range, so a query loads only the rows it matches.
 *
 * - `w`: a folded word (lower case, no accents) of an expense's title, notes
 *   and item names. A typed prefix is a key range over these.
 * - `p`, `g`: a folded word of a person's, or a group's, name. Kept apart
 *   from `w` so that finding who is called "bulk" never reads the thousands
 *   of expenses titled "bulk".
 * - `a`: an expense's amount, `<currency>:<zero-padded offset minor units>`, so
 *   an exact amount is one key and "> 1000" a key range per currency.
 * - `m`: an expense's month of the year (`03`), for "march" in any year.
 * - `c`: an expense's category id.
 *
 * A group's or participant's name is not copied onto its expenses: a rename
 * would have to rewrite them all. The query finds the group or person first
 * and reads their expenses by `byGroupDate` / `byPersonDate`.
 */
import {type CurrencyCode} from '@splito/domain'

import {type Expense, type Group, type Person} from './mutations'
import {type Row} from './schema'
import {type Entity} from './types'

const MARKS = /[̀-ͯ]/g
export const WORD = /[\p{L}\p{N}\p{M}]+/gu

/** Lower case without accents, so "Pastéis" is found by "pasteis". */
export function fold(s: string): string {
  return s.normalize('NFD').replace(MARKS, '').toLowerCase()
}

export function wordsOf(s: string): string[] {
  return fold(s).match(WORD) ?? []
}

/** Beyond any amount the domain accepts (|minor| < 10^15), so the offset form is positive and sorts like the number. */
const OFFSET = 10n ** 15n
const WIDTH = 17

/** The `a` term of an amount: sorts by value within one currency. */
export function amountTerm(currency: CurrencyCode, minor: bigint): string {
  return `${currency}:${(minor + OFFSET).toString().padStart(WIDTH, '0')}`
}

/** The first and last `a` term of a currency: the bounds of "every amount in this currency". */
export const amountBounds = (currency: CurrencyCode): [string, string] => [`${currency}:`, `${currency}:￿`]

export type TermKind = 'w' | 'p' | 'g' | 'a' | 'm' | 'c'
export type TermEntity = 'expense' | 'person' | 'group'

export interface SearchTerm {
  kind: TermKind
  term: string
  entityType: TermEntity
  entityId: string
}

const row = (kind: TermKind, term: string, entityType: TermEntity, entityId: string): Row => ({kind, term, entityType, entityId})

/** The term rows of an expense, person or group (a deleted one keeps them: search lists it, struck); none for anything else. */
export function termRows(e: Entity | undefined): Row[] {
  if (!e) return []
  const out = new Map<string, Row>()
  const add = (kind: TermKind, term: string) => {
    if (term) out.set(`${kind}\u0000${term}`, row(kind, term, e.type as TermEntity, e.id))
  }
  if (e.type === 'expense') {
    const d = e.data as Partial<Expense> | null
    if (!d) return []
    const text = [d.title, d.notes]
    if (d.split?.mode === 'items') for (const item of d.split.items) text.push(item.name)
    for (const word of wordsOf(text.filter(Boolean).join(' '))) add('w', word)
    if (typeof d.currency === 'string' && typeof d.total === 'bigint') add('a', amountTerm(d.currency, d.total))
    if (typeof d.date === 'string' && d.date.length >= 7) add('m', d.date.slice(5, 7))
    if (typeof d.category === 'string') add('c', d.category)
  } else if (e.type === 'person' || e.type === 'group') {
    const d = e.data as Partial<Person & Group> | null
    // A trip's place is found the way its name is (owner 182); persons have no location.
    for (const word of wordsOf(`${d?.name ?? ''} ${e.type === 'group' ? (d?.location ?? '') : ''}`)) add(e.type === 'person' ? 'p' : 'g', word)
  }
  return [...out.values()]
}

export const termKey = (r: Row) => [r.kind, r.term, r.entityType, r.entityId] as [string, string, string, string]
