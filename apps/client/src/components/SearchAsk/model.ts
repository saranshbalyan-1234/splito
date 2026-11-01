import {
  type Entity,
  type Expense,
  type Group,
  type Person,
  type Repayment,
  type SearchResults,
  type WriteOff,
} from '@splito/sync'

export type SearchSection = 'people' | 'groups' | 'expenses' | 'payments'

/** One row of the results list; `nav` is the row's place in keyboard order. */
export type SearchRow =
  | {
      type: 'header'
      key: string
      section: SearchSection
      count: number
      /** The count is only what has been found so far ("30+"). */
      isPartial: boolean
    }
  | {type: 'person'; key: string; nav: number; person: Entity<Person>}
  | {type: 'group'; key: string; nav: number; group: Entity<Group>}
  | {type: 'expense'; key: string; nav: number; expense: Entity<Expense>}
  | {
      type: 'payment'
      key: string
      nav: number
      payment: Entity<Repayment | WriteOff>
    }
  /** "Show more payments" under the payments read so far (expenses page from the list's end). */
  | {type: 'more'; key: string; section: 'payments'}
  /** "Ask Splito: '<query>'", first in keyboard order (ARCHITECTURE 26.3). */
  | {type: 'ask'; key: string; nav: number; query: string}

export type SearchResultRow = Exclude<SearchRow, {type: 'header'} | {type: 'more'}>

/**
 * The results as one list: people and groups first (few, and usually what a
 * name is looking for), then payments, then expenses, each under its section
 * heading. Payments come before expenses so that loading more expenses at the
 * end of the list never moves a section (each has its own Show more).
 */
export function searchRows(
  results: Pick<SearchResults, 'people' | 'groups' | 'expenses'> &
    Partial<Pick<SearchResults, 'payments'>>,
  /** Expenses only: how many match, and whether that is known yet. Defaults to the rows given. */
  expenseCount?: {count: number; isPartial: boolean},
  /** The typed query: puts the "Ask Splito" row first. */
  askQuery?: string,
  /** Payments and write-offs: how many match in all (the rows given are the pages read), or so far. Defaults to the rows given. */
  paymentCount?: number | {count: number; isPartial: boolean},
): SearchRow[] {
  const payments =
    typeof paymentCount === 'number'
      ? {count: paymentCount, isPartial: false}
      : paymentCount
  const rows: SearchRow[] = []
  let nav = 0
  if (askQuery)
    rows.push({type: 'ask', key: 'ask', nav: nav++, query: askQuery})
  const section = <T>(
    name: SearchSection,
    items: T[],
    row: (item: T, nav: number) => SearchRow,
    count: {count: number; isPartial: boolean} = {
      count: items.length,
      isPartial: false,
    },
  ) => {
    if (items.length === 0) return
    rows.push({
      type: 'header',
      key: `header-${name}`,
      section: name,
      ...count,
    })
    for (const item of items) rows.push(row(item, nav++))
  }
  section('people', results.people, (person, n) => ({
    type: 'person',
    key: `person-${person.id}`,
    nav: n,
    person,
  }))
  section('groups', results.groups, (group, n) => ({
    type: 'group',
    key: `group-${group.id}`,
    nav: n,
    group,
  }))
  section(
    'payments',
    results.payments ?? [],
    (payment, n) => ({
      type: 'payment',
      key: `payment-${payment.id}`,
      nav: n,
      payment,
    }),
    payments,
  )
  const shown = results.payments?.length ?? 0
  if (payments && shown > 0 && (payments.isPartial || shown < payments.count))
    rows.push({type: 'more', key: 'more-payments', section: 'payments'})
  section(
    'expenses',
    results.expenses,
    (expense, n) => ({
      type: 'expense',
      key: `expense-${expense.id}`,
      nav: n,
      expense,
    }),
    expenseCount,
  )
  return rows
}
