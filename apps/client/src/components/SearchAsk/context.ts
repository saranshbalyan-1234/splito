import {createContext, useContext} from 'react'

export type SearchAskApi = {
  /** Opens the Search & Ask drawer, with `query` typed in (the old `/search?q=` link). */
  open: (options?: {query?: string}) => void
  /** Cmd/Ctrl+K: opens it, or closes it when open. */
  toggle: () => void
}

const NOOP: SearchAskApi = {open: () => {}, toggle: () => {}}

export const SearchAskContext = createContext<SearchAskApi>(NOOP)
SearchAskContext.displayName = 'SearchAskContext'

/** The Search & Ask drawer's controls (ARCHITECTURE 26.3), from anywhere in the shell. */
export function useSearchAsk() {
  return useContext(SearchAskContext)
}
