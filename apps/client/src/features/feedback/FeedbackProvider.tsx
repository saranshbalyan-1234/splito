import {createContext, useCallback, useContext, useState} from 'react'

import {navigationRef} from '#/navigation/DevTour'
import {usePref} from '#/data/hooks'
import * as Dialog from '#/components/Dialog'
import {IS_NATIVE} from '#/env'
import {FeedbackSheet} from './FeedbackSheet'
import {useShake} from './useShake'

const OpenContext = createContext<() => void>(() => {})
OpenContext.displayName = 'OpenFeedbackContext'

/** Opens the Send feedback sheet from anywhere (drawer, Settings, footer links, shake). */
export function useOpenFeedback() {
  return useContext(OpenContext)
}

/**
 * Holds the one Send feedback sheet for the whole app (Bluesky mounts its
 * global dialogs in the shell the same way) and the shake listener. The
 * screen name is read when the sheet opens, so "Include app info" says where
 * feedback came from, not where the sheet was left.
 */
export function FeedbackProvider({children}: {children: React.ReactNode}) {
  const control = Dialog.useDialogControl()
  const [screen, setScreen] = useState('')
  const [shake = false] = usePref('shakeToFeedback')

  const openFeedback = useCallback(() => {
    setScreen(
      navigationRef.isReady() ? (navigationRef.getCurrentRoute()?.name ?? '') : '',
    )
    control.open()
  }, [control])
  useShake(openFeedback, IS_NATIVE && shake)

  return (
    <OpenContext.Provider value={openFeedback}>
      {children}
      <FeedbackSheet control={control} screen={screen} />
    </OpenContext.Provider>
  )
}
