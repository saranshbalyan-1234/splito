import {type CurrencyCode, type DateRange, NO_RULES} from '@splito/domain'
import {type Group, openSearch, type Store, summarizeSearch} from '@splito/sync'

import {type AskSource, type FoundExpense} from '#/lib/ask/source'
import {boundsQuery, cellsQuery, overviewQuery} from '#/data/analyticsQueries'
import {balanceRowsQuery} from '#/data/ledgerQueries'
import {type Query} from '#/data/projections'

/* A question is a one-off read, so a projection's loader runs once, outside React. */
const once = <T>(store: Store, q: Query<T>): Promise<T> => q.loader(store, {reload: () => {}})({}, undefined)

/**
 * What Ask Splito reads, over the local store (ARCHITECTURE 9.8, F-2301):
 * the very queries People, Group and Analytics use (stored balances, stored
 * month sums with date-index reads at the edges, search terms), so an answer
 * and the screen it quotes cannot disagree. No money store is read whole.
 */
export function storeAskSource(
  store: Store,
  me: string,
  search: {today: string; mark: '.' | ','; categories: ReadonlyArray<{id: string; name: string}>},
): AskSource {
  return {
    balanceRows: () => once(store, balanceRowsQuery(me)),
    async groupNets(groupId) {
      const [rows, group] = await Promise.all([store.balances({groupId}), store.get<Group>('group', groupId)])
      const nets: Record<CurrencyCode, Record<string, bigint>> = {}
      for (const r of rows) (nets[r.currency] ??= {})[r.personId] = r.amount
      return {nets, rules: group?.data.rules ?? NO_RULES}
    },
    async currencies() {
      return (await once(store, overviewQuery)).currencies
    },
    async cells(currency, range, exact) {
      return (await once(store, cellsQuery(currency, range, exact))).period
    },
    bounds(currency, groupId): Promise<DateRange | null> {
      return once(store, boundsQuery(currency, groupId ? `ask:${groupId}` : 'ask:all', g => (groupId ? g === groupId : true)))
    },
    async search(query, limit) {
      const session = await openSearch(store, query, search)
      while (session.found().length < limit && !session.isDone()) await session.step()
      const found = session.found()
      const isDone = session.isDone()
      const rows: FoundExpense[] = found.map(e => ({id: e.id, title: e.data.title, date: e.data.date, currency: e.data.currency, total: e.data.total, groupId: e.data.groupId}))
      return {found: rows, isDone, totals: isDone ? summarizeSearch(found).totals : {}}
    },
  }
}
