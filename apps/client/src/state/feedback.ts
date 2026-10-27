import {createContext, useContext} from 'react'

/* Lives in state/ so components/ (the footer links) can open the sheet that features/feedback mounts. */
export const OpenFeedbackContext = createContext<() => void>(() => {})
OpenFeedbackContext.displayName = 'OpenFeedbackContext'

/** Opens the Send feedback sheet from anywhere (drawer, Settings, footer links, shake). */
export function useOpenFeedback() {
  return useContext(OpenFeedbackContext)
}
