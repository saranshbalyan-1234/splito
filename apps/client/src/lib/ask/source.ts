import {type BalanceRow, type CurrencyCode, type DateRange, type SettlementRules, type SpendCell} from '@splito/domain'

/** One expense a search found, as the chat lists it. */
export type FoundExpense = {
  id: string
  title: string
  date: string
  currency: CurrencyCode
  total: bigint
  groupId: string | null
}

/** What a search read: the matches so far, newest first, and whether that is all of them. */
export type SearchRead = {found: FoundExpense[]; isDone: boolean; totals: Record<CurrencyCode, bigint>}

/**
 * The only things the engine may read (ARCHITECTURE 9.8): stored balances,
 * stored month sums plus date-index reads, and the search terms. The data
 * layer implements it over the local store (`#/data/askSource`); nothing
 * here can reach the ledger, so no question can read it whole.
 */
export interface AskSource {
  /** My balance with each person, per group and currency (> 0: they owe me): what People shows. */
  balanceRows(): Promise<BalanceRow[]>
  /** A group's net per currency and person, and the rules its settle-up plan keeps to. */
  groupNets(groupId: string): Promise<{nets: Record<CurrencyCode, Record<string, bigint>>; rules: SettlementRules}>
  /** Currencies with live expenses, most used first. */
  currencies(): Promise<CurrencyCode[]>
  /**
   * The cells dated `range` in one currency (whole months stored, edges and `exact` by date index): what
   * Analytics reads. With `groupId`, only that group's records are read (`byGroupDate`).
   */
  cells(currency: CurrencyCode, range: DateRange, exact: boolean, groupId?: string): Promise<SpendCell[]>
  /** First and last dated record in one currency (inside one group, if given); null when there is none. */
  bounds(currency: CurrencyCode, groupId?: string): Promise<DateRange | null>
  /** The first `limit` matches of the Search & Ask drawer's search for `query`. */
  search(query: string, limit: number): Promise<SearchRead>
}
