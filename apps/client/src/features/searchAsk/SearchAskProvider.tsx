import {useMemo, useRef, useState} from 'react'

import * as Dialog from '#/components/Dialog'
import {
  type SearchAskApi,
  SearchAskContext,
  type SearchAskMode,
} from '#/components/SearchAsk/context'
import {useSearchAskHotkey} from '#/components/SearchAsk/useSearchAskHotkey'
import {SearchAskBody} from './SearchAskBody'

/**
 * The one Search & Ask drawer (ARCHITECTURE 26.3), mounted once in the shell
 * so the header button, the old `/search` link and Cmd/Ctrl+K all open the
 * same sheet: a full-height drag-to-close drawer on phones, a centred
 * command-palette popup on rail and desktop. The body mounts only while open.
 * It opens as search, or straight in the Ask Splito chat (`mode: 'ask'`).
 */
export function SearchAskProvider({children}: {children: React.ReactNode}) {
  const [initial, setInitial] = useState<{query: string; mode: SearchAskMode}>({query: '', mode: 'search'})
  /* The address carries the opening query and mode (`/search?q=dinner&mode=ask`, F-241); a pasted one seeds them. */
  const control = Dialog.useDialogControl({
    url: 'search',
    onUrlQuery: q => setInitial({query: q.q ?? '', mode: q.mode === 'ask' ? 'ask' : 'search'}),
  })
  const isOpen = useRef(false)

  const api = useMemo<SearchAskApi & {isOpen: () => boolean}>(() => {
    const open: SearchAskApi['open'] = options => {
      if (isOpen.current) return
      const query = options?.query ?? ''
      const mode = options?.mode ?? 'search'
      // Opening again with the same start keeps the object: the body (not yet mounted) is not asked to render twice.
      setInitial(s => (s.query === query && s.mode === mode ? s : {query, mode}))
      control.open({urlQuery: {...(query ? {q: query} : {}), ...(mode === 'ask' ? {mode: 'ask'} : {})}})
    }
    return {
      open,
      toggle: () => (isOpen.current ? control.close() : open()),
      isOpen: () => isOpen.current,
    }
  }, [control])

  useSearchAskHotkey({
    onToggle: api.toggle,
    onOpen: api.open,
    isOpen: api.isOpen,
  })

  return (
    <SearchAskContext.Provider value={api}>
      {children}
      <Dialog.Outer
        control={control}
        onOpen={() => {
          isOpen.current = true
        }}
        onClose={() => {
          isOpen.current = false
        }}
        nativeOptions={{fullHeight: true}}
        testID="search-ask-sheet">
        <SearchAskBody initialQuery={initial.query} initialMode={initial.mode} />
      </Dialog.Outer>
    </SearchAskContext.Provider>
  )
}
