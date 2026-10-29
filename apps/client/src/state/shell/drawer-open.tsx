// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/state/shell/drawer-open.tsx
import {createContext, useCallback, useContext, useEffect, useState, useSyncExternalStore} from 'react'

import {useHotkeysContext} from '#/lib/hotkeys'
import {IS_WEB} from '#/env'
import {
  closeSheetMarkers,
  markerFor,
  openSheetMarkers,
  sheetsVersion,
  subscribeSheets,
  donePending,
  peekPending,
} from '#/navigation/sheets'

const noSubscribe = () => () => {}
const never = () => 0

type StateContext = boolean
type SetContext = (v: boolean) => void

const stateContext = createContext<StateContext>(false)
stateContext.displayName = 'DrawerOpenStateContext'
const setContext = createContext<SetContext>((_: boolean) => {})
setContext.displayName = 'DrawerOpenSetContext'

/**
 * Whether the side drawer is open. On web it is a `Sheet` marker in the stack (`?drawer=menu`, F-241), so the
 * address shows it and the browser's Back closes it; on a phone it is plain state (a deep link to it is taken
 * from `navigation/sheets` when the shell mounts).
 */
export function Provider({children}: React.PropsWithChildren<{}>) {
  const [local, setLocal] = useState(false)
  const {disableScope, enableScope} = useHotkeysContext()
  /* The store's own value, read inside the snapshot: React Compiler would cache a bare `markerFor(...)` call here. */
  const isMarked = useSyncExternalStore(IS_WEB ? subscribeSheets : noSubscribe, () => IS_WEB && !!markerFor(null, ['drawer']))
  const version = useSyncExternalStore(IS_WEB ? noSubscribe : subscribeSheets, IS_WEB ? never : sheetsVersion)
  const state = IS_WEB ? isMarked : local

  useEffect(() => {
    if (state) disableScope('global')
    else enableScope('global')
  }, [state, disableScope, enableScope])

  /* A phone's deep link to the drawer waits in `navigation/sheets`; take it as soon as it is queued. */
  useEffect(() => {
    if (IS_WEB || !peekPending(null, ['drawer'])) return
    setLocal(true)
    donePending()
  }, [version])

  const setDrawerOpen = useCallback((open: boolean) => {
    if (!IS_WEB) setLocal(open)
    else if (open) openSheetMarkers(null, ['drawer'])
    else closeSheetMarkers(null, ['drawer'])
  }, [])

  return (
    <stateContext.Provider value={state}>
      <setContext.Provider value={setDrawerOpen}>
        {children}
      </setContext.Provider>
    </stateContext.Provider>
  )
}

export function useIsDrawerOpen() {
  return useContext(stateContext)
}

export function useSetDrawerOpen() {
  return useContext(setContext)
}
