import {createContext, useContext} from 'react'
import {useRoute} from '@react-navigation/native'

import {isPushedTabRoute} from '#/lib/routes/helpers'
import * as Layout from '#/components/Layout'

/**
 * Whether the main screen around is a pushed copy (opened from a link, owner 179): it shows Back instead of the
 * avatar and has no FAB. A context with a stable boolean, set once by the screen, so `HeaderAvatar` and the FAB do not
 * subscribe to the route (which changes with every filter) and re-render for nothing.
 */
const PushedTabContext = createContext(false)

export function usePushedTab(): boolean {
  return useContext(PushedTabContext)
}

/** Reads the route in a leaf, so a route object that changes re-renders only this provider: its `children` element is made by `TabScreen`, which never re-renders, so React skips the whole screen. */
function PushedTabFlag({children}: {children: React.ReactNode}) {
  const isPushed = isPushedTabRoute(useRoute())
  return <PushedTabContext.Provider value={isPushed}>{children}</PushedTabContext.Provider>
}

/** `Layout.Screen` for Home, People, Groups, Analytics and Activity: the screen plus the pushed-copy flag for its header. */
export function TabScreen({testID, children}: {testID: string; children: React.ReactNode}) {
  return (
    <PushedTabFlag>
      <Layout.Screen testID={testID}>{children}</Layout.Screen>
    </PushedTabFlag>
  )
}
