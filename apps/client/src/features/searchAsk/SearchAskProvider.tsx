import {useMemo, useRef, useState} from 'react'

import * as Dialog from '#/components/Dialog'
import {
  type SearchAskApi,
  SearchAskContext,
} from '#/components/SearchAsk/context'
import {useSearchAskHotkey} from '#/components/SearchAsk/useSearchAskHotkey'
import {SearchAskBody} from './SearchAskBody'

/**
 * The one Search & Ask drawer (ARCHITECTURE 26.3), mounted once in the shell
 * so the header button, the old `/search` link and Cmd/Ctrl+K all open the
 * same sheet: a full-height drag-to-close drawer on phones, a centred
 * command-palette popup on rail and desktop. The body mounts only while open.
 */
export function SearchAskProvider({children}: {children: React.ReactNode}) {
  const control = Dialog.useDialogControl()
  const isOpen = useRef(false)
  const [initialQuery, setInitialQuery] = useState('')

  const api = useMemo<SearchAskApi & {isOpen: () => boolean}>(() => {
    const open: SearchAskApi['open'] = options => {
      if (isOpen.current) return
      setInitialQuery(options?.query ?? '')
      control.open()
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
        <SearchAskBody initialQuery={initialQuery} />
      </Dialog.Outer>
    </SearchAskContext.Provider>
  )
}
