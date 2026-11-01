/**
 * The rows of the `search_terms` projection (ARCHITECTURE 9.8, 26.19): what a live
 * or deleted record, person or group can be found by, as sortable keys. Pure; the
 * mutation transaction keeps them (`ledgerProjection.ts`) and Search resolves a
 * whole query from them by key range, reading a record's row only to show it.
 *
 * - `w`: a folded word (lower case, no accents) of a record's title / note, notes
 *   and item names. A typed prefix is a key range over these.
 * - `p`, `g`: a folded word of a person's name, or a group's (name, trip
 *   location). Kept apart from `w` so that finding who is called "bulk" never
 *   reads the thousands of expenses titled "bulk". A `p` word also finds the
 *   person's records (`h`), except mine (every record is mine).
 * - `k`: a folded word of a person's contact (email parts, phone digits, the
 *   last ten digits) or UPI id. It lists the person only and never expands to
 *   their records: "98" or "91" would otherwise match a whole ledger.
 * - `a`: a record's amount, `<currency>:<zero-padded offset minor units>`, so an
 *   exact amount is one key, "> 1000" a key range per currency, and a currency
 *   alone is the range of its prefix.
 * - `m`: a record's month of the year (`03`), for "march" in any year.
 * - `c`: an expense's category id.
 * - `b`, `h`: the person ids who paid (`b`) and who are on the record at all (`h`: payers and sharers, or from and
 *   to of a payment), so "paid by Riya" and "with Riya" are one range each.
 * - `G`: the id of the record's group (`-`: none).
 * - `d`: `<date>:<createdAt>`, the record's place in the newest-first order, so a result list is sorted from keys.
 * - `s`: `deleted` on a deleted record (it keeps every other term: search lists it, struck).
 * - `n`: a folded word of a comment, `<word>\u0000<commentId>`, on the record the comment hangs on.
 *
 * A group's or participant's name is not copied onto its records: a rename
 * would have to rewrite them all. The query finds the group or person first
 * and reads their records by `G` / `h`.
 */
import {type CurrencyCode} from '@splito/domain'

import {type Comment} from './comments'
import {type Expense, type Group, type Person, type Repayment} from './mutations'
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

/** The minor units an `a` term holds (the part after `<currency>:`). */
export const amountOfTerm = (offset: string): bigint => BigInt(offset) - OFFSET

/** The first and last `a` term of a currency: the bounds of "every amount in this currency". */
export const amountBounds = (currency: CurrencyCode): [string, string] => [`${currency}:`, `${currency}:￿`]

export const TERM_KINDS = ['w', 'p', 'k', 'g', 'a', 'm', 'c', 'b', 'h', 'G', 'd', 's', 'n'] as const
export type TermKind = (typeof TERM_KINDS)[number]
/** The records a search lists besides people and groups: an expense, a payment, a write-off. */
export type RecordType = 'expense' | 'repayment' | 'writeoff'
/** The `G` term of a record outside any group ("settled" for such a record is about its people, not a group). */
export const NO_GROUP = '-'
export const RECORD_TYPES: readonly RecordType[] = ['expense', 'repayment', 'writeoff']
export type TermEntity = RecordType | 'person' | 'group'

export interface SearchTerm {
  kind: TermKind
  term: string
  entityType: TermEntity
  entityId: string
}

/** Who is on a record: its payers and sharers, or a payment's two sides (the `h` keys; the status filter reads the same list). */
export function recordPeople(type: RecordType, d: Partial<Expense & Repayment>): string[] {
  const ids = type === 'expense' ? [...Object.keys(d.payers ?? {}), ...Object.keys(d.shares ?? {})] : [d.from, d.to]
  return [...new Set(ids.filter((id): id is string => typeof id === 'string'))]
}

const row = (kind: TermKind, term: string, entityType: TermEntity, entityId: string): Row => ({kind, term, entityType, entityId})

/** The `d` term: the date, then the creation time, both sorting as written (13 digits hold epoch ms for centuries). */
export const dateTerm = (date: string, createdAt: number) => `${date}:${String(createdAt).padStart(13, '0')}`

/** The words of a stored contact: an email's parts, a phone's digits and its last ten (found without the country code). */
function contactWords(value: string): string {
  const digits = value.replace(/\D/g, '')
  return value.startsWith('+') && digits.length > 10 ? `${value} ${digits.slice(-10)}` : value
}

/** The term rows of an expense, payment, write-off, comment, person or group (a deleted one keeps them: search lists it, struck); none for anything else. */
export function termRows(e: Entity | undefined): Row[] {
  if (!e) return []
  const out = new Map<string, Row>()
  eachTerm(e, (kind, term, type = e.type as TermEntity, id = e.id) => {
    if (term) out.set(`${kind}\u0000${term}\u0000${type}\u0000${id}`, row(kind, term, type, id))
  })
  return [...out.values()]
}

/**
 * Hands each term of an entity to `add`, unstored and possibly twice or empty (`termRows` drops those): what search
 * checks a row in hand against, with the record a comment's terms find (F-266).
 */
export function eachTerm(e: Entity, add: (kind: TermKind, term: string, type?: TermEntity, id?: string) => void): void {
  if (e.type === 'comment') {
    // A comment is found through the record it hangs on; a deleted one has no text left to find.
    const d = e.data as Partial<Comment> | null
    const target = d?.targetType as string | undefined
    if (!e.deleted && d?.body && RECORD_TYPES.includes(target as RecordType) && typeof d.targetId === 'string')
      for (const word of wordsOf(d.body)) add('n', `${word}\u0000${e.id}`, target as RecordType, d.targetId)
  } else if (e.type === 'expense' || e.type === 'repayment' || e.type === 'writeoff') {
    const d = e.data as Partial<Expense & Repayment> | null
    if (!d) return
    const text = [e.type === 'expense' ? d.title : d.note, d.notes]
    if (d.split?.mode === 'items') for (const item of d.split.items) text.push(item.name)
    for (const word of wordsOf(text.filter(Boolean).join(' '))) add('w', word)
    const total = e.type === 'expense' ? d.total : d.amount
    if (typeof d.currency === 'string' && typeof total === 'bigint') add('a', amountTerm(d.currency, total))
    if (typeof d.date === 'string' && d.date.length >= 7) {
      add('m', d.date.slice(5, 7))
      add('d', dateTerm(d.date, e.createdAt))
    }
    if (e.type === 'expense' && typeof d.category === 'string') add('c', d.category)
    const payers = e.type === 'expense' ? Object.entries(d.payers ?? {}).filter(([, v]) => v !== 0n).map(([k]) => k) : [d.from]
    for (const id of payers) if (typeof id === 'string') add('b', id)
    for (const id of recordPeople(e.type, d)) add('h', id)
    add('G', d.groupId || NO_GROUP)
    if (e.deleted) add('s', 'deleted')
  } else if (e.type === 'person' || e.type === 'group') {
    const d = e.data as Partial<Person & Group> | null
    // A trip's place is found the way its name is (owner 182).
    if (e.type === 'group') for (const word of wordsOf(`${d?.name ?? ''} ${d?.location ?? ''}`)) add('g', word)
    else {
      for (const word of wordsOf(d?.name ?? '')) add('p', word)
      // How to reach a person finds the person, never their records (F-246 review C1).
      for (const word of wordsOf(`${d?.contact ? contactWords(d.contact.value) : ''} ${d?.upiId ?? ''}`)) add('k', word)
    }
  }
}

export const termKey = (r: Row) => [r.kind, r.term, r.entityType, r.entityId] as [string, string, string, string]
