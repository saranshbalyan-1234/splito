// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/state/shell/drawer-open.tsx
import {createContext, useContext, useState} from 'react'

type StateContext = boolean
type SetContext = (v: boolean) => void

const stateContext = createContext<StateContext>(false)
stateContext.displayName = 'DrawerOpenStateContext'
const setContext = createContext<SetContext>(() => {})
setContext.displayName = 'DrawerOpenSetContext'

/* Bluesky also pauses its global hotkeys while the drawer is open; Splito has none. */
export function Provider({children}: React.PropsWithChildren<{}>) {
  const [state, setState] = useState(false)
  return (
    <stateContext.Provider value={state}>
      <setContext.Provider value={setState}>{children}</setContext.Provider>
    </stateContext.Provider>
  )
}

export function useIsDrawerOpen() {
  return useContext(stateContext)
}

export function useSetDrawerOpen() {
  return useContext(setContext)
}
