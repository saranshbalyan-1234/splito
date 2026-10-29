import {useCallback, useState} from 'react'

import {navigationRef} from '#/navigation/ref'
import {OpenFeedbackContext} from '#/state/feedback'
import * as Dialog from '#/components/Dialog'
import {FeedbackSheet} from './FeedbackSheet'

export {useOpenFeedback} from '#/state/feedback'

/**
 * Holds the one Send feedback sheet for the whole app (Bluesky mounts its
 * global dialogs in the shell the same way). The
 * screen name is read when the sheet opens, so "Include app info" says where
 * feedback came from, not where the sheet was left.
 */
export function FeedbackProvider({children}: {children: React.ReactNode}) {
  const control = Dialog.useDialogControl({url: 'feedback'})
  const [screen, setScreen] = useState('')

  const openFeedback = useCallback(() => {
    setScreen(
      navigationRef.isReady() ? (navigationRef.getCurrentRoute()?.name ?? '') : '',
    )
    control.open()
  }, [control])

  return (
    <OpenFeedbackContext.Provider value={openFeedback}>
      {children}
      <FeedbackSheet control={control} screen={screen} />
    </OpenFeedbackContext.Provider>
  )
}
