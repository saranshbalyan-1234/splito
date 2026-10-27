import {
  type Entity,
  type Expense,
  type Group,
  type Person,
  type SearchResults,
} from '@splito/sync'

export type SearchSection = 'people' | 'groups' | 'expenses'

/** One row of the results list; `nav` is the row's place in keyboard order. */
export type SearchRow =
  | {type: 'header'; key: string; section: SearchSection; count: number}
  | {type: 'person'; key: string; nav: number; person: Entity<Person>}
  | {type: 'group'; key: string; nav: number; group: Entity<Group>}
  | {type: 'expense'; key: string; nav: number; expense: Entity<Expense>}

export type SearchResultRow = Exclude<SearchRow, {type: 'header'}>

/**
 * The results as one list: people and groups first (few, and usually what a
 * name is looking for), then expenses, each under its section heading.
 */
export function searchRows(results: SearchResults): SearchRow[] {
  const rows: SearchRow[] = []
  let nav = 0
  const section = <T>(
    name: SearchSection,
    items: T[],
    row: (item: T, nav: number) => SearchRow,
  ) => {
    if (items.length === 0) return
    rows.push({
      type: 'header',
      key: `header-${name}`,
      section: name,
      count: items.length,
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
  section('expenses', results.expenses, (expense, n) => ({
    type: 'expense',
    key: `expense-${expense.id}`,
    nav: n,
    expense,
  }))
  return rows
}
